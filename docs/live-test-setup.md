# Two-Computer Live Test — Setup Guide

**Purpose:** Prove on camera that Magnito instruments are shared, exclusive-control state — not a local
demo. Two machines, two roles (Shipper and Bank Officer), zero shared infrastructure beyond the public
testnet. The 2-minute recording cut from this session is the demo video required by the XRPL grant
application.

See PHASE2.md §8 for the full test script. This document is the step-by-step setup guide.

---

## What you need

| Item | Computer A (Shipper/Carrier) | Computer B (Bank Officer) |
|---|---|---|
| Browser | Chrome + MetaMask | Chrome + MetaMask (separate profile) |
| Wallet | Wallet W_A, funded with TXDC | Wallet W_B, funded with TXDC |
| Network | XDC Apothem (Chain ID 51) | XDC Apothem (Chain ID 51) |
| Frontend | `npx serve .` from project root | `npx serve .` from project root |
| Screen recorder | QuickTime or OBS, clock visible | QuickTime or OBS, clock visible |
| Network (ideal) | Your regular WiFi | Phone hotspot (proves no shared backend) |

---

## Computer A setup

```bash
# 1. Clone and install (if not done)
git clone https://github.com/txtsongs/magnito.git
cd magnito
npm install

# 2. Serve from the frontend directory (matches README; vechain_attestations.json lives here)
cd frontend && npx serve . -p 3000
# Opens at http://localhost:3000
```

Add XDC Apothem to MetaMask (if not already):
- Network name: XDC Apothem Testnet
- RPC URL: https://erpc.apothem.network
- Chain ID: 51
- Symbol: TXDC
- Explorer: https://explorer.apothem.network

Fund wallet W_A with TXDC: https://faucet.apothem.network (use the connected wallet address)

---

## Computer B setup

```bash
# Same clone-and-serve as Computer A
git clone https://github.com/txtsongs/magnito.git
cd magnito
npm install
cd frontend && npx serve . -p 3000
```

Add XDC Apothem to MetaMask on Computer B with a **different wallet profile** (different seed phrase
than W_A). Fund W_B from the same faucet.

---

## VeChain evidence trail (optional for the test, required for the grant demo video)

Complete this BEFORE recording if you want the evidence screen to show real VeChain data:

```bash
# On Computer A — configure .env
cp .env.example .env   # or create .env manually
# Add: VECHAIN_SPONSOR_PRIVATE_KEY=0x<your-sponsor-key>
# Optional: VECHAIN_SIGNER_PRIVATE_KEY=0x<separate-origin-key>

# Generate a sponsor keypair if needed:
node -e "const {Secp256k1,Address}=require('@vechain/sdk-core');(async()=>{
  const k=await Secp256k1.generatePrivateKey();
  const h=Buffer.from(k).toString('hex');
  console.log('key 0x'+h);
  console.log('addr',Address.ofPublicKey(Secp256k1.derivePublicKey(k)).toString())
})()"

# Fund the sponsor wallet with VTHO at https://faucet.vecha.in/ (requires X/Twitter login)
# Then check balance:
curl -s https://testnet.vechain.org/accounts/<SPONSOR_ADDRESS> | grep energy

# After issuing eBL #N on XDC, run the live test:
node scripts/vechain-live-test.js --instrument <N>
# This writes to data/vechain_attestations.json AND frontend/vechain_attestations.json
# Reload the evidence screen — real VeChain txs will render instead of "awaiting" message
```

---

## The test script (from PHASE2.md §8)

Run through all steps on camera. Both screens visible simultaneously (use picture-in-picture or
record separately and sync clocks in the edit).

| # | Machine | Action | Pass condition |
|---|---|---|---|
| 1 | A | Connect wallet, open Dashboard | Dashboard shows on-chain eBL/invoice counts |
| 2 | B | Connect wallet, open Dashboard | **Same counts as A** — two machines, identical state |
| 3 | A | Issue eBL: MV Magnito Express, Shanghai→Rotterdam, holder = W_A | eBL #N appears, status Active |
| 4 | B | Refresh Dashboard | **eBL #N visible on B within ~1 block (~2s)** — propagated, not local |
| 5 | B | Attempt `transferEBL(N, W_B)` from W_B (via browser console or Instruments screen) | **Transaction REVERTS** — B is not the holder. Revert = PASS |
| 6 | A | `transferEBL(N, W_B)` | Confirms; holder = W_B on both screens |
| 7 | A | Attempt `transferEBL(N, W_A)` from W_A | **REVERTS** — A no longer controls the instrument it created |
| 8 | B | `pledgeEBL(N, <any address>)` then `unpledgeEBL(N)` | Status cycles Active→Pledged→Active |
| 9 | A | `node bridge/run-bridge.js` in terminal (Invoice, Sepolia→XRPL) | 2PC completes: lock Sepolia + issue XRPL; tx hashes printed |
| 10 | B | Verify step 9 independently on public explorers using hashes A reads out | Source = Locked on Sepolia Etherscan; target visible on testnet.xrpl.org — never two active |
| 11 | A or B | Open Evidence Trail for eBL #N | Real VeChain attestations render (if step above done); hashes link to explorer |

### Calling transfer/pledge from the browser console (for steps 5, 7, 8)

```javascript
// In the browser console on the Instruments or Evidence screen (wallet connected):

// Step 5 — Computer B, wallet W_B, attempting transfer (should REVERT)
const contract = new ethers.Contract(
  '0x5a19eecd02Ea90da89B1a21C8D616191e8dc7fD5',
  ['function transferEBL(uint256 _id, address _newHolder)'],
  await (new ethers.BrowserProvider(window.ethereum)).getSigner()
);
await contract.transferEBL(N, '<W_B address>');  // expects revert

// Step 6 — Computer A, wallet W_A
await contract.transferEBL(N, '<W_B address>');  // should succeed
```

---

## Overall pass criteria

1. State created on Computer A is visible on Computer B without any shared backend (steps 2, 4, 10)
2. Every unauthorized action **reverts** (steps 5, 7) — the reverts are the headline
3. At no point do two chains both show an *active* version of the bridged instrument (step 10)
4. Complete recording from both machines; cut to 2 minutes: step 3 → 4 → 5 (revert!) → 6 → 10

---

## Known issue to fix before recording

If `run-bridge.js` (step 9) crashes mid-flight, the orchestrator's 2PC state is in-memory only —
the Sepolia invoice will be locked with no recovery path. Before recording, either:
- Complete PHASE2.md §9 orchestrator persistence fix, or
- Keep `scripts/manual-unlock.js` ready off-camera to recover a stuck instrument

---

## Checklist before pressing record

- [ ] Computer A: wallet W_A connected, TXDC balance > 0
- [ ] Computer B: wallet W_B connected, different profile, TXDC balance > 0, **different network (hotspot preferred)**
- [ ] Both machines showing the same Dashboard counts
- [ ] Screen recorders running, system clocks visible
- [ ] VeChain live test completed for the target eBL ID (if including evidence screen)
- [ ] `node bridge/run-bridge.js` tested at least once off-camera to confirm it reaches XRPL
