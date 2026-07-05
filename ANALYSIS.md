# Magnito — Architecture & Security Analysis

**Scope:** Diagnosis only. No code changed. Reviewed: `contracts/*.sol` (4 instruments),
`bridge/orchestrator.js`, `bridge/adapters/*` (EVM, XRPL, VeChain, Canton), `bridge/run-bridge.js`,
`hardhat.config.js`, test suite shape, `scripts/`.

**Date:** 2026-07-04 · **Reviewer model:** Opus 4.8 (1M)

---

## 0. Executive summary — read this first

The four instrument contracts are individually clean, readable, and correctly access-controlled at the
per-function level. The test count is real. But two structural facts dominate everything else:

1. **The bridge can only move ONE of your four instruments.** Only `Invoice.sol` has
   `lockInvoice`/`unlockInvoice`. `BillOfLading`, `LetterOfCredit`, and `BillOfExchange` have **no lock,
   commit, or abort hooks at all**, and the EVM adapter's ABI is hardcoded to Invoice
   (`evm-adapter.js:16-20`). The "chain-agnostic, instrument-agnostic adapter pattern" is real for
   *chains* and fictional for *instruments*. The load test the brief asks about (adding a Promissory
   Note) is not a future risk — the same ceiling is already load-bearing on 3 of 4 shipped instruments.

2. **The one bridge path that works violates the property it claims to preserve.** For an
   Invoice bridge, Phase-2 commit calls `unlockInvoice` (`evm-adapter.js:67-78`), which returns the
   source instrument to `Pending` — fully live, payable, transferable — while a representation now also
   exists on the target chain. The orchestrator prints "MLETR singularity preserved"
   (`orchestrator.js:119`) at the exact moment singularity is broken. This is a cross-chain
   double-existence bug, not a cosmetic one.

Neither is a "patch a line" fix. Both point at the same missing abstraction: there is no shared
**Instrument** contract interface and no real notion of a **bridged/burned terminal state**. That
missing abstraction is the thing to build before instrument #5, not after.

### Verdict table (forced KEEP / PATCH / REBUILD)

| Component | Verdict | One-line reason |
|---|---|---|
| `Invoice.sol` state machine | **PATCH** | Sound, but needs a terminal `Bridged` state + shared interface |
| `BillOfLading.sol` | **PATCH** | Clean MLETR logic; add bridge hooks + zero-addr checks |
| `LetterOfCredit.sol` | **PATCH** | Good UCP modeling; fix silent-bank liveness deadlock |
| `BillOfExchange.sol` | **PATCH** | Solid; fix discounted-bill dead-end |
| **Shared instrument interface** | **REBUILD** (build new) | Does not exist; this is the actual ceiling |
| `orchestrator.js` (2PC engine) | **REBUILD** | Not crash-safe, not atomic, commit≠finalize, in-memory log |
| `evm-adapter.js` | **REBUILD** | Invoice-hardcoded; cannot see 3 of 4 instruments |
| `xrpl-adapter.js` | **PATCH** | Fine as an evidence writer; it is *not* an instrument mover — stop calling it one |
| `vechain-adapter.js` | **KEEP** | Genuinely well-built; correct scope; sign-and-verify is real |
| `canton-adapter.js` | **KEEP** (frozen) | Well-structured JSON client; do not touch pending DAML dev |
| Bridge test coverage | **REBUILD** (build new) | Zero automated tests on the most dangerous code |

---

## PASS 1 — Current state & security review

### 1.1 Architecture as-built

**Instruments (XDC-primary, also on Sepolia).** Four independent contracts, each a self-contained
registry: a `mapping(uint256 => Struct)`, an incrementing counter, a bespoke `Status` enum, and
role-checked state transitions via `require(msg.sender == ...)`. No inheritance, no shared base, no
common interface. No value ever moves on-chain — every contract is a *title/status registry*;
settlement is asserted off-chain (e.g. `payInvoice` just flips a flag; `acceptLC` comment says
"Payment obligation is triggered off-chain"). That is a legitimate design for MLETR title tracking,
but it means "security" here is about **state-machine integrity and authority**, not fund custody.

**Bridge.** `BridgeOrchestrator` is a generic 2-phase-commit driver that calls a fixed 5-method
interface (`lock/commit/abort/issue/getInstrumentStatus`) on registered adapters. Adapters:
- `EVMAdapter` — Ethereum + XDC, **Invoice-only** (hardcoded ABI).
- `XRPLAdapter` — writes JSON *memos* on XRPL Payment txns. No enforceable instrument; a memo is a log line.
- `VeChainAdapter` — deliberately outside the orchestrator; attests real-world events with per-signer
  secp256k1 signatures + VIP-191 fee delegation. Reads re-verify signature **and** on-chain presence.
- `CantonAdapter` — DAML JSON-API client, awaiting a deployed model. Cache + query-as-source-of-truth.

**Trust reality.** The bridge is **custodial and single-key**. `lockInvoice` requires
`msg.sender == seller` (`Invoice.sol:100`), so the bridge wallet must *be* the instrument owner.
`run-bridge.js` uses one `PRIVATE_KEY` for both Ethereum and XDC (`run-bridge.js:30,40`). Whoever holds
that key controls every instrument the bridge touches, on every EVM chain, with no threshold, no
timelock, no pause. This is the top trust assumption and it is currently a single point of total failure.

### 1.2 Findings — ranked

#### 🔴 CRITICAL

**C-1 — `commit` un-finalizes the source instrument (cross-chain double-existence).**
`evm-adapter.js:67-78` — `commitInstrument()` calls `unlockInvoice()`, moving the source Invoice
`Locked → Pending`. In `orchestrator.js:103` this runs on the *source* chain as Phase-2 Step 3, after
the target representation is issued. Net result of a "successful" bridge: source Invoice is live again
**and** a representation exists on the target. The instrument now exists, spendable, in two places.
`commitInstrument` and `abortInstrument` even call the *same* function (`unlockInvoice`), so commit and
rollback are indistinguishable on-chain. Root cause: the Invoice enum has no terminal *bridged/burned*
state — `Locked` is the only non-live parking state and it is designed to be reversible.
**Fix (design, not one line):** add an irreversible `Bridged` (or `Exported`) status; `commit` must move
`Locked → Bridged` and nothing may leave `Bridged`. Only `abort` unlocks. See PASS 3 for the interface
this belongs on.

**C-2 — Three of four instruments cannot be bridged at all.**
`BillOfLading`, `LetterOfCredit`, `BillOfExchange` expose no `lock/unlock/commit/abort`
(verified: only `Invoice.sol:96,110` match). `EVMAdapter` is hardcoded to the Invoice ABI
(`evm-adapter.js:16-20,35-39,50,69,86,135`). Registering an eBL/LC/BoE and calling `bridgeInstrument`
would revert at Step 1. The product claims four bridgeable instruments; one is bridgeable. This is a
correctness/coverage gap masquerading as a feature.
**Fix:** shared bridge hooks on a common interface (PASS 3), plus an instrument-parametrized adapter.

**C-3 — The target "representation" is unenforceable; singularity is asserted, not enforced.**
`xrpl-adapter.js:57-80,152-172` — issuing/committing an instrument on XRPL writes a JSON memo on a
1-drop Payment. Nothing on XRPL constrains it: any account can write a memo naming any `instrumentId`,
and there is no object whose transfer is gated by holder/pledge state. So even ignoring C-1, the
"singularity preserved across chains" claim has no on-chain enforcement on the liquidity side — it is a
log, not a title. **Fix:** either (a) reframe XRPL honestly as an *evidence/liquidity signal* rather
than an instrument mover (recommended — it mirrors how VeChain is already scoped), or (b) move to XLS-20
NFTs / MPT so the representation is an actual controllable object. Do not ship language that promises
enforcement the rail does not provide.

#### 🟠 HIGH

**H-1 — 2PC has no durability or crash recovery.** `orchestrator.js:16,116` — `evidenceLog` is an
in-memory array. The only rollback is the in-process `catch` (`:123-143`). If the node crashes between
Step 1 (lock) and Step 3 (commit), the instrument is left `Locked` with **no persisted journal** to
resume or compensate from, and only the seller/bridge key can unlock it. For a system moving financial
title, an unrecoverable stuck-locked state is a HIGH operational risk.
**Fix:** persist a write-ahead journal (status per step) before each side effect; add a
resume/reconcile path keyed on `instrumentId`.

**H-2 — 2PC is not atomic across the commit boundary.** `orchestrator.js:103-111` — Step 3 commits
source, Step 4 commits target. If Step 4 fails, there is no compensation: source is already
committed (and, per C-1, unlocked). Classic non-atomic 2PC with no coordinator recovery. Even after
C-1 is fixed, a source-burned/target-not-committed split is possible.
**Fix:** make target-commit idempotent and retriable; only finalize source after target durably
acknowledges; journal the boundary.

**H-3 — Settlement-finality mismatch (XDC/Sepolia vs XRPL).** Adapters treat one confirmation as final:
EVM `tx.wait()` (`evm-adapter.js:51` etc.) is 1 block; XRPL `submitAndWait` is genuinely final in ~4s.
A source-chain lock can be reorged away on Sepolia/Apothem *after* the XRPL memo is irreversibly
written. Result: target says "issued", source lock never happened. No confirmation-depth setting exists
anywhere.
**Fix:** configurable finality depth per chain; do not issue on the fast/final chain until the slow
chain's lock is buried N blocks.

**H-4 — Target representation trusts orchestrator-supplied data, not the source contract.**
`run-bridge.js:88-98` reads `amount/seller/documentHash` off-chain and hands them to the adapter;
`xrpl-adapter.js:152-164` / `evm-adapter.js:102-114` write whatever they're given. Nothing re-verifies
the payload against the locked source instrument. A buggy or malicious orchestrator can mint a
representation with mismatched amount/holder.
**Fix:** adapters should read the canonical field set from the source contract (or verify a signed
attestation) rather than trusting caller-passed data.

#### 🟡 MEDIUM

**M-1 — LC deadlocks if the issuing bank stays silent.** `LetterOfCredit.sol:249-259` — `expireLC`
only fires from `Open`. Once `Presented`, if the bank never calls accept/refuse/discrepancy before
`examinationDeadline`, the LC is stuck in `Presented` forever and every acting function is gated on
`block.timestamp <= examinationDeadline` (`:207,232,180`). UCP 600 Art. 16 treats bank silence past the
window as *deemed acceptance*; the contract encodes the opposite (permanent limbo) and hands the bank a
costless griefing/stall lever.
**Fix:** add a post-window transition (anyone can call) that resolves `Presented` → `Accepted`
(deemed) or a defined default, matching UCP.

**M-2 — Discounted Bill of Exchange is a dead end.** `BillOfExchange.sol:116-153` — `transferBOE` and
`discountBOE` both require status `Accepted || Transferred`. `discountBOE` sets status `Discounted`, so
a financier who buys the bill **cannot on-sell or re-discount it** — the secondary market the DNI
initiative exists to enable is blocked at the first hop.
**Fix:** allow `Discounted` as a valid source state for `transferBOE`/`discountBOE`.

**M-3 — LC has no re-presentation path.** `LetterOfCredit.sol:141-159` — `presentDocuments` only runs
from `Open`. After a `Discrepancy`, the beneficiary cannot re-present corrected docs before the
presentation deadline, which UCP permits.
**Fix:** allow re-presentation from `Discrepancy` while `block.timestamp <= presentationDeadline`.

**M-4 — Missing zero-address / self checks on issuance.** `BillOfLading.issueEBL` (`:76-101`) does not
check `_holder != address(0)` — an eBL minted to `address(0)` is permanently dead (no one can transfer,
pledge, or surrender). `Invoice.createInvoice` (`:41`) checks nothing (`_buyer` may be zero, `_amount`
may be zero). `BillOfExchange` allows `drawer == drawee`.
**Fix:** add the standard `require(addr != address(0))` and `amount > 0` guards on the create/issue
paths, matching what `LetterOfCredit.openLC` already does correctly (`:101-104`).

**M-5 — Two divergent XRPL adapters.** `scripts/xrpl-adapter.js` (158 lines) and
`bridge/adapters/xrpl-adapter.js` (187 lines) both exist and differ. This is a live footgun: someone
will wire the wrong one. `scripts/iso20022-adapter.js` and `scripts/evidence-logger.js` overlap with
bridge concerns too.
**Fix:** delete/collapse the `scripts/` copies; single source of truth under `bridge/adapters/`.

#### ⚪ LOW / observability

- **L-1 — No `indexed` event parameters anywhere** (verified: zero matches). Indexers, the frontend,
  and the bridge cannot efficiently filter by `seller`/`holder`/`id`. Index the id + principal party on
  every event. High leverage for near-zero effort — see PASS 2.
- **L-2 — All-immutable, no admin, no pause.** No upgradeability and no emergency stop means the C-1/M-1
  class of logic bugs is *permanent* once real value rides on it. Immutability is good for trust but is
  a conscious governance trade-off that should be *decided*, not defaulted into. At minimum, a
  circuit-breaker on the bridge entry points.
- **L-3 — Pragma drift.** `Invoice.sol` is `^0.8.24`; the others `^0.8.28`; config pins `0.8.28`.
  Align them.
- **L-4 — `Invoice.sol:89-95` malformed/duplicated NatSpec block** (a stray nested `/**`). Cosmetic,
  but it is in your flagship contract.
- **L-5 — Dead boilerplate.** `contracts/Lock.sol`, `ignition/modules/Lock.js`, `test/Lock.js`
  (9 of the "118" tests are Hardhat's sample Lock, not Magnito). Remove; and note the real instrument
  coverage is **109** tests, not 118.
- **L-6 — `require`-string errors throughout.** Custom errors are cheaper and machine-parseable (PASS 2).
- **L-7 — XRPL default destination hardcoded** (`xrpl-adapter.js:27`). Make it explicit config.

**Not vulnerabilities (checked and clear):** reentrancy (no external calls / no value transfer in
contracts); integer overflow (Solidity 0.8 checked math); per-function access control (correctly
`msg.sender`-gated everywhere); VeChain signature handling (sign-over-keccak, recover-and-compare, plus
on-chain existence check — this is done properly, `vechain-adapter.js:155-158,276-282`).

---

## PASS 2 — Enhancements (keep current design), ranked by leverage

| # | Enhancement | Impact | Effort | Leverage |
|---|---|---|---|---|
| E-1 | **Bridge test suite** — the orchestrator/adapters have **zero** automated tests, and they are the most dangerous code. Add mocked-adapter tests for the 2PC happy path, abort path, crash-between-steps, and (regression) C-1. | Very high | Med | **Top** |
| E-2 | **`indexed` event params** on id + principal party across all four contracts (fixes L-1). Frontend/indexer/bridge all get filterable logs. | High | Trivial | **Top** |
| E-3 | **Input validation guards** (M-4): zero-address + `amount>0` on all create/issue paths. | High | Trivial | **Top** |
| E-4 | **Invariant / property tests**: e.g. "an instrument is never simultaneously live on source and represented on target", "only one holder", "no transition out of a terminal state". This is where C-1 would have been caught. | High | Med | High |
| E-5 | **Cross-chain settlement tests** against local EVM + XRPL testnet: assert source is *not* live after commit. | High | Med | High |
| E-6 | **Fix the state-machine liveness/dead-end bugs** M-1, M-2, M-3 (each is a small, local `require`/transition change within the existing design — no rewrite). | Med-High | Low | High |
| E-7 | **Custom errors** replacing require-strings (L-6): gas + machine-parseable reverts for the bridge to branch on. | Med | Low | Med |
| E-8 | **Delete duplicate/dead code** (M-5, L-5): one XRPL adapter, drop Lock.*. Removes a wire-the-wrong-thing class of bug. | Med | Trivial | Med |
| E-9 | **Confirmation-depth config** per chain in adapters (H-3 mitigation, even before the full 2PC rebuild). | Med | Low | Med |
| E-10 | **Consistent NatSpec + pragma** (L-3, L-4). Cheap credibility for grant/audit reviewers. | Low | Trivial | Low |

E-1 through E-3 are the "do this week regardless of the bigger decision" set — they are cheap, they are
inside the current design, and E-1/E-4 are what turn C-1 from "shipped" into "caught."

---

## PASS 3 — Rebuild vs patch: the Promissory Note load test

**Exercise:** add a 5th instrument, `PromissoryNote.sol` (issuer promises to pay payee a sum at
maturity; transferable/endorsable; discountable — very close to Bill of Exchange, aligned with ITFA DNI).

### What actually happens when you add it

1. **Contract:** You copy-paste `BillOfExchange.sol`, rename `drawee→maker`, drop `acceptBOE` (a note
   needs no acceptance — the maker is already the promisor), keep transfer/discount/settle. ~200 lines
   of near-duplicate state-machine code, a 5th bespoke `Status` enum, a 5th `mapping`, a 5th counter.
   **No shared code is reused because there is nothing to reuse.** Every prior instrument is standalone.

2. **Bridge hooks:** To make it bridgeable you must add `lock/unlock/commit`-style functions — which
   means inventing them per-instrument *again*, because Invoice's are the only precedent and they live
   as ad-hoc functions, not a contract you inherit. And per C-1 you'd be copying a *broken* pattern
   (unlock-as-commit) unless you first design the terminal-state model.

3. **Adapter:** `EVMAdapter` cannot touch it. You either fork a 5th hardcoded adapter
   (`INVOICE_ABI` → `PNOTE_ABI`, `invoiceContract` → `pnoteContract`, `getInvoice` → `getPNote`,
   statusMap rewritten) or you finally parametrize the adapter by instrument. Today it is the former —
   copy-paste adapter #2, and you'd owe copies #3 and #4 for the eBL/LC/BoE you never wired.

4. **Frontend / evidence / Canton:** each carries its own instrument assumptions; add another.

**This is the design ceiling, stated plainly:** the system is *chain*-polymorphic (one `EVMAdapter`
serves Ethereum + XDC beautifully) but *instrument*-monomorphic (every instrument is a bespoke island).
The brief's worry — "does adding an instrument force copy-paste or special-casing?" — the answer is
**yes, it already does, and it forced it three times before the Promissory Note.** Adding #5 doesn't
*expose* the ceiling; it pays another installment of interest on a debt that's been accruing since
instrument #2.

### The missing abstraction (what to build)

A shared **`IInstrument`** interface + a small abstract base that every instrument implements:

```
interface IInstrument {
    function lock(uint256 id) external;      // live → Locked (reversible)
    function commitBridge(uint256 id) external; // Locked → Bridged (TERMINAL, irreversible)
    function abortBridge(uint256 id) external;  // Locked → live (reversible)
    function currentHolder(uint256 id) external view returns (address);
    function bridgeState(uint256 id) external view returns (uint8); // Live|Locked|Bridged
}
```

- Every instrument keeps its own domain state machine (Invoice's Pending/Paid, LC's UCP states, etc.)
  **and** implements this thin bridge-facing interface. Domain logic stays bespoke (it should — an LC
  is not a BoE); the *bridge contract* becomes uniform.
- `commitBridge` introduces the terminal `Bridged` state that C-1 is missing. Singularity becomes a
  contract-enforced invariant ("nothing leaves `Bridged`"), not a printed claim.
- `EVMAdapter` takes an `IInstrument` address + reads through the interface — **one** adapter for all
  instruments on all EVM chains. Adding instrument #5 = write the contract, register its address. Zero
  adapter changes. That is the property the brief is testing for, and it does not exist yet.

This is a **build-new**, not a rewrite-in-place: the four instruments are individually sound and mostly
survive (add the interface + terminal state; keep the domain logic). The thing that gets rebuilt is the
*seam between instruments and the bridge*, which today is Invoice-shaped duct tape.

### Forced verdicts (rationale)

- **Instruments = PATCH.** Domain state machines are correct and well-tested. They need: the shared
  `IInstrument` hooks, a terminal bridged state (C-1), and the local liveness fixes (M-1/2/3, M-4). No
  logic rewrite.
- **Shared instrument interface = REBUILD/BUILD-NEW.** It's the actual ceiling and it's absent. Highest
  structural priority.
- **Orchestrator = REBUILD.** Not crash-safe (H-1), not atomic (H-2), commit semantics wrong via the
  adapter (C-1), in-memory evidence. The 2PC *shape* is right; the *implementation* needs a durable
  journal + reconcile loop + finality gating.
- **EVM adapter = REBUILD.** Must read through `IInstrument`, not a hardcoded Invoice ABI.
- **XRPL adapter = PATCH + RESCOPE.** Mechanically fine as a memo writer; stop presenting it as an
  instrument mover it cannot be (C-3). Either rescope to "liquidity/evidence signal" (cheap, honest,
  matches VeChain's framing) or upgrade to XLS-20/MPT (expensive, real). Decide deliberately.
- **VeChain adapter = KEEP.** Best-engineered file in the repo. Correct scope, real signatures, reads
  re-verify. Leave it.
- **Canton adapter = KEEP (frozen).** Well-structured; do not touch until a DAML dev is on the
  engagement (per project policy).
- **Bridge tests = BUILD-NEW.** Zero exist on the riskiest code.

---

## Prioritized action plan — the order I'd actually execute

**Do not start instrument #5 until Stage B is done.** Building the Promissory Note first means
copy-pasting the broken seam a fourth time and then unwinding it.

### Stage A — Fix now (this week, cheap, inside current design)
1. **C-1 regression + E-1/E-4 tests first** — write the failing test that proves an Invoice is live on
   source after commit. Lock the bug in before touching code.
2. **Add terminal `Bridged` state to Invoice; make `commit` finalize, not unlock** (C-1). Adapter's
   `commitInstrument` stops calling `unlockInvoice`.
3. **Input-validation guards** across all create/issue paths (M-4, E-3).
4. **`indexed` events** on all four contracts (L-1, E-2).
5. **Delete dead/duplicate code** — one XRPL adapter, drop `Lock.*` (M-5, L-5, E-8).
6. Correct external claims to reality: "1 of 4 instruments bridgeable today; XRPL side is evidence, not
   enforced title." (Matters for grant/audit honesty.)

### Stage B — Build the missing abstraction (before instrument #5)
7. **`IInstrument` interface + abstract base**; retrofit all four instruments to it (PATCH each).
8. **Parametrize `EVMAdapter`** to read through `IInstrument` (REBUILD adapter). Now all four
   instruments are bridgeable through one adapter — this is the real fix for C-2.
9. **Rebuild the orchestrator**: durable journal (H-1), atomic/idempotent commit boundary with
   reconcile (H-2), per-chain finality depth (H-3), adapters verify payload against source (H-4).
10. **Cross-chain settlement + invariant test suite** (E-4, E-5) against local EVM + XRPL testnet.

### Stage C — Then, and only then, the load test itself
11. **Add `PromissoryNote.sol`** by implementing `IInstrument`. Success criterion for Stage B: this
    requires **zero** orchestrator or adapter changes. If it doesn't, Stage B isn't finished.

### Stage D — Enhance / decide (parallelizable, lower urgency)
12. Fix LC/BoE liveness & dead-end bugs (M-1, M-2, M-3, E-6).
13. Custom errors (E-7), pragma/NatSpec cleanup (L-3, L-4, E-10).
14. **Governance decision** (L-2): keep full immutability, or add a bridge circuit-breaker /
    minimal admin with timelock. Decide it; don't default it.
15. **Decide XRPL's role** (C-3): evidence-signal (recommended, cheap) vs XLS-20/MPT real object.
16. **De-risk the single bridge key**: threshold/multisig or per-chain key separation before any
    non-testnet value.

---

### Honest bottom line

The instruments are good work — clean, tested, well-modeled against MLETR/UCP/DNI. The VeChain and
Canton adapters are genuinely well-built. What's weak is exactly the part the product is named for:
the *interop seam*. Right now "four instruments, chain-agnostic bridge" is really "four instruments +
a one-instrument bridge that un-does the thing it promises." That's fixable without throwing away the
contracts — but it's a build-the-missing-interface job, not a patch, and it should happen **before** the
Promissory Note, not after. The Promissory Note is the right load test; run it *last*, as the proof that
Stage B worked.
