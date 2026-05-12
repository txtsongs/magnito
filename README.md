# Magnito

> *Magnito is the interoperability layer trade finance has been missing — making digital instruments travel freely between institutions, platforms, and blockchains the way email travels between mail providers, without forcing anyone to join another closed ecosystem.*

---

## What is Magnito?

Magnito is the interoperability layer for trade finance. It digitizes trade finance instruments — Invoices, electronic Bills of Lading (eBLs), Letters of Credit (LCs), and Bills of Exchange — on a legally compliant blockchain, then bridges them across chains for liquidity, financing, and settlement.

The global trade finance system still runs largely on paper. Physical bills of lading. Wet-ink letters of credit. Manually processed invoices. This causes delays measured in days or weeks, creates massive fraud risk, excludes small businesses from financing, and fragments liquidity across siloed platforms that cannot talk to each other.

Magnito is not another closed platform. It is the infrastructure layer that connects existing platforms — the way email connects Gmail and Outlook without forcing anyone onto the same system.

---

## The Problem

- **$30 trillion** — the annual size of the global trade finance market
- **$1.7 trillion** — the trade finance gap (ADB/WTO) — financing that SMEs need but cannot access
- **40%** — the rejection rate for SME trade finance requests vs 17% for large corporates
- **Days to weeks** — the time it takes to process a paper bill of lading
- **Fragmented** — existing digital platforms are siloed and cannot interoperate

---

## The Solution

Magnito connects four specialized layers:

**XDC Network — Tokenize the Right**
All four trade finance instruments live here as legally structured smart contracts. Trade finance native. MLETR aligned. Zero friction deployment.

**VeChain — Attest the Reality**
Real-world events are attested here — goods packed, inspection passed, vessel departed, delivery confirmed. Signed by verified party wallets. The operational truth layer that financing logic queries before releasing funds.

**XRP Ledger — Settle the Payment**
Public liquidity rail. eBLs represented as NFTs. Receivables as trustline-gated IOUs. Fast, low-cost cross-border settlement. Long-term: RLUSD for on-chain payment.

**Ethereum — Enforce the Dispute**
Master agreement logic, collateral enforcement, syndicated participation registry, high-value final settlement.

**Bridge Orchestrator — Chain-Agnostic 2-Phase Commit**
Moves instruments between chains while guaranteeing only one authoritative version exists at any time — the direct technical implementation of MLETR singularity.

---

## Instruments

| Instrument | Description | Tests | Status |
|---|---|---|---|
| Invoice / Receivable | Tokenized trade invoice with seller, buyer, amount, document hash, lock/unlock for bridge | 21 passing | ✅ Deployed |
| Electronic Bill of Lading (eBL) | Digital title to goods — transferable, pledgeable, MLETR-aligned singularity | 25 passing | ✅ Deployed |
| Letter of Credit (LC) | Bank payment guarantee — eUCP v2.1, 5-day examination window, discrepancy handling | 29 passing | ✅ Deployed |
| Bill of Exchange | Digital negotiable instrument — ITFA DNI aligned, transferable, discountable, legally enforceable | 34 passing | ✅ Deployed |

**118 passing tests across all four contracts.**

---

## Architecture

CANTON (DAML)          Legal authority layer — Phase 2
↕
BRIDGE ORCHESTRATOR    Chain-agnostic · 2-phase commit · adapter pattern
↕
XDC NETWORK            Primary instrument layer — all four contracts
↕
VECHAIN                Evidence and attestation layer — real-world events
↕
XRPL                   Settlement and liquidity layer
↕
ETHEREUM               Dispute and high-value fallback

The fundamental rule: at any moment, only one ledger is authoritative for a given instrument.

---

## Regulatory Alignment

- **UNCITRAL MLETR** — singularity, control, and integrity of electronic transferable records
- **UK Electronic Trade Documents Act 2023** — full legal possession rights for digital eBLs
- **Singapore Electronic Transactions Act Part IIA (2021)** — primary pilot jurisdiction
- **ICC UCP 600 / eUCP v2.1** — electronic presentation rules for Letters of Credit
- **ICC Digital Standards Initiative (DSI)** — designing toward certification from day one
- **ITFA DNI** — Digital Negotiable Instruments initiative — Bill of Exchange aligned
- **ISO 20022** — bank messaging standard — pain.001 and camt.054 stubs generated from bridge events

---

## Live Deployments

| Network | Contract | Address |
|---|---|---|
| Ethereum Sepolia | Invoice.sol | [0xD752F870...FbE093](https://sepolia.etherscan.io/address/0xD752F870Db8eBF90eD87dD5115D4C62980FbE093) |
| Ethereum Sepolia | BillOfLading.sol | [0xE1A9763e...800a5](https://sepolia.etherscan.io/address/0xE1A9763e3Ee31C930467709E9E2a7d3554c800a5) |
| Ethereum Sepolia | LetterOfCredit.sol | [0xE64377...41Ad96](https://sepolia.etherscan.io/address/0xE64377265CCf5d866b73F77345e706C3Bd41Ad96) |
| Ethereum Sepolia | BillOfExchange.sol | [0x5A6890...85CC0B](https://sepolia.etherscan.io/address/0x5A689090af40B7f5829D300A52fc80b8E885CC0B) |
| XDC Apothem | Invoice.sol | [0x71B2d0...AF18](https://explorer.apothem.network/address/0x71B2d0Bdb72dDB416930fDEc4bCa4DbF53288AF18) |
| XDC Apothem | BillOfLading.sol | [0x5a19ee...7fD5](https://explorer.apothem.network/address/0x5a19eecd02Ea90da89B1a21C8D616191e8dc7fD5) |
| XDC Apothem | LetterOfCredit.sol | [0x414628...C70](https://explorer.apothem.network/address/0x414628DDdFbBd7c5E42195aE245f507BCaA85C70) |
| XDC Apothem | BillOfExchange.sol | [0xC03466...F50](https://explorer.apothem.network/address/0xC034668469C37Eaa81610B359503220d588C3F50) |

---

## Repository Structure


magnito/
├── contracts/
│   ├── Invoice.sol           # Tokenized trade invoice — 21 tests
│   ├── BillOfLading.sol      # Electronic Bill of Lading — 25 tests
│   ├── LetterOfCredit.sol    # Letter of Credit — 29 tests
│   └── BillOfExchange.sol    # Bill of Exchange — 34 tests
├── bridge/
│   ├── orchestrator.js        # Chain-agnostic 2PC engine
│   ├── run-bridge.js          # Live bridge runner
│   └── adapters/
│       ├── evm-adapter.js     # Covers all EVM chains
│       ├── xrpl-adapter.js    # XRPL testnet adapter
│       ├── vechain-adapter.js # VeChain testnet — evidence and attestation (VIP-191 fee delegation)
│       └── canton-adapter.js  # Canton — legal authority layer via DAML JSON API
├── scripts/
│   ├── deploy.js             # Deployment script
│   ├── evidence-logger.js    # VeChain evidence bundle logger
│   └── iso20022-adapter.js   # ISO 20022 message stubs
├── test/
│   ├── Invoice.js
│   ├── BillOfLading.js
│   ├── LetterOfCredit.js
│   └── BillOfExchange.js
├── frontend/
│   └── index.html            # Five-screen interface
└── hardhat.config.js

---

## Getting Started

### Prerequisites
- Node.js v18+
- Git
- MetaMask browser extension

### Installation

```bash
git clone https://github.com/txtsongs/magnito.git
cd magnito
npm install
```

### Run Tests

```bash
npx hardhat test
```

### Run Frontend

```bash
cd frontend
npx serve .
```

Open `http://localhost:3000` in Chrome with MetaMask on XDC Apothem (Chain ID 51).

### Deploy to XDC Apothem

```bash
npx hardhat run scripts/deploy.js --network xdcApothem
```

---

## Roadmap

- [x] Invoice smart contract — 21 tests passing
- [x] Electronic Bill of Lading (eBL) contract — 25 tests passing
- [x] Letter of Credit (LC) contract — 29 tests passing
- [x] Bill of Exchange contract — 34 tests passing
- [x] 118 passing tests across all four instruments
- [x] Deployed to Ethereum Sepolia — all four contracts
- [x] Deployed to XDC Apothem — all four contracts
- [x] Chain-agnostic bridge orchestrator with adapter pattern
- [x] XRPL adapter — live bridge run across three chains
- [x] Evidence logger — structured audit bundles per bridge cycle
- [x] ISO 20022 adapter — pain.001 and camt.054 message stubs
- [x] Five-screen frontend — dashboard, issue eBL, evidence trail, bridge, all instruments
- [x] VeChain adapter — evidence and attestation layer (VIP-191 fee delegation, seven shipping event types)
- [x] Canton / DAML adapter — legal authority layer via DAML JSON API (awaits deployed DAML model)
- [ ] XRPL Foundation grant application — Spring 2026
- [ ] ICC DSI certification research
- [ ] Legal documentation — Singapore MLETR legal opinion
- [ ] MAS Project Guardian engagement

---

## Target Institutions

- **ITFA Fintech Committee** — Digital Negotiable Instruments initiative, Andre Kasam
- **XRPL Foundation** — ecosystem grants, Spring 2026 window
- **XDC Foundation** — trade finance native ecosystem, builder grants
- **ICC Digital Standards Initiative** — reliability assessment and certification
- **MAS Project Guardian** — Singapore tokenized finance sandbox
- **BAFT** — Trade Digitization Working Group
- **Quant Network / Overledger** — institutional blockchain OS, strategic partner

---

## Built With

- [Hardhat](https://hardhat.org/) — Ethereum development environment
- [Solidity](https://soliditylang.org/) — Smart contract language
- [Ethers.js](https://ethers.org/) — Ethereum and EVM library
- [XDC Network](https://xdc.org/) — Trade finance native blockchain
- [XRPL](https://xrpl.org/) — XRP Ledger liquidity rail
- [VeChain](https://www.vechain.org/) — Evidence and attestation layer (testnet adapter)
- [Canton Network](https://www.canton.network/) — Institutional legal authority layer (DAML JSON API adapter)

---

## License

MIT

---

*Magnito — inspired by the force that draws things together.*