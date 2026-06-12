# XRPL Foundation Grant Application — Draft

**Target programs (per PHASE2.md §2, verified June 2026):**
1. **XRPL Commons Aquarium Cohort 9** — confirmed open, deadline **23 August 2026**, program 28 Sep–26 Nov 2026 (Paris, 4 days/week on-site). Apply here first — it is the only confirmed open window.
2. **FinTech Builder Program** — no public application mechanism yet; email `RippleXEcosystem@ripple.com` and `info@xrplgrants.org` to register interest and request notify-on-open.
3. **Legacy RippleX Grants / Accelerator** — closed as of June 2026; keep the full package ready to submit the day they reopen.

**Ask:** $150,000–$180,000 (milestone-based). Do not ask $200K on a first application.

---

## Project Title

**Magnito — Open-Source MLETR-Designed Trade Finance Instruments on XRPL**

---

## Executive Summary (≤200 words)

Magnito is an open-source protocol that digitizes the four core trade finance instruments — Invoice, electronic Bill of Lading (eBL), Letter of Credit, and Bill of Exchange — as legally structured smart contracts on XDC Network, then bridges them to XRPL for settlement.

The XRPL integration implements trade finance's most critical unsolved problem: keeping exactly one authoritative version of an instrument alive across chains. The bridge uses a two-phase commit protocol that locks the source instrument before minting the XRPL representation, so the MLETR singularity requirement is preserved by the protocol, not by trust.

Current state: working prototype, 118 passing tests across all four contracts, deployed on XDC Apothem and Ethereum Sepolia, with adapters for XRPL testnet, VeChain (shipping event attestation), and Ethereum (dispute resolution). The Bill of Exchange contract is aligned with ITFA's DNI/dDOC framework — the same standard that named XDC as preferred chain. The XRPL settlement leg is designed for RLUSD and the upcoming XLS-66 Lending Protocol amendment.

This grant funds the upgrade from a working prototype to an MPT-native, KYC-gated, institutionally credible trade finance layer on XRPL.

---

## Problem

Global trade finance runs on paper: wet-ink bills of lading, manually processed letters of credit, fax-signed bills of exchange. The inefficiency is well-documented:

- **$1.7 trillion** trade finance gap (ADB/WTO) — the financing SMEs need but cannot access
- **Days to weeks** to process a paper bill of lading
- **$8B+ annual fraud losses** from document duplication (ICC estimates)

Existing digital platforms (Contour, Bolero, komgo) are closed ecosystems that cannot interoperate. A digital eBL on one platform is inaccessible on another. XRPL has the settlement rails, the institutional relationships, and the regulatory credibility — but no open-source instrument layer that connects to it.

---

## Solution

Magnito is not another platform. It is the **instrument layer** — the code that defines what a Bill of Exchange or eBL *is* on-chain — built to be composable with XRPL's settlement primitives.

**Four instruments, all deployable to XDC, all bridgeable to XRPL:**

| Instrument | Tests | Key XRPL integration |
|---|---|---|
| Invoice / Receivable | 21 | Trustline IOU → MPT migration planned |
| Electronic Bill of Lading | 25 | NFT-based transfer, bridge to XRPL |
| Letter of Credit | 29 | eUCP v2.1, bank settlement via RLUSD |
| Bill of Exchange | 34 | ITFA DNI-aligned; XRPL discounting path |

**The MLETR singularity mechanism** is the core technical contribution: a 2-phase commit bridge that locks the instrument on XDC before minting the XRPL representation. At no point do two chains both show an active version of the same instrument. This is the direct technical implementation of UNCITRAL MLETR Art. 10 — the legal standard that makes electronic trade documents equivalent to paper.

**XRPL is the settlement layer for the whole stack.** Settlement of instrument value — payment under a letter of credit, discounting of a receivable, financing against a pledged eBL — runs on XRPL. The instrument contract defines the right; XRPL executes the payment.

---

## XRPL Integration Rationale

Trade finance is one of four explicitly named XRPL priority use cases. Magnito builds native integrations with XRPL's 2026 feature set:

- **MPTs (XLS-33):** receivables and eBLs represented as Multi-Purpose Tokens with transfer restrictions — the exact model used by Fortstock ($150K XRPL grant). MPT metadata carries the instrument hash and status, preserving legal integrity on-chain.
- **Credentials (XLS-70) + Permissioned Domains (XLS-80):** KYC-gated instrument transfer — only credentialed parties can hold an eBL or accept a payment under an LC. This is the compliance layer institutional users require.
- **RLUSD settlement:** the payment leg of every instrument lifecycle — LC drawdown, invoice financing, eBL pledge release — settles in RLUSD on XRPL.
- **XLS-66 Lending Protocol:** the invoice financing flow is designed to align with XRPL's native lending amendment (entered validator voting Jan 2026). If the amendment activates before M3, Magnito receivables plug directly into the XRPL-native credit market.

**What no other XRPL project has:** a legal grounding. The eBL and Bill of Exchange contracts are designed to MLETR and ITFA DNI specifications, with a Singapore legal opinion on the bridge's control mechanism in the roadmap (funded under M4). XRPL has fast settlement; Magnito gives it the instrument layer that banks and trading parties actually need to transact legally.

---

## Team

- **Jonathan Murray** — sole developer, prototype author. Built all four contracts (118 tests), the bridge orchestrator (2PC with XRPL/EVM/VeChain/Canton adapters), and the five-screen frontend. Background: [complete before submitting].
- **DAML contractor** — Canton/legal authority layer (recruitment in progress, §5 of roadmap).
- **Legal adviser** — Stephenson Harwood (Virtus Law) Singapore scoping (inquiry sent / to be sent).

---

## Milestones

### M1 — XRPL Technical Upgrade ($50,000 · months 1–3)
- Migrate Invoice and eBL representations from trustline IOUs to **MPTs (XLS-33)** with transfer restrictions and instrument-hash metadata
- Add **Credentials (XLS-70) + Permissioned Domains (XLS-80)** to all four instruments — only credentialed counterparties can hold or transfer
- Implement RLUSD settlement leg: LC drawdown, invoice payment, eBL pledge release
- Full XRPL adapter and MPT test suite
- Deliverable: working MPT-based trade instruments on XRPL testnet

### M2 — Bridge Hardening ($40,000 · months 2–5)
- Orchestrator persistence: replace in-memory 2PC state with durable journal (SQLite or JSON-WAL)
- Adapter timeouts and retry logic for all three adapter types (EVM, XRPL, VeChain)
- Full bridge/adapter/orchestrator test suite — closes the gap between 118 contract tests and zero bridge tests
- Abort-failure handling: if rollback also fails, emit alert and log recovery path
- Deliverable: bridge that survives restarts without orphaning locked instruments

### M3 — Receivables Financing on XLS-66 ($30,000 · months 4–8)
- Align Invoice financing workflow with the **XLS-66 Lending Protocol** (pending amendment activation)
- Invoice as collateral for XRPL-native credit — the receivable is the security, RLUSD is the loan
- Deliverable: end-to-end invoice financing flow from XDC (instrument creation) to XRPL (lending draw)

### M4 — Legal Opinion Co-Funding + Pilot ($40,000 · months 6–12)
- Partial funding of Singapore MLETR legal opinion (Stephenson Harwood / Virtus Law, instructed on the eight questions in the roadmap legal scope)
- Two-party live pilot with evidence bundles: eBL issued on XDC, attested on VeChain, settled on XRPL, verified by independent party
- ICC DSI/DGC TradeReady Verification submitted (in progress — $250, 2 weeks)
- Demo video (two-machine test, 2 minutes) published
- Deliverable: a verified, legally-grounded live pilot; foundation for bank conversations

---

## Financial Sustainability

Magnito's long-term model is **infrastructure licensing / SaaS**:

1. **Per-instrument fee** to platforms (digital trade platforms, supply chain SaaS, factoring companies) that integrate the Magnito contracts to issue instruments for their users. Target: $5–50 per instrument issued, volume-priced.
2. **Bank integration fee** to financial institutions that want to hold or accept instruments in their custody/financing workflows. Recurring annual license.
3. **XDC/XRPL ecosystem channel:** the XDC Foundation (via DaoFin) and XRPL grants are both live funding streams; Magnito's roadmap items align with both ecosystems' stated priorities, so parallel grant tracks remain open through Phase 2.
4. **ITFA member bank pilots:** the Enigio precedent ($3M investment from Lloyds after the ITFA → pilot → legal endorsement path) is the highest-upside scenario. The ITFA track (§1 of roadmap) is in progress.

The grant funds the infrastructure to reach the point where bank conversations make sense — legally grounded, testnet-proven, KYC-gated — not an ongoing subsidy.

---

## Repository

github.com/txtsongs/magnito — MIT License, v1.0-prototype tagged.

Live deployments: XDC Apothem (four contracts) · Ethereum Sepolia (four contracts) · XRPL testnet (live bridge runs, invoice adapter)

---

## Closest funded analogue

**Fortstock** ($150K, France, XRPL Accelerator Batch VII) — warehouse receipts as MPTs for trade finance lending. Magnito extends this model to all four core trade finance instruments, adds the legal grounding (MLETR/DNI alignment), and introduces cross-chain singularity for the instrument lifecycle.

---

## Alignment checklist (for narrative)

- [x] Trade finance — named priority use case
- [x] MPTs (XLS-33) — M1 deliverable
- [x] RLUSD — settlement layer in every milestone
- [x] Credentials/Permissioned Domains (XLS-80) — KYC compliance in M1
- [x] XLS-66 Lending Protocol — M3 deliverable
- [x] MLETR legal grounding — no other funded XRPL project has this
- [ ] 2-minute demo video — needed before submission (two-computer test, §8 of roadmap)
- [ ] Financial sustainability plan — included above, refine before submitting
- [ ] Aquarium Cohort 9 feasibility — confirm 4 days/week in Paris (28 Sep–26 Nov 2026) is workable

---

## Submission checklist

Before submitting to any XRPL program:

1. Record the two-computer live test video (2 minutes, two machines, two wallets, zero shared backend)
2. Complete ICCDSi/DGC TradeReady Verification application (~$250 — submit now)
3. Confirm ITFA membership application is submitted (cite in narrative as "incoming ITFA member")
4. Fill in the team background section
5. Verify XLS-66 amendment activation status at time of submission
6. Confirm Aquarium Cohort 9 on-site Paris commitment is feasible
7. Email `RippleXEcosystem@ripple.com` + `info@xrplgrants.org` now — introduce Magnito and request notify-on-reopen for FinTech Builder / legacy programs
