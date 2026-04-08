const xrpl = require("xrpl");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  // --- Step 1: Read invoice from Ethereum ---
  console.log("Connecting to Ethereum...");
  const invoice = await hre.ethers.getContractAt(
    "Invoice",
    "0x00F485af16675A3460BE58979cc2e8ea160e1194"
  );

  const [deployer] = await hre.ethers.getSigners();
  const buyer = { address: "0x000000000000000000000000000000000000dEaD" };

  console.log("Creating test invoice on Ethereum...");
  const tx = await invoice.createInvoice(
    buyer.address,
    10000,
    "QmMagnitoBridgeTest002"
  );
  await tx.wait();

  const data = await invoice.getInvoice(2);
  console.log("\n--- Ethereum Invoice ---");
  console.log("ID:     ", data.id.toString());
  console.log("Seller: ", data.seller);
  console.log("Amount: ", data.amount.toString());
  console.log("Hash:   ", data.documentHash);
  console.log("Status: ", data.status.toString(), "(0 = Pending)");

  // --- Step 2: Connect to XRPL ---
  console.log("\nConnecting to XRPL testnet...");
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected.");

  const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_WALLET_SEED);
  console.log("Bridge wallet:", wallet.address);

  // --- Step 3: Mint XRPL representation ---
  console.log("\nMinting XRPL representation of invoice...");

  // Build the memo - this is the invoice data recorded on XRPL
  const memoData = {
    magnito: "bridge",
    ethereumContract: "0x00F485af16675A3460BE58979cc2e8ea160e1194",
    invoiceId: data.id.toString(),
    amount: data.amount.toString(),
    documentHash: data.documentHash,
    seller: data.seller,
  };

  // Convert memo to hex (XRPL requires hex encoding)
  const memoHex = Buffer.from(JSON.stringify(memoData)).toString("hex");

  // Submit a transaction to XRPL with the invoice data as a memo
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

  console.log("\n--- XRPL Mint Result ---");
  console.log("Status:  ", result.result.meta.TransactionResult);
  console.log("XRPL Tx: ", result.result.hash);
  console.log(
    "Explorer:",
    "https://testnet.xrpl.org/transactions/" + result.result.hash
  );

  console.log("\n--- Bridge Complete ---");
  console.log("Invoice", data.id.toString(), "recorded on XRPL.");

  await client.disconnect();
}

main().catch(console.error);