/**
 * VeChain Live Test
 *
 * Fires all seven shipping attestation events for a real eBL ID on VeChain testnet,
 * verifies each transaction on-chain, and writes the results to:
 *   data/vechain_attestations.json  (authoritative index, used by bridge/adapters)
 *   frontend/vechain_attestations.json  (copy served by npx serve for the frontend)
 *
 * Prerequisites (all listed in PHASE2.md §4):
 *   1. .env contains VECHAIN_SPONSOR_PRIVATE_KEY (fee-delegator)
 *   2. Sponsor wallet funded with VTHO from https://faucet.vecha.in/
 *   3. Optionally set VECHAIN_SIGNER_PRIVATE_KEY for a distinct origin wallet;
 *      if omitted, the sponsor wallet also signs (self-delegation test).
 *
 * Usage:
 *   node scripts/vechain-live-test.js --instrument <eBL-id>
 *   node scripts/vechain-live-test.js --instrument 1 --signer 0x<privkey>
 *
 * Pass criteria (from PHASE2.md §4):
 *   - Seven distinct attestation txs visible on explore-testnet.vechain.org
 *   - Fee-delegated (gas payer ≠ origin)
 *   - All referenced by the same instrument ID
 *   - Both data/vechain_attestations.json and frontend/vechain_attestations.json updated
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { VeChainAdapter, EVENT_TYPES } = require("../bridge/adapters/vechain-adapter");

// ── CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}

const instrumentId = flag("--instrument") || flag("-i");
const signerOverride = flag("--signer") || process.env.VECHAIN_SIGNER_PRIVATE_KEY;

if (!instrumentId) {
  console.error("Usage: node scripts/vechain-live-test.js --instrument <eBL-id>");
  process.exit(1);
}

const sponsorKey = process.env.VECHAIN_SPONSOR_PRIVATE_KEY;
if (!sponsorKey) {
  console.error(
    "VECHAIN_SPONSOR_PRIVATE_KEY is not set in .env\n" +
    "Generate a keypair with:\n" +
    '  node -e "const {Secp256k1,Address}=require(\'@vechain/sdk-core\');' +
    "(async()=>{const k=await Secp256k1.generatePrivateKey();const h=Buffer.from(k).toString('hex');" +
    "console.log('key 0x'+h);console.log('addr',Address.ofPublicKey(Secp256k1.derivePublicKey(k)).toString())})()\""
  );
  process.exit(1);
}

// ── Attestation metadata per event ───────────────────────────────────

function buildMetadata(eventType, id) {
  const vessel = "MV Magnito Express";
  const now = new Date().toISOString();
  switch (eventType) {
    case EVENT_TYPES.GOODS_PACKED:
      return { instrumentId: String(id), location: "Shanghai Port", operatorNote: "All cartons sealed and labelled", timestamp: now };
    case EVENT_TYPES.INSPECTION_PASSED:
      return { instrumentId: String(id), inspector: "SGS Shanghai", result: "PASS", reportRef: "SGS-" + id + "-001", timestamp: now };
    case EVENT_TYPES.CARRIER_ACCEPTANCE:
      return { instrumentId: String(id), vessel, blNumber: "MAGBL" + String(id).padStart(6, "0"), timestamp: now };
    case EVENT_TYPES.VESSEL_DEPARTED:
      return { instrumentId: String(id), vessel, port: "Shanghai", imo: "IMO9000001", timestamp: now };
    case EVENT_TYPES.PORT_ARRIVAL:
      return { instrumentId: String(id), vessel, port: "Rotterdam", status: "arrived", timestamp: now };
    case EVENT_TYPES.CUSTOMS_CLEARED:
      return { instrumentId: String(id), authority: "Dutch Customs", declarationRef: "NL-" + id + "-CUS", timestamp: now };
    case EVENT_TYPES.DELIVERY_CONFIRMED:
      return { instrumentId: String(id), consignee: "Consignee Wallet", reference: "DEL-" + id, timestamp: now };
    default:
      return { instrumentId: String(id), timestamp: now };
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const adapter = new VeChainAdapter({
    network: "test",
    sponsorPrivateKey: sponsorKey,
  });

  const signerKey = signerOverride || sponsorKey;

  console.log("\n=== VeChain Live Test ===");
  console.log("Instrument ID :", instrumentId);
  console.log("Sponsor addr  :", adapter.sponsorAddress);
  console.log("Network       : testnet");
  console.log("");

  // Sanity-check connectivity
  try {
    const best = await adapter.thor.blocks.getBestBlockCompressed();
    console.log("Chain tip block:", best.number, best.id.slice(0, 12) + "...");
  } catch (err) {
    console.error("Cannot reach VeChain testnet:", err.message);
    process.exit(1);
  }

  const results = [];

  for (const eventType of Object.values(EVENT_TYPES)) {
    const metadata = buildMetadata(eventType, instrumentId);
    process.stdout.write(`  Attesting ${eventType}...`);
    try {
      const result = await adapter.attestEvent(instrumentId, eventType, metadata, signerKey);
      console.log(" ✓  txHash:", result.txHash, "  block:", result.blockNumber);
      results.push({ eventType, txHash: result.txHash, blockNumber: result.blockNumber, success: true });
    } catch (err) {
      console.log(" ✗  ERROR:", err.message);
      results.push({ eventType, txHash: null, success: false, error: err.message });
    }
  }

  console.log("\n=== Results ===");
  const passed = results.filter(r => r.success).length;
  console.log(`${passed}/${results.length} attestations succeeded`);

  if (passed > 0) {
    // Copy index to frontend so the browser can serve it
    const srcPath = path.join(__dirname, "..", "data", "vechain_attestations.json");
    const dstPath = path.join(__dirname, "..", "frontend", "vechain_attestations.json");
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, dstPath);
      console.log("\nCopied attestation index to frontend/vechain_attestations.json");
    }

    console.log("\nVerify on testnet explorer:");
    results.filter(r => r.txHash).forEach(r => {
      console.log(`  ${r.eventType}: https://explore-testnet.vechain.org/transactions/${r.txHash}`);
    });
  }

  // Run getEvidenceBundle to confirm local index is intact
  console.log("\n=== Evidence Bundle Verification ===");
  try {
    const bundle = await adapter.getEvidenceBundle(instrumentId);
    console.log(`eventCount: ${bundle.eventCount}`);
    bundle.events.forEach(ev => {
      const status = ev.verified ? "verified" : (ev.onChain ? "on-chain-unverified" : "offline");
      console.log(`  [${status}] ${ev.eventType} · ${ev.txHash ? ev.txHash.slice(0, 12) + "..." : "no hash"}`);
    });
  } catch (err) {
    console.error("getEvidenceBundle failed:", err.message);
  }

  const failed = results.filter(r => !r.success);
  if (failed.length) {
    console.error("\nFailed attestations:");
    failed.forEach(r => console.error("  " + r.eventType + ":", r.error));
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
