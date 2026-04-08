const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // --- Deploy Invoice ---
  const Invoice = await hre.ethers.getContractFactory("Invoice");
  const invoice = await Invoice.deploy();
  await invoice.waitForDeployment();
  const invoiceAddress = await invoice.getAddress();
  console.log("Invoice deployed to:", invoiceAddress);

  // --- Deploy BillOfLading ---
  const BillOfLading = await hre.ethers.getContractFactory("BillOfLading");
  const billOfLading = await BillOfLading.deploy();
  await billOfLading.waitForDeployment();
  const bolAddress = await billOfLading.getAddress();
  console.log("BillOfLading deployed to:", bolAddress);

  // --- Deploy LetterOfCredit ---
  const LetterOfCredit = await hre.ethers.getContractFactory("LetterOfCredit");
  const letterOfCredit = await LetterOfCredit.deploy();
  await letterOfCredit.waitForDeployment();
  const lcAddress = await letterOfCredit.getAddress();
  console.log("LetterOfCredit deployed to:", lcAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("Invoice:        ", invoiceAddress);
  console.log("BillOfLading:   ", bolAddress);
  console.log("LetterOfCredit: ", lcAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});