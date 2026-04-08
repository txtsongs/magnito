const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Magnito Invoice contract to Sepolia...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy the contract
  const Invoice = await ethers.getContractFactory("Invoice");
  const invoice = await Invoice.deploy();
  await invoice.waitForDeployment();

  // Get the contract address
  const address = await invoice.getAddress();
  console.log("✅ Magnito Invoice contract deployed to:", address);
  console.log("View on Etherscan: https://sepolia.etherscan.io/address/" + address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });