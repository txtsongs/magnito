# Magnito — Phase 2 Plan

**Prepared:** 12 June 2026 · **Prepared by:** Fable 5 (lead architect pass) · **Executor:** Sonnet 4.6
**Baseline:** Prototype v1.0 tagged. 118 tests passing. Four contracts live on XDC Apothem + Ethereum Sepolia. Bridge orchestrator with EVM/XRPL/VeChain/Canton adapters. Five-screen frontend.

This plan was built on fresh research (June 2026) with sources verified where possible. Items the research could **not** verify are flagged inline as ⚠️ — the executor should confirm those before acting on them, not assume them.

---

## 0. Critical corrections — read first

Four facts in our existing notes were wrong or stale. These change the plan:

1. **"Andre Kasam" does not exist.** The person is **André Casterman** — ITFA Board Member, Chair of the ITFA Fintech Committee, founder of the Digital Negotiable Instruments (DNI) Initiative, MD of Casterman Advisory, ex-SWIFT (20+ years). LinkedIn: `linkedin.com/in/andrecasterman`. The README has been corrected. Never use "Kasam" in any outreach.
2. **"Enjo" is Enigio** — Swedish company (Stockholm, founded 2012), product **trace:original**. Their credibility playbook is documented in §7.
3. **The legacy XRPL Grants program is closed.** As of 12 June 2026, xrplgrants.org and the XRPL Accelerator show "no open calls." Ripple announced (Feb 2026) a restructure to a distributed funding model (FinTech Builder Program, XAO DAO, regional hubs, a "funding hub" portal). The only confirmed open window right now is **XRPL Commons Aquarium Cohort 9 — deadline 23 August 2026**. Strategy adjusted in §2.
4. **The Canton JSON Ledger API v1 our adapter targets was removed in Daml 3.4** (Canton Network MainNet upgraded Dec 2025). It survives only on Daml 2.10 LTS / Daml Hub. This forces an explicit version decision in the DAML recruitment brief (§5).

---

## 1. André Casterman (ITFA) outreach — THE single most important action

**Why this is first.** Casterman chairs the committee that owns the exact standard our Bill of Exchange contract claims alignment with (DNI/dDOC). His stated 2025–2026 priority is *combining DNI with tokenised payments* — his own words: *"If you combine DNI and tokenised payments we have a fully digital environment."* Magnito is literally that sentence: DNI-aligned instruments on XDC + tokenised settlement on XRPL. Every other workstream in this plan (both grant applications, the DSI assessment, the legal opinion) gets stronger if it can cite ITFA engagement — and weaker if Casterman's committee has never heard of us. He is also an advisor to early-stage trade finance fintechs by profession, and the historical pattern (Enigio, XinFin, Traxpay, Mitigram) is: *join ITFA → align with dDOC → co-publish → pilot with member banks*. XinFin/XDC was itself named in the May 2020 DNI paper, so building on XDC is already an ITFA-legible signal.

### Channel and sequence

1. **Join ITFA first (or simultaneously).** Standard institutional membership is **€1,500/year**, applied for via the online form or `info@itfa.org` (ITFA c/o Format A AG, Wiesenstrasse 9, 8008 Zürich, +41 44 268 6900). Membership covers any number of staff. There is no separate fintech tier — fintechs join as ordinary members, then participate in the Fintech Committee / DNI Initiative. Mentioning a membership application in the first message converts the outreach from "stranger pitching" to "incoming member introducing himself."
2. **Contact via LinkedIn DM** (`andrecasterman`) — he is highly active there (posted the "ITFA Fintech Committee Action Plan 2026"). Secondary: ask `info@itfa.org` to route an introduction to the Fintech Committee chair.
3. ⚠️ An ITFA DNI workshop appears on the summer 2026 events calendar (~July 12) — verify the date on itfa.org; attending in person would beat any message.

### What to lead with (in order)

1. **The Bill of Exchange contract, framed as a DNI/dDOC implementation.** 34 tests, ITFA DNI-aligned, deployed on XDC — *the chain ITFA itself admitted as its first L1 member and that was proposed as preferred chain for dDOC*. This is his initiative; lead with his thing, not ours.
2. **The MLETR singularity mechanism.** The 2-phase-commit bridge guarantees exactly one authoritative version of an instrument across chains — a direct technical answer to MLETR Art. 10 / dDOC's 2023 "reliability evidence" revision. This is the genuinely novel part; one sentence, offer detail on a call.
3. **DNI + tokenised payments in one stack.** Instruments on XDC, settlement leg on XRPL (RLUSD roadmap) — quote his own 2025 priority back to him.
4. **A small, concrete ask:** 20 minutes for feedback on whether the Bill of Exchange contract correctly interprets the dDOC specifications, and how to participate in the DNI Initiative as an incoming ITFA member.

### What to hold back

- **No funding or partnership ask.** The ask is feedback and committee participation. Funding conversations come after a relationship exists.
- **No legal-compliance claims.** We have no legal opinion yet. Say "designed to MLETR / dDOC" — never "compliant." Casterman works alongside Sullivan's Geoffrey Wynne (ITFA's legal adviser); overclaiming legal status to this audience is the fastest way to lose credibility.
- **No production claims.** Everything is testnet. Say "working prototype, 118 tests, deployed on Apothem/Sepolia" — accurate and still impressive at our stage.
- **The full multi-chain story.** Five chains in an intro message reads as unfocused. Lead with XDC + XRPL (the two ITFA-legible chains); VeChain/Canton/Ethereum are call-depth material.
- **Competitive commentary** (Contour, Enigio, Bolero). He knows these companies personally.
- **Grant plans.** Irrelevant to him and signals we're resource-hunting.

### Draft message (executor: personalize, keep under ~150 words)

> Hi André — I've built a working prototype that implements your DNI/dDOC framework as smart contracts: a Bill of Exchange aligned with the dDOC specifications, deployed on XDC, alongside eBL, LC and invoice instruments (118 passing tests, open source). The piece I'd value your judgment on: a cross-chain control mechanism that guarantees a single authoritative version of each instrument — our attempt at MLETR singularity and the dDOC reliability requirement — with the settlement leg on XRPL, which I think lines up with your point about combining DNI with tokenised payments. We're applying to join ITFA and would like to contribute to the DNI Initiative. Could I get 20 minutes of your time for feedback on whether the Bill of Exchange implementation reads the dDOC specs correctly? Repo: github.com/txtsongs/magnito

### Pass criteria

- ITFA membership application submitted.
- Message sent; any reply (even a redirect to a committee member) counts as success — log it and follow whatever thread he opens.
- If no reply in 2 weeks: follow up once via `info@itfa.org` requesting DNI Initiative participation as an applicant member; do not re-DM more than once.

---

## 2. XRPL grant application — adjusted for the post-restructure landscape

### Current reality (verified 12 June 2026)

- **RippleX Grants ($10K–$200K, milestone-based) and Accelerator ($50K–$200K): applications closed.** Portal says "no open calls"; contacts for reopening: `RippleXEcosystem@ripple.com`, `info@xrplgrants.org`. The xrpl.org developer-funding page still shows them as open — it is stale; trust the portal.
- **Feb 2026 restructure:** funding moves to a distributed model — **FinTech Builder Program** (institutional-grade financial apps: stablecoin payments, credit infrastructure, tokenization — exactly our category; ⚠️ no public application mechanism found yet), **XAO DAO** (community microgrants — too small for us), an ecosystem **funding hub portal** ("launching soon"), **XRP Asia** (APAC regional), plus the independent **XRPL Commons** (Paris).
- **Only confirmed open window: XRPL Commons Aquarium Cohort 9** — applications open now, **deadline 23 Aug 2026**, program 28 Sep–26 Nov 2026 in Paris (4 days/week on-site, accommodation provided; funding amount unpublished).
- **$200K is the published ceiling** of the legacy programs, awarded only twice (custody infrastructure teams). Trade-finance/RWA awards clustered **$130K–$180K**. Trade finance is one of four explicitly named priority use cases. Closest funded analogue: **Fortstock** ($150K, France) — warehouse receipts as **MPTs** for trade finance lending. Also relevant: Blockpeer (Accelerator Batch VII, Singapore, tokenized trade assets).

### Strategy

1. **Build the complete application package now; submit the day a program reopens.** "Spring 2026 new programming" was promised and hasn't landed by mid-June — when it does, first-movers with finished packages win. Email both contact addresses now: introduce Magnito, ask to be notified when FinTech Builder / grants reopen.
2. **Apply to Aquarium Cohort 9 before 23 Aug 2026** as the parallel confirmed track. ⚠️ Check the 4-days/week-in-Paris commitment is feasible before applying.
3. **Set the ask at $150K–$180K, not $200K.** Asking the historical max as a first-time applicant invites a haircut; asking in the band where trade-finance projects actually land invites a yes.

### Application outline (the legacy unified form — components verified from the FAQ)

| Required component | Our answer |
|---|---|
| Prototype + GitHub repo | ✅ v1.0 tagged, open source (MIT) |
| 2-minute demo video | ❌ **Build it** — record the two-computer live test (§8); it doubles as the demo |
| Detailed project description | Draft from README + this plan's framing |
| Product/dev roadmap (3–12 months) | The milestones below |
| Financial sustainability plan | ❌ Draft: SaaS/per-instrument fees to platforms + banks; ITFA/XDC ecosystem channel |
| XRPL integration rationale | The settlement-layer story, upgraded (below) |

**Eligibility checklist:** 18+ ✅ · non-OFAC ✅ · open source (preferred, not required) ✅ · MVP exists ✅ · experienced dev on team ✅ · incorporation — not required for grants; ⚠️ required before any venture follow-on; decide on entity formation.

**What the $150–180K funds (milestone structure):**

1. **M1 — XRPL technical upgrade ($50K, months 1–3):** migrate receivables from trustline-gated IOUs to **Multi-Purpose Tokens (MPTs)** (Fortstock precedent shows reviewers expect this); represent eBLs with MPT metadata + transfer restrictions; add **Credentials (XLS-70) + Permissioned Domains (XLS-80)** for KYC-gated instrument transfer; RLUSD settlement leg.
2. **M2 — bridge hardening ($40K, months 2–5):** persistent 2PC state, adapter timeouts, full adapter/orchestrator test suite (§9 gap list).
3. **M3 — receivables financing on XLS-66 ($30K, months 4–8):** align invoice financing with the native Lending Protocol (entered validator voting Jan 2026) — this is XRPL's flagship 2026 feature; an application that builds on it scores alignment points. ⚠️ Confirm amendment activation status at application time.
4. **M4 — Singapore legal opinion co-funding + pilot ($40K, months 6–12):** partial funding of §6, plus a live two-party pilot with evidence bundles.

**Alignment notes for the narrative:** name-check MPTs, RLUSD, XLS-66 lending, Credentials/Permissioned Domains (institutional compliance push), and position Magnito as bringing a **named priority use case (trade finance)** with **MLETR legal grounding** — no funded XRPL project has the legal-layer story. Do not mention Hooks (not on XRPL mainnet — Xahau only).

---

## 3. XDC Foundation grant strategy

### Routes (all verified, in priority order)

1. **DaoFin / XDCDAO Community Support Bounty** — the direct route. Categories include "applications & integrations" (us) and "code audits" (separately fundable!). Tiers: Tier 1 <250K XDC, Tier 2 250K–1M XDC (submitting either requires **burning 500 XDC**); cap 1M XDC/project/year. Quarterly decisions with on-chain "election week" in the last week of each quarter; **submit ≥6 weeks before quarter-end** → for the Q3 window (30 Sep), **submit by ~19 Aug 2026**. Jury demo call required; approval needs 5/6 jury votes; **KYC + verified XDC address mandatory**. Criteria: feasibility, ecosystem impact, team, budget justification, sustainability, milestones.
2. **XVC Tech / XDC Ventures** — $125M fund, first-cheque seed, funds post-MVP only (we qualify). Apply via the form at xvc.tech/apply-for-funding.html. **Key signal: XDC Ventures acquired Contour (Oct 2025)** — the bank LC platform — to "re-energise" it with stablecoins in trade flows. An LC smart contract suite is directly complementary; this is an equity conversation, not a grant, but it's the highest-upside door in the XDC ecosystem.
3. **Accelerators:** "Let's Pivot to XDC" (rolling), 0xCAMP Season 2 (up to $100K token-launch investment), RAKDAO (up to $100K, UAE). ⚠️ Cohort dates on xinfin.org look stale — confirm via `consult@xdc.org` first.

### Positioning

Magnito is the most XDC-native pitch imaginable: XDC is ITFA's first L1 member, the proposed dDOC chain, an IMDA TradeTrust partner, and now owns Contour. Our pitch: *"XDC has the trade finance narrative; Magnito gives it the complete open-source instrument layer — all four instruments, tested, deployed, MLETR-designed — plus interop to settlement rails."* Reference the Contour acquisition explicitly: a re-energised Contour needs LC digitization infrastructure.

### Actions

1. **Deploy all four contracts to XDC mainnet first** (chain ID 50, same toolchain, gas ~0.25 Gwei — total cost well under 1 XDC). Grants don't formally require mainnet, but renewals require on-chain progress and the optics are free.
2. Draft DaoFin Tier 2 proposal (suggest **750K XDC ask**, milestone-mapped to §9 technical completions + an audit line item) on the xdc.dev forum template; complete KYC; acquire 500 XDC to burn; **submit by 19 Aug 2026**.
3. Submit the XVC Tech form in parallel (different framing: company, not project).
4. Email `consult@xdc.org` asking about TradeFinex / XDC Trade Network integration — the eBL product there is the natural integration partner, and a warm Foundation contact helps the DaoFin vote.

---

## 4. VeChain testnet live testing — exact environment setup

The adapter (`bridge/adapters/vechain-adapter.js`) is real — it signs (Secp256k1, VIP-191 delegation envelope) and submits via `ThorClient.sendTransaction()`. What's missing is live configuration, a receipt timeout, and the frontend hookup.

### Setup steps (in order)

1. **SDK: already current — no migration needed.** `package.json` pins `@vechain/sdk-core` and `@vechain/sdk-network` v2.0.7 (the maintained SDK; Connex/thor-devkit were end-of-lifed Dec 2024 and the v2 SDK handles the post-Galactica dynamic fee model). The adapter imports `ThorClient`/`TESTNET_URL` from these — verified.
2. **Endpoints:** testnet REST node `https://testnet.vechain.org` (REST is the preferred native interface; JSON-RPC only via `npx @vechain/sdk-rpc-proxy` locally if needed). The adapter defaults to the SDK's `TESTNET_URL` when `network: "test"` and accepts an `rpcUrl` override. Explorer: `https://explore-testnet.vechain.org/`.
3. **Wallets:** install **VeWorld** (extension), Settings → Networks → testnet. Generate two keys: one *origin* (attestation signer) and one *sponsor* (gas payer).
4. **Fund:** official faucet `https://faucet.vecha.in/` (⚠️ current per-claim limits undocumented — historically ~500 VET + VTHO per 24h; check the UI). VET→VTHO converter for testnet: `https://energy.outofgas.io/#/`. Note: post-Hayabusa (Dec 2025), passive VTHO generation ended — the sponsor wallet needs explicit VTHO top-ups.
5. **Fee delegation — two options:**
   - *Easiest:* vechain.energy hosted sponsorship — create a free Testnet App at vechain.energy → get a VIP-201 delegation URL `https://sponsor-testnet.vechain.energy/by/<projectId>`; fund its deposit wallet with faucet VTHO. (⚠️ An open community sponsor `…/by/90` exists but only "until the pool dries up" — don't depend on it.)
   - *Self-host:* set `VECHAIN_SPONSOR_PRIVATE_KEY` in `.env` (currently **empty** — adapter throws without it, vechain-adapter.js:78) and let the adapter co-sign locally. This is what the adapter already implements; use it for the first run.
6. **Fix before the live run:** add a timeout + max-retries to receipt polling (vechain-adapter.js:209) — today a stalled tx hangs the caller forever.
7. **Live test:** note the VeChain adapter is intentionally **not** registered with the orchestrator (it has no lock/commit/abort interface — see the header comment); it exposes `attestEvent(instrumentId, eventType, metadata, signerWallet)`, `getEvidenceBundle(instrumentId)`, `verifyAttestation(instrumentId, eventType)`. Write `scripts/vechain-live-test.js` that instantiates the adapter and fires all seven `VeChainAdapter.EVENT_TYPES` as attestations for a real eBL id; verify each tx on the testnet explorer; confirm the local index (`data/vechain_attestations.json`) and the evidence-logger bundle capture the seven tx hashes.
8. **Frontend hookup:** the Evidence Trail screen currently renders **seven hardcoded fake events** (index.html:676–709) — replace with a real query of the attestation txs (REST `GET /transactions/{id}` or an evidence index JSON emitted by the logger). This is mandatory before the demo video — showing mocked evidence in a grant demo would be misrepresentation.

### Exact session config and commands

Human-only step first (browser, can't be done from the CLI): claim testnet funds at `https://faucet.vecha.in/` for the **sponsor** address (faucet uses X/Twitter-login certificates), and convert VET→VTHO at `https://energy.outofgas.io/#/` if the sponsor lacks VTHO. Everything else runs in-session:

```bash
# 1. Generate a sponsor keypair (or export one from VeWorld)
node -e "const {Secp256k1,Address}=require('@vechain/sdk-core');(async()=>{const k=await Secp256k1.generatePrivateKey();const h=Buffer.from(k).toString('hex');console.log('key 0x'+h);console.log('addr',Address.ofPublicKey(Secp256k1.derivePublicKey(k)).toString())})()"

# 2. .env — these are the exact keys the repo already defines (.env:5-8)
#    VECHAIN_RPC_URL=https://testnet.vechain.org   (optional; adapter defaults via network)
#    VECHAIN_NETWORK=test
#    VECHAIN_SPONSOR_PRIVATE_KEY=0x...             (REQUIRED — adapter throws if empty, vechain-adapter.js:78)

# 3. Sanity-check connectivity + sponsor balance (REST, no SDK needed)
curl -s https://testnet.vechain.org/blocks/best | head -c 300
curl -s https://testnet.vechain.org/accounts/<SPONSOR_ADDRESS>   # check "energy" (VTHO) > 0

# 4. Fire the live test (after writing scripts/vechain-live-test.js per step 7)
node scripts/vechain-live-test.js --instrument <eBL id>

# 5. Verify a tx independently
curl -s https://testnet.vechain.org/transactions/<TXID>/receipt
```

Adapter constructor args (from `vechain-adapter.js:62-99`): `{ network: "test", rpcUrl?, sponsorPrivateKey, attestationTo?, indexPath? }` — attestations are zero-VET self-transactions to the sponsor address carrying a signed JSON envelope in clause data.

**Pass criteria:** seven distinct attestation txs visible on explore-testnet.vechain.org, fee-delegated (gas payer ≠ origin), referenced by instrument id, and rendered in the frontend from chain data, not constants.

---

## 5. Canton / DAML developer recruitment brief

### The blocking decision first: Daml 2.10 LTS vs Daml 3.x

Our `canton-adapter.js` calls the **classic HTTP JSON API (v1: `POST /v1/create` etc.)**. That API was **deprecated in Daml 3.3 and removed in Daml 3.4** (Canton Network MainNet moved to it Dec 2025). It survives on **Daml 2.10 LTS**, which is still maintained and is what **Daml Hub** (Digital Asset's hosted PaaS) runs.

**Recommendation: target Daml 2.10 LTS + Daml Hub for Phase 2.** Rationale: the adapter works as written, Daml Hub gives hosted infrastructure without running a validator, and the engagement stays small. Write the DAML model portably; budget a v2-API adapter rewrite as a Phase 3 item if/when we want the actual Canton Network (which requires JSON Ledger API v2 + PQS for queries, and the old `@daml/ledger` JS bindings don't work there). The contractor should be told this explicitly.

### Skills required

- Daml proficiency — signal: Digital Asset's **Daml Fundamentals** or **Daml Contract Developer** certification (daml.talentlms.com).
- Daml authorization/privacy model (signatories, observers, choices) — our legal-authority use case is exactly this.
- Classic HTTP JSON API experience (Daml 2.x), plus awareness of the 3.x/v2 migration path.
- Acceptable substitute: a strong **Haskell or Scala** developer (Daml is GHC-derived) willing to cross-train — Fundamentals cert is days-to-weeks.

### Scope of engagement (2–4 weeks, fixed price)

1. DAML model: templates for the four instruments' *legal-authority records* (issuance, transfer of control, lock/unlock for bridge custody, surrender), with the singularity invariant expressed in DAML authorization logic.
2. Field/template names matching what `canton-adapter.js` expects (or a documented config mapping — the adapter takes `packageId`, `instrumentIdField` etc.; today nothing validates the template shape and mismatches surface as opaque HTTP 400s).
3. Local test rig via **cn-quickstart LocalNet** (free, Docker, includes JSON API) or Daml Sandbox; scripted test scenarios.
4. Deployment to **Daml Hub** + a successful end-to-end `issueInstrument`/`lock`/`unlock` cycle driven by our adapter.

### Where to find them

1. **forum.canton.network** — has a dedicated "Daml Jobs" posting category (read the posting-requirements thread first). Also discuss.daml.com (legacy forum, still active).
2. **LinkedIn search** for Daml Fundamentals / Contract Developer certificate holders.
3. **Canton Core Academy** (AngelHack) and **StackUp** "Learn & Earn" Daml quest graduates — newly trained, hungry, cheap.
4. SIs if contracting fails: **IntellectEU** (productized Canton onboarding), Capgemini, Umbrage — expect 5–10× contractor pricing.

### Rates and pitch

⚠️ No public DAML contractor rate data exists. Planning range **$100–200/hr** (inference: above the Solidity band $81–100/hr given scarcity; the one hard datapoint is a $185–195K NY full-time salary). For the scoped engagement above, budget **$15–30K fixed**.

**The pitch:** "Build the legal-authority layer of an open-source, MLETR-designed trade finance protocol — a genuinely novel DAML use case (negotiable instruments, not securities), well-scoped, with a working multi-chain system already live around it. Your model becomes the canonical reference for trade instruments on Canton." Sweetener for the right person: Canton's **featured-app economics** route 62% of Canton Coin minting rewards to application providers until 2029 — if Magnito later runs on Canton Network proper, there's ongoing upside to having built it.

---

## 6. Singapore MLETR legal opinion — scope and firms

### Legal landscape (verified)

Singapore adopted MLETR via the **Electronic Transactions Act, Part 2A** (2021 amendment). The operative tests:

- **s 16H** — an electronic transferable record (ETR) requires a *reliable method* to (i) identify the record as **the authoritative record** (singularity), (ii) render it capable of **control** from creation until it ceases to have effect, (iii) retain **integrity**.
- **s 16I** — possession = a reliable method establishing **exclusive control** by a person *and identifying that person*; transfer of control = transfer of possession.
- **s 16O** — the general reliability standard (MLETR art. 12): operational rules, data integrity assurance, security, audit, declarations by accreditation bodies, industry standards — *or* proof the method in fact fulfilled the function.

**No accreditation scheme exists.** The Act lets the Minister create an ETR-provider accreditation regime (registered providers get a reliability *presumption*), but ⚠️ none has been rolled out as of research date (absence-of-evidence — confirm with IMDA). So the route is exactly what we planned: a reasoned legal opinion that Magnito's method satisfies ss 16H/16I/16O — plus the cheap credibility stack below.

**TradeTrust matters but is not mandatory.** IMDA's open-source framework comes with pre-paid legal work we can stand on: a **legality analysis by Stephenson Harwood/Virtus Law** (Singapore/UK/US law) and the **TradeTrust Model Terms (free, drafted by Watson Farley & Williams, launched March 2025)** which have already carried multiple platforms through IG P&I approval. Adopting the Model Terms shrinks the bespoke-opinion scope substantially.

### Questions the opinion must answer (give this list to the firm as the instruction letter skeleton)

1. Does the bridge's exclusive-control mechanism — on-chain lock on the source chain + 2PC commit such that exactly one chain is authoritative — constitute a "reliable method" identifying *the* authoritative record under s 16H(1)(b)(i)?
2. Does wallet-key control of the instrument token satisfy s 16I exclusive control, and does the holder-identification scheme satisfy the "identifies that person" limb? What KYC/identity layer (if any) is needed? (Note: XRPL Credentials / Permissioned Domains from §2-M1 may be part of the answer.)
3. **The lock-window question (novel, ours specifically):** during the 2PC bridge window when the source instrument is locked and the target not yet issued, where does control reside? Does a transient state breach the "from creation until it ceases to have effect" continuity requirement of s 16H?
4. Does cross-chain re-issuance (burn/lock on chain A, mint on chain B) constitute a *transfer* of the same ETR, an *amendment* (s 16L), or a *replacement* (change of medium) — and what follows from each characterization?
5. Which of our four instruments are Part 2A ETRs at all? (eBL: yes, core case. **Bill of Exchange: must also be analysed against the Bills of Exchange Act 1949 (Sing.)** — and against the ITFA ePU contract-law fallback structure if statutory BoE status fails.)
6. Mapping of our architecture to each s 16O reliability factor — producing the evidence matrix that also feeds the ICC DSI assessment (§7).
7. Governing law and conflicts: what must the instrument's terms say for Singapore law (and Part 2A) to govern an instrument whose token lives on a public chain with foreign counterparties?
8. Does adopting the TradeTrust Model Terms (adapted) change any of the above answers, and should Magnito integrate with TradeTrust technically to inherit its analysis?

### Firms to approach (in order)

1. **Stephenson Harwood (Virtus Law) Singapore — first choice.** They wrote IMDA's TradeTrust legality analysis; contact **Daryll Ng** (Singapore Managing Partner). They can reuse their own work product → cheapest path to a strong opinion.
2. **Watson Farley & Williams Singapore** — drafted the TradeTrust Model Terms; contact **Damian Adams MBE**.
3. **HFW Singapore** (shipping bench, multiple eBL publications) — good for a cheaper memo-level engagement.
4. **Allen & Gledhill / Rajah & Tann** — both published on ETA Part 2A; local heavyweights if the above decline.
5. **Cheap first step: NUS Centre for Maritime Law** — **Prof Stephen Girvin** (blockchain & bills of lading) and the CML working-paper authors analysed s 16H academically. A commissioned academic memo (low five figures) can pressure-test the architecture *before* paying City rates, and flags the hard questions for the firm.

### Cost, timeline, staging

⚠️ No published fee data exists for opinions of this type; planning assumption (unverified): **S$50K–S$200K+, 6–12 weeks** for a full reasoned opinion; a non-reliance memo at a fraction. **Staged plan — the workstream starts week 1, in parallel with (not after) the institutional outreach:** (a) the scope is already drafted — the eight-question list above *is* the instruction-letter skeleton; (b) adopt TradeTrust Model Terms now (free); (c) complete the ICC DSI reliability self-assessment (§7, free) to build the s 16O evidence pack; (d) **send scoping enquiries to Stephenson Harwood (Daryll Ng) and WFW (Damian Adams) in weeks 2–4** — a scoping call, conflict check, and fee quote cost nothing, put a real number against the budget lines in both grant applications, and mean the engagement letter can be signed the day funding lands rather than starting a 6–12 week firm-selection process then; (e) NUS CML memo; (f) the paid opinion, limited to the questions the memo couldn't resolve. Only step (f) waits for money; nothing waits for the institutional conversations to mature — if anything, being able to tell Casterman "we have Stephenson Harwood scoping a Part 2A opinion" strengthens that conversation, not the reverse. Budget line in the XRPL grant: $40K; in DaoFin: a dedicated milestone.

**MAS Project Guardian** (the README roadmap item): 40+ participants, current workstreams are fixed income / FX / funds — ⚠️ trade finance (the old StanChart receivables pilot) is no longer a named workstream. Realistic entry is via a member FI or association, not directly. Action: register interest on the MAS page, then park it; the legal opinion and an ITFA bank relationship are prerequisites to being interesting to MAS anyway.

---

## 7. ICC DSI certification — what Enigio actually did, and our replication plan

### What the ICC DSI actually offers (corrected understanding)

There is **no formal accredited certification yet**. What exists: the **Digital Trade Reliability Assessment**, co-developed by ICC DSI and Canada's **Digital Governance Council (DGC)** — a questionnaire-based assessment of conformity with the MLETR Art. 12 "reliable system" criteria (security, resilience, data protection, integrity, authentication), finalised Oct 2024. It yields a **"statement of verification"** — explicitly an interim acknowledgement, with third-party accreditation planned. ⚠️ Check whether full accreditation launched by the time we apply.

Operationally it runs as **"TradeReady Verification"** under DGC's Digital Trust Program: Engagement (application/scoping) → Review (evidence gathering, ~2 weeks) → Evaluation (verification statement + badge + registry listing). **Listed cost: $250** (⚠️ likely CAD and possibly just an application fee — confirm with DGC). The verified registry already includes SECRO, CargoX, GSBN, IQAX, Credore, SynergAI, BlockPeer — note **BlockPeer is also an XRPL Accelerator company**: this verification is becoming table stakes in exactly our niche.

### The Enigio playbook (the company is Enigio, product trace:original)

Their sequence, 2019→2024: joined ITFA as DNI tech partner (2019) → featured in the DNI paper (2020) → **self-declared dDOC compliance, endorsed by ITFA** (Sept 2020) → co-authored the DNI Handbook 2nd ed. (2021) → **Lloyds Bank pilots**: first UK digital promissory note (2022), first digital bill of exchange with Mercore (Feb 2023) → A&O Fuse legaltech cohort (2023) → **Lloyds invests €3M** + first UK ETDA transaction (Sept 2023) → CargoX interop pilot with ICC C4DTI (2023) → **IG P&I approval as 12th eBL provider** (April 2024) → **first system verified under the ICC DSI/DGC reliability assessment** (Nov 2024). Supporting: ISO 27001, memberships (ITFA/BAFT/FIATA/BIMCO/DCSA), patents.

⚠️ Important correction to our notes: **no public Enigio-commissioned legal opinion was found.** The English-law analysis they ride on is **Sullivan's work for ITFA** (the ePU structure in the DNI Handbook appendices). Lesson: ITFA membership buys access to shared legal scaffolding — another reason §1 comes first.

### Magnito replication plan (sequenced, cheap-first)

1. **Now ($250, ~2 weeks):** download the DGC TradeReady questionnaire, map every criterion to our architecture (this mapping doubles as the s 16O evidence matrix for §6), fix the gaps it exposes, apply for verification. Being on the same registry as CargoX/GSBN for $250 is the single cheapest credibility purchase available to us.

   **Pre-mapping of the assessment's five published criterion areas to Magnito's current state** (the executor refines this against the actual questionnaire):

   | MLETR Art. 12 criterion area | Magnito today | Gap to close before applying |
   |---|---|---|
   | Security of hardware/software | Testnet keys in `.env`, placeholder key accepted silently | Key validation + documented key-management policy (§9) |
   | Resilience / operational rules | 2PC logic exists but state is in-memory; no recovery runbook | Orchestrator persistence + abort-failure handling + written ops procedure (§9) |
   | Data storage & protection | Evidence logger writes plain JSON, no error handling, no tamper-evidence | Write-error handling + hash-chained or signed evidence bundles (§9) |
   | System integrity | Strong on-chain (contract state, 118 tests) | Bridge/adapter test suite so the *off-chain* components have integrity evidence too (§9) |
   | User authentication / identification | Wallet-key control only; no identity layer binding person→key | Document the identity model honestly; XLS-70 Credentials work (§2-M1) is the roadmap answer |
2. **With §1:** publish a dDOC-alignment statement for the Bill of Exchange contract (Enigio's was a self-declaration endorsed by ITFA — precedent for a lightweight path, via the Fintech Committee).
3. **Later (Phase 2 end / Phase 3):** ISO 27001 (only when there's an actual organization to certify); IG P&I "deemed approval" route for the eBL (criteria now: MLETR-law compliance + reliability evidence — both produced by steps above); first pilot transaction with an ITFA member bank, co-published with ITFA/TFG.

**Research tasks for the executor:** fetch the DGC questionnaire and registry requirements from dgc-cgn.org/dtp/; confirm fee and whether accreditation has superseded the interim statement; produce the criterion→architecture mapping document.

---

## 8. The two-computer live test — exact script

**Purpose:** prove, on camera, that Magnito instruments are *shared, exclusive-control state* — not a local demo. Two machines, two humans-worth of roles, zero shared infrastructure beyond the public testnets. **The recording, cut to 2 minutes, is the demo video required by the XRPL grant application (§2).**

### Setup

- **Computer A — "Shipper/Carrier":** own MetaMask profile, wallet `W_A`, funded with TXDC from the Apothem faucet. Serves the frontend locally (`cd frontend && npx serve .`).
- **Computer B — "Bank Officer":** *different machine, different network if possible (e.g., phone hotspot)*, own MetaMask, wallet `W_B`, funded with TXDC. Serves its own copy of the frontend locally — the two machines must share **nothing** except the chain.
- Both on XDC Apothem (chain id 51; the frontend auto-switches). Prerequisite: §4 step 8 done (real evidence trail), or explicitly skip the evidence screen on camera.
- Screen-record both machines (QuickTime/OBS), clocks visible.

### Script

| # | Machine | Action | Expected result / PASS condition |
|---|---|---|---|
| 1 | A | Connect wallet, open Dashboard | Dashboard shows current on-chain eBL/invoice counts |
| 2 | B | Connect wallet, open Dashboard | **Same counts as A** — two independent machines read identical state |
| 3 | A | Issue eBL: vessel *MV Magnito Express*, Shanghai→Rotterdam, holder = `W_A`, fresh doc hash | Tx confirms; eBL #N appears with holder `W_A`, status Active |
| 4 | B | Refresh Dashboard (no action by A) | **eBL #N visible on B within ~1 block (~2s)** with correct fields — state propagated, not local |
| 5 | B | Attempt `transferEBL(N, W_B)` from `W_B` (via Instruments screen or console) | **Transaction REVERTS** — B is not the holder. This is the exclusive-control negative test; a revert here is a PASS |
| 6 | A | `transferEBL(N, W_B)` | Confirms; holder now `W_B` on both screens |
| 7 | A | Attempt `transferEBL(N, W_A)` again from `W_A` | **REVERTS** — A no longer controls the instrument it created. Singularity of control demonstrated |
| 8 | B | `pledgeEBL(N, <pledgee addr>)` then `unpledgeEBL(N)` | Status cycles Active→Pledged→Active; only B (holder) can do this |
| 9 | A | Run `node bridge/run-bridge.js` (Invoice, Sepolia→XRPL) in terminal | 2PC completes: lock on Sepolia, issue on XRPL; evidence log prints lock/issue/finalize steps with tx hashes |
| 10 | B | Independently verify step 9: source invoice status = Locked on Sepolia Etherscan; target object visible on XRPL testnet explorer (testnet.xrpl.org) using only the hashes A reads out | **Both artifacts visible from B's machine via public explorers** — one locked source, one live target, never two active versions |
| 11 | A or B | Open Evidence Trail for eBL #N | Real attestation data renders (post-§4); hashes match explorer |

### Overall pass = all of:

1. State created on one machine is visible on the other without any shared backend (steps 2, 4, 10).
2. Every unauthorized action **reverts** (steps 5, 7) — the reverts are the headline, not the happy path.
3. At no point do two chains both show an *active* version of the bridged instrument (step 10).
4. Complete recording exists from both machines; clip a 2-minute cut: step 3 → 4 → 5 (revert!) → 6 → 10.

**Known weakness to fix before recording:** if step 9's XRPL leg fails mid-flight, the orchestrator's state is in-memory only (§9) — a crash leaves the Sepolia invoice locked with no recovery path. Either harden first or have the manual-unlock script ready off-camera.

---

## 9. Technical completions (repo-verified gap list)

From a code-level scan; ordered by what blocks the plan above.

| Gap | Where | Blocks | Effort |
|---|---|---|---|
| **No DAML model in repo** — adapter assumes templates that don't exist; no shape validation (opaque 400s on mismatch) | `bridge/adapters/canton-adapter.js:46–70` | §5 entirely | The §5 engagement |
| **Frontend evidence trail is fake** — 7 hardcoded events, never queries VeChain | `frontend/index.html:676–709` | §4, §8 demo video (would be misrepresentation) | 2–3d |
| **Orchestrator state in-memory only** — crash mid-2PC orphans locked instruments; no recovery/journal | `bridge/orchestrator.js:16,115–140` | §8 step 9 reliability; any grant milestone | 2–3d |
| **No timeouts anywhere** — `tx.wait()` / receipt polling can hang forever | `evm-adapter.js:51`, `xrpl-adapter.js:73`, `vechain-adapter.js:209` | §4, §8 | 1–2d |
| **Zero tests for bridge/adapters/orchestrator** (the 118 tests cover only the 4 contracts); `npm test` is a stub that exits 1 | `test/`, `package.json:6` | every grant's "code quality" criterion | 3–5d |
| **Placeholder private key** (`0x000…001`) accepted silently; VeChain sponsor key empty | `.env:3,8`, `run-bridge.js:30,60` | §4; basic hygiene | 2h |
| Abort failure unhandled (if rollback also fails → stuck, no alert) | `orchestrator.js:131` | §8 robustness | 1d |
| ISO 20022 adapter is template-string output, no XSD validation, no parse path | `scripts/iso20022-adapter.js` | bank conversations only — defer to late Phase 2 | 1–2d |
| Hardcoded contract addresses in frontend; no config | `index.html:397–418` | mainnet deploy (§3) | 2h |
| Evidence logger: no write-error handling, no tamper-evidence | `scripts/evidence-logger.js:67` | §7 reliability evidence | 4h |
| XDC mainnet deployment | — | §3 | hours, <1 XDC |

---

## 10. Sequencing — everything around the Casterman outreach

```
WEEK 1 (now)
  ★ §1  ITFA membership application + Casterman LinkedIn message   ← THE action
  ▸ §2  Email RippleXEcosystem@ripple.com + info@xrplgrants.org (notify-on-reopen)
  ▸ §7  Download DGC TradeReady questionnaire; start criterion mapping
  ▸ §9  Quick fixes: key validation, sponsor key, frontend config (≤1 day total)

WEEKS 1–3 — make the prototype demonstrable
  ▸ §4  VeChain live environment + adapter timeout fix + real evidence trail
  ▸ §4  VeChain ecosystem relationship entry (parallel to XDC's, not after it):
        create the vechain.energy app, engage VeChain dev relations with the
        live attestation use case; ⚠️ research VeChain Foundation / VeBetterDAO
        grant programs (not yet researched — executor task, same template as §3)
  ▸ §9  Orchestrator persistence + adapter timeouts + bridge test suite
  ▸ §3  Deploy all four contracts to XDC mainnet
  ▸ §8  Rehearse two-computer test → record → cut 2-min demo video

WEEKS 2–4 — applications (all reuse the §8 video + §7 mapping)
  ▸ §7  Submit DGC TradeReady Verification (~$250)
  ▸ §2  Aquarium Cohort 9 application            ⏰ HARD DEADLINE 23 AUG 2026
  ▸ §3  DaoFin Tier 2 proposal + KYC + 500 XDC   ⏰ SUBMIT BY ~19 AUG 2026 (Q3)
  ▸ §3  XVC Tech application (Contour angle)
  ▸ §6  Legal workstream in parallel: adopt TradeTrust Model Terms (free) +
        scoping enquiries to Stephenson Harwood (Daryll Ng) and WFW (Damian
        Adams) — fee quotes feed both grant budgets; engagement-ready on funding
  ▸ §5  Post DAML brief on forum.canton.network Jobs + LinkedIn cert search

WEEKS 4–8 — build on whatever §1 opened
  ▸ §5  DAML contractor engagement (2–4 wks): model + Daml Hub + adapter E2E
        💰 CASH-GATED — sign only when funded or consciously self-funded (below)
  ▸ §2  Finish full XRPL package (MPT migration plan, sustainability plan) — ready to fire
  ▸ §6  NUS CML academic memo commissioned (💰 gated — see cash-flow note)
  ▸ §1  Follow Casterman's thread: DNI Initiative participation, dDOC statement, intro to a member bank

WEEKS 8–16 — the expensive steps, now de-risked
  ▸ §6  Scoped Stephenson Harwood (Daryll Ng) opinion — instruction letter = §6 question list + CML memo + DGC evidence pack
  ▸ §2/§3  Respond to grant program reopenings / jury calls
  ▸ §7  Begin IG P&I deemed-approval prep if a bank pilot is in sight
```

**Why this order:** the Casterman outreach costs €1,500 and an afternoon, has the longest relationship lead-time, and every later artifact (grant narratives, dDOC statement, legal opinion instruction letter, bank pilot) either cites it or flows from it. The demo video and DGC verification are the two cheap multipliers — each is consumed by at least three downstream applications. The legal-opinion **workstream runs in parallel with the institutional outreach from week 1** (the §6 scope is already drafted; Model Terms adoption and firm scoping calls are weeks 2–4 — they cost nothing and strengthen the Casterman conversation); only the **paid engagement** sits late in the schedule, because it's the most expensive item and the CML memo + Model Terms + DGC evidence pack shrink its scope before a firm ever bills an hour.

**Parallel tracks — what blocks what:** The DAML/Canton gap blocks **only the Canton leg**. Nothing else in this plan touches it: the two-computer test, demo video, both grant applications, the DGC verification, the VeChain live test, and the legal opinion all run on XDC/XRPL/VeChain/Sepolia, and the Canton adapter's absence of a deployed model is disclosed honestly in the README already. If DAML recruitment takes three months, zero other items slip. Likewise the **XDC and VeChain tracks are siblings, not a sequence** — both the technical work (mainnet deploy / live attestations) and the relationship work (consult@xdc.org + DaoFin / vechain.energy + dev relations) start in the same weeks-1–3 block; neither waits on the other.

**Cash-flow reality (grant money arrives after the work is scheduled):** Earliest possible grant cash is the DaoFin Q3 vote — decision ~30 Sep 2026, disbursement after KYC, so **October at best**. XRPL is worse: the program is closed with no reopening date, and Aquarium (if accepted) starts late September with unpublished funding. Therefore: everything in weeks 1–4 is deliberately cheap (≈ €1,500 + $250 + gas — affordable without any grant); the **DAML engagement ($15–30K) is cash-gated** — sign the contractor when the first grant approval lands, or earlier only as a conscious self-funded decision (the recruitment *search* costs nothing and starts in weeks 2–4 regardless, so funding-day-to-start-day is short); the **NUS CML memo is the decision point** — commission it self-funded if §1 has produced real ITFA traction, otherwise hold for grant funds; the **firm opinion is strictly grant-funded** (it's a milestone line item in both applications, and no application requires it to exist first — they fund it). Nothing in this plan stalls if grant money takes until Q4 2026: the sequence degrades gracefully to relationship-building + self-funded cheap items, with the expensive steps queued behind funding events.

**Budget snapshot (pre-grant cash out):** ITFA €1,500 · DGC ~$250 · 500 XDC burn + mainnet gas ~nil · DAML contractor $15–30K (gated) · CML memo low-five-figures (gated) · firm opinion S$50–200K (⚠️ unverified estimate — grant-funded, staged). Only the first three items are spent before a funding event.
