# Magnito

> *Magnito draws together what trade finance has kept apart — digital instruments, global liquidity, and institutional trust — pulling a $30 trillion paper-based market into the modern financial system.*

---

## What is Magnito?

Magnito is an Inter-Chain Trade Finance Bridge platform. It digitizes trade finance instruments — invoices, electronic Bills of Lading (eBLs), and Letters of Credit (LCs) — on a legally compliant blockchain, then bridges them across chains for liquidity, financing, and settlement.

The global trade finance system still runs largely on paper. Physical bills of lading. Wet-ink letters of credit. Manually processed invoices. This causes delays measured in days or weeks, creates massive fraud risk, excludes small businesses from financing, and fragments liquidity across siloed platforms.

Magnito brings a modern, digital, transparent, blockchain-native approach to this problem.

---

## The Problem

- **$30 trillion** — the annual size of the global trade finance market
- **$1.7 trillion** — the trade finance gap (ADB/WTO) — financing that SMEs need but cannot access
- **40%** — the rejection rate for SME trade finance requests vs 17% for large corporates
- **Days to weeks** — the time it takes to process a paper bill of lading
- **Fragmented** — existing digital platforms are siloed, not interoperable

---

## The Solution

Magnito connects two layers:

**Layer 1 — Canton Network (Private, Legal Authority)**
Smart contracts that hold the authoritative version of each trade finance instrument. Privacy-preserving. Legally compliant with UNCITRAL MLETR. Only transaction parties can see the data.

**Layer 2 — XRP Ledger (Public, Liquidity Rail)**
Representations of instruments for settlement, financing, and liquidity. Built-in compliance features (RequireAuth, trustlines, freeze controls). Fast, low-cost, institutionally familiar.

**Bridge Layer**
A two-phase commit orchestrator that moves instruments between layers while guaranteeing that only one authoritative version exists at any time — satisfying MLETR's singularity requirement.

---

## Instruments

| Instrument | Description | Status |
|---|---|---|
| Invoice / Receivable | Tokenized trade invoice with seller, buyer, amount, document hash, and status | ✅ Deployed |
| Electronic Bill of Lading (eBL) | Digital title to goods — transferable, pledgeable, legally enforceable | 🔨 In Development |
| Letter of Credit (LC) | Bank payment guarantee with eUCP v2.1 electronic presentation | 📋 Planned |

---

## Regulatory Alignment

Magnito is designed from the ground up to comply with:

- **UNCITRAL MLETR** — singularity, control, and integrity of electronic transferable records
- **UK Electronic Trade Documents Act 2023** — full legal possession rights for digital eBLs
- **ICC UCP 600 / eUCP v2.1** — electronic presentation rules for Letters of Credit
- **ICC Digital Standards Initiative (DSI)** — interoperable trade finance data standards
- **ISO 20022** — bank messaging standard for institutional integration

---

## Live Deployment

| Network | Contract | Address |
|---|---|---|
| Ethereum Sepolia (Testnet) | Invoice.sol | [0x04A260ba3bD4516b59F20aA766b11928a1948D45](https://sepolia.etherscan.io/address/0x04A260ba3bD4516b59F20aA766b11928a1948D45) |

---

## Repository Structure
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- Git

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

### Deploy Locally
```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

---

## Roadmap

- [x] Invoice smart contract
- [x] 13 passing tests
- [x] Sepolia testnet deployment
- [ ] Electronic Bill of Lading (eBL) contract
- [ ] Letter of Credit (LC) contract
- [ ] XRPL adapter
- [ ] Bridge orchestrator (2-phase commit)
- [ ] Web interface
- [ ] Canton / DAML integration
- [ ] MAS Project Guardian pilot application

---

## Target Institutions

Magnito is designed for engagement with:

- **ICC Digital Standards Initiative** — reference implementation of trade finance standards
- **MAS Project Guardian** — Singapore tokenized finance sandbox
- **XRPL Foundation** — ecosystem grants and institutional partnerships
- **BAFT** — Trade Digitization Working Group
- **ITFA** — Digital Negotiable Instruments initiative

---

## Built With

- [Hardhat](https://hardhat.org/) — Ethereum development environment
- [Solidity](https://soliditylang.org/) — Smart contract language
- [Ethers.js](https://ethers.org/) — Ethereum library
- [XRPL](https://xrpl.org/) — XRP Ledger (coming)
- [Canton Network](https://www.canton.network/) — Institutional DLT (coming)

---

## License

MIT

---

*Magnito — inspired by the force that draws things together.*