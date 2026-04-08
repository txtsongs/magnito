const xrpl = require("xrpl");

async function main() {
  console.log("Connecting to XRPL testnet...");

  // Connect to the XRPL testnet
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected to XRPL testnet.");

  // Generate a new funded test wallet
  console.log("Creating funded test wallet...");
  const { wallet } = await client.fundWallet();

  console.log("\n--- XRPL Test Wallet ---");
  console.log("Address:", wallet.address);
  console.log("Seed:   ", wallet.seed);

  // Check the balance
  const balance = await client.getXrpBalance(wallet.address);
  console.log("Balance:", balance, "XRP");

  await client.disconnect();
  console.log("\nDisconnected. XRPL adapter working.");
}

main().catch(console.error);