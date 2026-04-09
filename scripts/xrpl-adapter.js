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

  // --- Step 2: Create a new invoice ---
  console.log("Creating invoice on Ethereum...");
  const createTx = await invoice.createInvoice(
    buyer.address,
    10000,
    "QmMagnitoBridgeTest003"
  );
  await createTx.wait();
  console.log("Invoice created.");

  // Get the current invoice count to find the new invoice
  const count = await invoice.invoiceCount();
  const invoiceId = count.toString();
  console.log("Invoice ID:", invoiceId);

  // --- Step 3: Lock the invoice on Ethereum ---
  console.log("\nLocking invoice on Ethereum...");
  const lockTx = await invoice.lockInvoice(invoiceId);
  await lockTx.wait();

  const data = await invoice.getInvoice(invoiceId);
  console.log("Status:", data.status.toString(), "(3 = Locked)");
  console.log("Invoice locked. Ethereum side frozen.");

  // --- Step 4: Connect to XRPL ---
  console.log("\nConnecting to XRPL testnet...");
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected.");

  const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_WALLET_SEED);

  // --- Step 5: Mint XRPL representation ---
  console.log("Minting XRPL representation...");

  const memoData = {
    magnito: "bridge",
    ethereumContract: "0xBC43a77DB72ffecD94f1D222357f433ba3fE8086",
    invoiceId: invoiceId,
    amount: data.amount.toString(),
    documentHash: data.documentHash,
    seller: data.seller,
    bridgeStatus: "locked"
  };

  const memoHex = Buffer.from(JSON.stringify(memoData)).toString("hex");

  const prepared = await client.autofill({
    TransactionType: "Payment",
    Account: wallet.address,
    Amount: "1",
    Destination: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    Memos: [
      {
        Memo: {
          MemoData: memoHex,
        },
      },
    ],
  });

  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  console.log("\n--- Bridge Complete ---");
  console.log("Ethereum status: Locked");
  console.log("XRPL status:    ", result.result.meta.TransactionResult);
  console.log("XRPL Tx:        ", result.result.hash);
  console.log("Explorer:        https://testnet.xrpl.org/transactions/" + result.result.hash);

  await client.disconnect();
}

main().catch(console.error);