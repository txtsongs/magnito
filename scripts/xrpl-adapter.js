const xrpl = require("xrpl");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  // --- Step 1: Connect to Ethereum ---
  console.log("Connecting to Ethereum...");
  const invoice = await hre.ethers.getContractAt(
    "Invoice",
    "0xBC43a77DB72ffecD94f1D222357f433ba3fE8086"
  );

  const [deployer] = await hre.ethers.getSigners();
  const buyer = { address: "0x000000000000000000000000000000000000dEaD" };

  // --- Step 2: Create and lock invoice on Ethereum ---
  console.log("Creating invoice on Ethereum...");
  const createTx = await invoice.createInvoice(
    buyer.address,
    10000,
    "QmMagnitoBridgeTest004"
  );
  await createTx.wait();

  const count = await invoice.invoiceCount();
  const invoiceId = count.toString();
  console.log("Invoice ID:", invoiceId);

  console.log("Locking invoice on Ethereum...");
  const lockTx = await invoice.lockInvoice(invoiceId);
  await lockTx.wait();

  let data = await invoice.getInvoice(invoiceId);
  console.log("Status:", data.status.toString(), "(3 = Locked)");
  console.log("Ethereum side frozen.");

  // --- Step 3: Connect to XRPL and mint ---
  console.log("\nConnecting to XRPL testnet...");
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected.");

  const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_WALLET_SEED);

  console.log("Minting XRPL representation...");
  const mintMemo = {
    magnito: "bridge",
    ethereumContract: "0xBC43a77DB72ffecD94f1D222357f433ba3fE8086",
    invoiceId: invoiceId,
    amount: data.amount.toString(),
    documentHash: data.documentHash,
    seller: data.seller,
    bridgeStatus: "locked"
  };

  const mintHex = Buffer.from(JSON.stringify(mintMemo)).toString("hex");

  const mintPrepared = await client.autofill({
    TransactionType: "Payment",
    Account: wallet.address,
    Amount: "1",
    Destination: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    Memos: [{ Memo: { MemoData: mintHex } }],
  });

  const mintSigned = wallet.sign(mintPrepared);
  const mintResult = await client.submitAndWait(mintSigned.tx_blob);
  console.log("XRPL mint:", mintResult.result.meta.TransactionResult);
  console.log("XRPL Tx:  ", mintResult.result.hash);

  // --- Step 4: Simulate XRPL settlement ---
  console.log("\nSimulating XRPL settlement...");
  console.log("XRPL side settled. Starting return journey...");

  // --- Step 5: Record return journey on XRPL ---
  console.log("Recording return on XRPL...");
  const returnMemo = {
    magnito: "bridge-return",
    ethereumContract: "0xBC43a77DB72ffecD94f1D222357f433ba3fE8086",
    invoiceId: invoiceId,
    bridgeStatus: "returning"
  };

  const returnHex = Buffer.from(JSON.stringify(returnMemo)).toString("hex");

  const returnPrepared = await client.autofill({
    TransactionType: "Payment",
    Account: wallet.address,
    Amount: "1",
    Destination: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    Memos: [{ Memo: { MemoData: returnHex } }],
  });

  const returnSigned = wallet.sign(returnPrepared);
  const returnResult = await client.submitAndWait(returnSigned.tx_blob);
  console.log("Return recorded on XRPL:", returnResult.result.meta.TransactionResult);
  console.log("Return Tx:", returnResult.result.hash);

  // --- Step 6: Unlock on Ethereum ---
  console.log("\nUnlocking invoice on Ethereum...");
  const unlockTx = await invoice.unlockInvoice(invoiceId);
  await unlockTx.wait();

  data = await invoice.getInvoice(invoiceId);
  console.log("Status:", data.status.toString(), "(0 = Pending)");

  console.log("\n--- Full Cycle Complete ---");
  console.log("Ethereum locked   → XRPL minted");
  console.log("XRPL settled      → Ethereum unlocked");
  console.log("Instrument is active on Ethereum again.");

  await client.disconnect();
}

main().catch(console.error);