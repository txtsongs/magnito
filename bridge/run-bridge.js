/**
 * Magnito Bridge Runner
 * Wires together the orchestrator and adapters for a live bridge run.
 * 
 * This script demonstrates the chain-agnostic adapter pattern in action:
 * - The orchestrator calls the same functions regardless of chain
 * - The EVM adapter handles Ethereum and XDC identically
 * - The XRPL adapter handles the XRP Ledger
 * - Adding a new chain = writing one new adapter file
 */

require("dotenv").config();
const { BridgeOrchestrator } = require("./orchestrator");
const { EVMAdapter } = require("./adapters/evm-adapter");
const { XRPLAdapter } = require("./adapters/xrpl-adapter");

async function main() {
  console.log("=".repeat(60));
  console.log("  MAGNITO BRIDGE ORCHESTRATOR");
  console.log("  Chain-Agnostic 2-Phase Commit");
  console.log("=".repeat(60));

  // ── Step 1: Initialize the orchestrator ──────────────────────
  const orchestrator = new BridgeOrchestrator();

  // ── Step 2: Register the Ethereum adapter ────────────────────
  const ethereumAdapter = new EVMAdapter({
    chainId: "ethereum-sepolia",
    rpcUrl: process.env.ALCHEMY_API_URL,
    privateKey: process.env.PRIVATE_KEY,
    invoiceAddress: "0xD752F870Db8eBF90eD87dD5115D4C62980FbE093",
  });
  orchestrator.registerAdapter("ethereum-sepolia", ethereumAdapter);

  // ── Step 3: Register the XDC adapter ─────────────────────────
  // Same EVMAdapter class — just different config
  const xdcAdapter = new EVMAdapter({
    chainId: "xdc-apothem",
    rpcUrl: "https://rpc.apothem.network",
    privateKey: process.env.PRIVATE_KEY,
    invoiceAddress: "0x71B2d0Bdb72dB416930fDEc4bCa4DbF53288AF18",
  });
  orchestrator.registerAdapter("xdc-apothem", xdcAdapter);

  // ── Step 4: Register the XRPL adapter ────────────────────────
  const xrplAdapter = new XRPLAdapter({
    rpcUrl: "wss://s.altnet.rippletest.net:51233",
    walletSeed: process.env.XRPL_WALLET_SEED,
  });
  await xrplAdapter.connect();
  orchestrator.registerAdapter("xrpl", xrplAdapter);

  console.log("\n[Runner] All adapters registered.");
  console.log("[Runner] Chains: ethereum-sepolia, xdc-apothem, xrpl");

  // ── Step 5: Create a test invoice on Ethereum ─────────────────
  console.log("\n[Runner] Creating test invoice on Ethereum...");
  const { ethers } = require("ethers");
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const invoiceABI = [
    "function createInvoice(address _buyer, uint256 _amount, string memory _documentHash) public returns (uint256)",
    "function invoiceCount() public view returns (uint256)",
    "function getInvoice(uint256 _id) public view returns (tuple(uint256 id, address seller, address buyer, uint256 amount, string documentHash, uint8 status))",
  ];
  const invoiceContract = new ethers.Contract(
    "0xD752F870Db8eBF90eD87dD5115D4C62980FbE093",
    invoiceABI,
    wallet
  );

  const createTx = await invoiceContract.createInvoice(
    "0x000000000000000000000000000000000000dEaD",
    25000,
    "QmMagnitoOrchestratorTest001"
  );
  await createTx.wait();

  const count = await invoiceContract.invoiceCount();
  const invoiceId = count.toString();
  const invoiceData = await invoiceContract.getInvoice(invoiceId);

  console.log(`[Runner] Invoice created. ID: ${invoiceId}`);
  console.log(`[Runner] Amount: ${invoiceData.amount} | Hash: ${invoiceData.documentHash}`);

  // ── Step 6: Bridge Ethereum → XRPL ───────────────────────────
  console.log("\n[Runner] Bridging Ethereum → XRPL...");
  const result1 = await orchestrator.bridgeInstrument(
    invoiceId,
    "ethereum-sepolia",
    "xrpl",
    {
      documentHash: invoiceData.documentHash,
      amount: invoiceData.amount.toString(),
      seller: invoiceData.seller,
      fromChain: "ethereum-sepolia",
    }
  );

  if (result1.success) {
    console.log("\n[Runner] ✅ Ethereum → XRPL bridge complete.");
  } else {
    console.log("\n[Runner] ❌ Bridge failed:", result1.error);
  }

  // ── Step 7: Show evidence log ─────────────────────────────────
  console.log("\n[Runner] Evidence log:");
  const logs = orchestrator.getEvidenceLogs();
  logs.forEach(log => {
    console.log(`  Bridge: ${log.fromChain} → ${log.toChain}`);
    console.log(`  Status: ${log.status}`);
    console.log(`  Steps:  ${log.steps.length}`);
    log.steps.forEach(step => {
      console.log(`    - ${step.step} (${step.chain || "n/a"}): ${step.result?.txHash || step.error || "ok"}`);
    });
  });

  console.log("\n" + "=".repeat(60));
  console.log("  BRIDGE RUN COMPLETE");
  console.log("=".repeat(60));

  await xrplAdapter.disconnect();
}

main().catch(console.error);