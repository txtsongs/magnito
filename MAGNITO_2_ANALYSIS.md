# Magnito 2.0 — Rebuild-vs-Evolve Analysis & Tier 1 Plan

**Scope:** Diagnosis only. No code changed. Builds on `ANALYSIS.md` (findings C-1…C-3, H-1…H-4,
M-1…M-5 are referenced, not repeated). Method: full-repo review + three parallel stress-test
sub-agents (EVM fan-out, non-EVM seam, Canton/private-DLT + meta-adapter).

**Date:** 2026-07-04 · **Role:** Planning/analysis pass. Build is gated on your approval.

---

## THE VERDICT

**EVOLVE.** The four deployed contracts, the 5-method adapter interface, and three of four adapters
survive into 2.0 with additive changes; exactly one component — the 154-line orchestrator core — gets
rebuilt, and rebuilding the coordinator of a system is not rebuilding the system.

What makes this call safe rather than optimistic: all three stress tests, run independently, failed
the current design at the **same seam** — the orchestrator has no vocabulary for *what kind of thing
an adapter is* (title ledger vs representation vs evidence log vs legal authority) or *what its
results mean* (tx hash vs contract ID vs update ID; final vs probabilistic). Every Tier 1–4 problem
found is an instance of that one missing vocabulary. One schema, added at adapter registration,
resolves: the XRPL fake-2PC pantomime (C-3), the Canton evidence-integrity lie, the VeChain
exclusion-by-comment, the finality mismatch (H-3), and the Tier-4 meta-adapter door. That is an
*evolution with one rebuilt organ*, not a teardown.

The sharpest single finding (non-EVM agent): **C-1 is partly a taxonomy bug, not just a state-machine
bug.** The shipped Ethereum→XRPL flow is semantically a *mirror* (source stays live; evidence is
written elsewhere) that was expressed through *move* verbs — so "unlock after commit" was correct
behavior wearing the wrong label, and a genuine move would have double-existed. The capability
taxonomy below makes that category error unexpressible, which is strictly stronger than fixing it.

---

## PASS 1 — Current state (delta over ANALYSIS.md only)

Architecture, trust assumptions, and the C/H/M findings stand as written in `ANALYSIS.md`. New
context added by this pass:

- **The 5-method interface is chain-neutral and survives.** Nothing in
  `lock/commit/abort/issue/getInstrumentStatus` assumes EVM. What breaks is *semantic overloading*:
  evidence-grade chains (XRPL) are forced to pantomime title verbs, and private-DLT results
  (Canton `txHash: contractId` — pointing at a contract the exercise just archived) corrupt the
  evidence log the MLETR audit story depends on.
- **A latent orchestrator bug found in passing:** `bridgeInstrument` never checks `result.success`
  (`orchestrator.js:88-111`) — it relies solely on adapters throwing. A non-EVM adapter returning
  `{success:false}` without throwing would silently "succeed." Fold into the rebuild.
- **The VeChain envelope is a hidden asset.** Its attestation format
  (`magnito/version/instrumentId/eventType/metadata/signer/timestamp/payloadHash/signature`,
  `vechain-adapter.js:160-172`) is ~80% of the canonical cross-chain envelope 2.0 needs. Promote it
  out of the adapter rather than inventing a new one.

---

## PASS 2 — Adapter-abstraction stress test

### 2A. EVM fan-out — "9 chains, one class, config only"

**VERDICT: HOLDS-WITH-CONDITIONS.** One `EVMAdapter` class genuinely covers the 8 ethers-compatible
JSON-RPC chains — after a one-time policy layer is added to the class. Nothing found requires a
per-chain subclass. The honest restatement of the thesis: **one adapter per *wire protocol*, not per
VM** — 8 chains share the ethers class; VeChain (Thor REST, clauses, blockRef, VIP-191, no ethers
support) is out-of-class at any config cost. The repo's existing VeChain split is validated.

| Chain | Delta | Class |
|---|---|---|
| XDC | Legacy gas (no EIP-1559); `xdc` prefix is display-only | CONFIG |
| Ethereum | EIP-1559; works today | CONFIG |
| Polygon | Deep-reorg history → `tx.wait(1)` at `evm-adapter.js:51` unsafe | CODE once (finality param), then config |
| Avalanche | Sub-second finality, EIP-1559 variant | CONFIG |
| Arbitrum / Base | Sequencer soft-confirm ≠ L1 finality → finality must be a **strategy** (depth \| time \| L1-batch), not an integer | CODE once, covers both |
| BNB | BEP-226 ≈ EIP-1559 with ~0 base fee; fast blocks | CONFIG |
| VeChain | Not JSON-RPC | **OUT OF CLASS** (correctly so) |

One-time CODE items (chain-count-independent): finality-policy strategy; `NonceManager`/send-queue
(one wallet + concurrent bridge legs = nonce collisions today); instrument address book
(`addresses[instrument]` — C-2 restated: the real blocker is instrument-monomorphism, not chains);
`rpcUrls[]` failover.

Config schema v2 (per chain): `chainKey`, `numericChainId` (validate against RPC at startup),
`rpcUrls[]`, `gasStrategy: auto|legacy|eip1559`, `finality: {mode: depth|time|l1-batch, value}`,
`addresses: {invoice, billOfLading, …}`, `addressDisplayPrefix`, `blockTimeHintMs`,
`signer: {keyRef}`.

Top fan-out risks, in order:
1. **Single `PRIVATE_KEY` = same address on every EVM chain** — one leak is total compromise of all
   instruments on all chains, and the bridge model is custodial. Per-chain keys (or an operator-role
   split) must land **before chain #3**, not after chain #9.
2. **Finality asymmetry compounds combinatorially** — 9 chains = 36 chain-pairs, each with its own
   safe-ordering rule; without the `finality` config + orchestrator gating, every added chain
   multiplies silent double-existence windows (the C-1/H-3 class).
3. **Polygon/Arbitrum/Base are where `tx.wait(1)` turns from sloppy to dangerous** — the finality
   refactor is a Tier-2 *prerequisite*, not a nice-to-have.

### 2B. Non-EVM seam — Stellar, Solana, and the capability taxonomy

**VERDICT:** The interface survives *mechanically* everywhere but fails *semantically* — it forces
evidence-grade chains to fake lock/commit/abort as log-writes (the C-3 pathology). The fix is not a
per-family interface fork; it is **one declared capability level per adapter + a capability-gated
verb split**. With it, non-EVM fan-out is cheap; without it, every non-EVM adapter re-imports the
XRPL confusion.

Feasibility (Evidence-grade / Title-grade, effort S/M/L):

| Chain | Evidence | Title | Key fact |
|---|---|---|---|
| Stellar | **S–M** — but the "port the XRPL memo-writer" assumption breaks: XRPL memos ≈ 1KB JSON; Stellar `MEMO_TEXT` = **28 bytes**. Must hash-anchor (`MEMO_HASH`/`manageData`), not payload-embed. | **M** — Soroban registry | First chain that forces the hash-anchor decision |
| Solana | **S–M** — spl-memo, tx ≤ 1232 bytes; hash-anchor is the safe form | **L** — Anchor + PDAs (M with token-2022 NFT compromises) | Retry/priority-fee logic stays adapter-internal |
| Hedera | **S** — HCS topics purpose-built | **S–M** — Hedera SCS is **EVM**: existing Solidity redeploys; EVM adapter covers it via JSON-RPC relay | Tier 3's cheapest win |
| Algorand | **S** — 1KB note field, near-perfect memo analog | **M** — TEAL app | |
| Tezos | **S** | **M** — Michelson port | |

The taxonomy (adapter declares one constant; orchestrator enforces two guards, ~15 lines):

```js
Capability = Object.freeze({
  TITLE_AUTHORITATIVE:  "title-authoritative",   // canonical ledger; can lock/burn title (XDC)
  TITLE_REPRESENTATION: "title-representation",  // enforceable on-chain object, non-canonical (Ethereum; future Soroban/Anchor)
  EVIDENCE:             "evidence",              // append-only log, nothing enforceable (XRPL memos, VeChain, HCS, Algorand notes)
  LEGAL_AUTHORITY:      "legal-authority",       // private-DLT legal anchor (Canton)
})
```

Guards: an instrument-**move** requires source `TITLE_AUTHORITATIVE` and target
`TITLE_REPRESENTATION`; a target of `EVIDENCE` routes to a **mirror** operation
(`recordEvidence()` only — **no source lock, no source commit**). `validateAdapter` becomes
capability-gated: TITLE_* adapters must implement the 5 methods; EVIDENCE adapters implement only
`recordEvidence + getInstrumentStatus` (kills the XRPL fake-2PC stubs); LEGAL_AUTHORITY gets its own
verb set (§2C).

Interface changes — all additive, no method removed or resignatured:
1. `capability` constant + two orchestrator guards.
2. `recordEvidence(instrumentId, envelope)` as the EVIDENCE verb.
3. `txHash` redefined as opaque "chain-native transaction identifier" (Solana base58 sig, Hedera
   `0.0.x@sec.nanos` ID, Canton update ID) — doc-level; the orchestrator only logs it.
4. Optional `finality: {type: deterministic|probabilistic, confirmations}` in the return contract,
   so the rebuilt orchestrator can gate the commit boundary (ties to H-3).
5. Fix the never-checked `result.success` (see PASS 1).

**The one cost-reducer across all evidence-grade chains:** extract `bridge/envelope.js` — a shared,
versioned canonical instrument snapshot + attestation envelope (stable-ordered JSON, keccak-256
payload hash, optional secp256k1 signature), with the rule *"large-payload chains embed the
envelope; small-payload chains anchor the 32-byte hash + index locally."* The VeChain adapter
already implements ~80% of this — promote it. With it, each of XRPL/Stellar/Solana/Algorand/Hedera
is a ~100-line shim; without it, five adapters invent five formats and cross-chain verification
becomes N² glue.

### 2C. Canton / private DLT — and the meta-adapter door

**VERDICT: Canton forces core changes — to the orchestrator's *semantics*, not its mechanics.**
Three assumptions break:

1. **Evidence integrity.** The orchestrator logs `result.txHash` as the audit trail; the Canton
   adapter returns `txHash: contractId` — and on exercise, the *input* contractId, which that very
   exercise just archived. The "evidence" points at a contract that no longer exists, on a ledger
   with party-scoped visibility, while the actual Canton update ID is discarded. The MLETR audit
   story cannot ride on that. Fix: **typed results**
   (`{kind: 'tx'|'contract'|'update', ref, verifiability: 'public'|'party-scoped'}`) — an
   orchestrator-schema change, i.e. core.
2. **JWT expiry mid-2PC.** Static `config.jwt`, nothing refreshes it; a token dying between lock and
   commit throws inside Phase 2, and if Canton is the source, abort then runs with the same dead
   token. Combined with H-1 (no durable journal): stuck instrument, no persisted state to recover
   from. Needs a token-provider callback *and* proves the per-step retry/resume requirement.
3. **Availability asymmetry.** If Canton becomes a *mandatory* authority on every bridge, Canton's
   uptime becomes the bridge's uptime. The orchestrator has no required-vs-optional participant
   vocabulary — core.

**Role call: AUTHORITY, not MOVER.** The adapter's current full-mover shape is the wrong shape.
Canton holds the *legal characterization* of the instrument, not a migrating copy; an instrument
should not "leave" the legal ledger when it bridges — the legal record *annotates*
(endorse/encumber/release) while title moves. Making Canton a source/target peer creates a **third**
place the instrument can "be," multiplying the C-1 double-existence class. This is the VeChain
exclusion decision repeated one layer up — and this time it gets enforced by the capability enum
instead of a comment. Concrete shape: `LEGAL_AUTHORITY` adapters implement
`endorseBridge(instrumentId, evidence)` / `revokeEndorsement(…)` / `getAuthorityStatus(…)` (DAML: an
`Endorse` choice on an `InstrumentAuthority` template); the orchestrator gains an **optional
authority hook between Phase 1 and Phase 2** — cheap, because the orchestrator is being rebuilt
anyway. The existing adapter code is ~80% reusable under the authority interface (auth, `_post`,
contract-cache, exercise plumbing). **Per project policy it stays frozen until the DAML developer is
engaged — this is a design decision to record, not an edit to make.**

**Daml version cliff:** JSON API v1 (Daml 2.10 LTS) is a bounded bet — v1 is gone in Daml 3.4 and
Canton Network production is consolidating on 3.x. Risk medium now, high by 2027. Recommendation:
the Q4 2026 DAML engagement targets **Daml 3.x + JSON Ledger API v2**; the v1 `_post` paths are
isolated in ~5 methods, so the transport swap is small and already well-contained. Don't lock the
version today; verify LTS status at engagement time.

**Meta-adapter (Quant Overledger, Tier 4): OPEN — nothing precludes it.** The registry is duck-typed
`adapters[chainId]`; a meta-adapter registers N times under namespaced routes
(`overledger:polygon`, …) with thin facades over one client — zero orchestrator changes for the
pattern itself. The one provision to make now: the registration contract becomes
`{routes, capabilities, resultKind, finality}` — the same typed-result + capability schema that
Canton and XRPL need anyway (~20 lines of validation). Strategic flag: Overledger is commercial,
closed, per-call-licensed — treat it as an *optional accelerator* behind the standard adapter
interface, never a load-bearing dependency, or Tier 4 reintroduces the single-vendor chokepoint an
open MLETR protocol exists to eliminate.

---

## PASS 3 — Component verdicts & Tier 1 execution plan

### Per-component: KEEP / PATCH / REBUILD

| Component | Verdict | Reason |
|---|---|---|
| `Invoice.sol` | **PATCH** | Add `IInstrument` hooks + terminal `Bridged` state (fixes C-1 at the root) |
| `BillOfLading.sol` | **PATCH** | Sound MLETR logic; add `IInstrument` + guards (M-4) |
| `LetterOfCredit.sol` | **PATCH** | Add `IInstrument`; fix deemed-acceptance deadlock (M-1), re-presentation (M-3) |
| `BillOfExchange.sol` | **PATCH** | Add `IInstrument`; fix discounted dead-end (M-2) |
| `IInstrument` interface + base | **BUILD-NEW** | The instrument-monomorphism ceiling (ANALYSIS.md Pass 3); prerequisite for everything |
| `orchestrator.js` | **REBUILD** | The one true rebuild: capability guards, typed results, durable journal (H-1), atomic/idempotent commit boundary (H-2), finality gating (H-3), authority hook, `success` check, mirror-vs-move verb split |
| `evm-adapter.js` | **REBUILD** | Instrument-parametrized via `IInstrument`; config schema v2; finality strategy; `NonceManager`; then 8 chains ride it config-only |
| `xrpl-adapter.js` | **PATCH + RESCOPE** | Declare `EVIDENCE`; implement `recordEvidence` on the shared envelope; delete the fake lock/commit/abort; title-grade (XLS-20/MPT) is a later, separate decision |
| `vechain-adapter.js` | **KEEP** | Best file in the repo; extract its envelope into `bridge/envelope.js`, declare `EVIDENCE` |
| `canton-adapter.js` | **KEEP (frozen)** | Re-shape to `LEGAL_AUTHORITY` when the DAML dev starts; spec now, edit later; target Daml 3.x/API v2 |
| `bridge/envelope.js` | **BUILD-NEW** | Canonical snapshot + attestation envelope; makes every future evidence adapter a ~100-line shim |
| Config schema v2 + per-chain keys | **BUILD-NEW** | Finality/gas/rpc-failover/address-book/keyRef; keys split before chain #3 |
| Bridge + invariant test suite | **BUILD-NEW** | Zero tests today on the riskiest code (E-1/E-4/E-5) |

### TIER 1 EXECUTION PLAN

Tier 1 = XDC + Ethereum (movers), XRPL (evidence), VeChain (evidence), Canton (authority, gated).
Ordering principle: **contracts first, then the seam, then adapters, then the gated Canton work** —
and no fifth instrument until step 4 proves the abstraction.

**DO NOW — no external dependencies (Sonnet /goal scope, testnets only):**

1. **Safety net first.** Failing regression test for C-1 (source live after commit); bridge test
   harness with mocked adapters covering 2PC happy/abort/crash-between-steps; then ANALYSIS.md
   Stage A items (validation guards M-4, `indexed` events, dedupe `scripts/` vs `bridge/`, drop
   `Lock.*`).
2. **`IInstrument` + terminal `Bridged` state.** Define interface + abstract base; retrofit all four
   contracts; redeploy to Apothem + Sepolia (testnet redeploy is cheap; the deployed v1 addresses
   stay as the frozen v1.0-prototype artifacts). C-1 and C-2 die here.
3. **Orchestrator 2.0.** Capability registry (`{routes, capabilities, resultKind, finality}`),
   move-vs-mirror verb split, typed results, durable step journal + resume/reconcile, per-chain
   finality gating, `success` check, dormant authority hook (fires when a LEGAL_AUTHORITY adapter is
   registered — none yet).
4. **EVMAdapter 2.0** on config schema v2, instrument-parametrized, `NonceManager`, per-chain keys.
   **Completion criterion: all four instruments bridge XDC↔Ethereum through one adapter with zero
   per-instrument adapter code.** This is the load test — run it here, before any new instrument.
5. **`bridge/envelope.js`** extracted from the VeChain adapter; VeChain adapter consumes it
   (mechanical refactor, no behavior change) and declares `EVIDENCE`.
6. **XRPL rescope**: `EVIDENCE` capability, `recordEvidence` via the envelope (embed — XRPL's 1KB
   memos allow it), fake 2PC methods deleted; live mirror test XDC→XRPL proving source stays live
   and untouched.
7. **Canton pre-work that needs no DAML dev:** adapter unit tests with mocked `fetch` (new files —
   adapter itself untouched); written spec for the `LEGAL_AUTHORITY` interface, typed-result mapping
   (update-ID as evidence ref), and JWT-as-callback config.

**NEEDS A DEPENDENCY — flag: DAML developer (cash-gated; earliest Q4 2026 per Phase 2 plan):**

8. DAML model (`InstrumentAuthority` template, `Endorse/Revoke` choices, party/signatory design),
   participant topology, JWT issuance. **Target Daml 3.x + JSON Ledger API v2, not 2.10/v1.**
9. Canton adapter re-shape to the (already-specced) authority interface + live integration tests.
   Tier 1 is *functionally complete* without this — Canton is additive endorsement, and the
   orchestrator hook idles safely until it registers.

**DEFER — explicitly not Tier 1:**

10. Tier 2 chains (Polygon/Avalanche/Stellar/Solana) — the finality-strategy layer built in step 4
    is their prerequisite and will be waiting for them; Stellar/Solana evidence adapters become
    ~100-line envelope shims after step 5.
11. XRPL title-grade upgrade (XLS-20/MPT) — decide when/if the XRPL grant lands; the capability enum
    makes the upgrade a re-declaration, not a redesign.
12. Meta-adapter — door held open by the step-3 registration schema; no further work now.
13. Promissory Note (instrument #5) — **after** step 4's completion criterion passes; per
    ANALYSIS.md it is the proof of the abstraction, not a Tier 1 deliverable.

### The recommended path, in one paragraph

Evolve. Keep all four contracts and patch them onto a new `IInstrument` interface with a terminal
`Bridged` state; rebuild the one component that deserves it — the orchestrator — around a
capability-declared, typed-result adapter registry with a durable journal; parametrize the EVM
adapter once so eight chains become config; rescope XRPL to the evidence role it actually performs;
extract the VeChain envelope as the canonical cross-chain format; freeze Canton until the DAML
developer lands and then attach it as an authority that countersigns bridges rather than a peer that
holds instruments. Execute steps 1–7 now on testnets; everything in Tiers 2–4 then reduces to
config, shims, or a re-declaration — which is the whole point of 2.0.

---

*Constraints honored: no code changed; Canton adapter untouched; v1.0-prototype tag preserved; build
work proceeds only after your approval, on testnets only.*
