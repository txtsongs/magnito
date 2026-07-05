const { ethers } = require("hardhat");

/**
 * One entry per Magnito instrument type. `issue` deploys nothing itself —
 * it only calls the domain-specific issuance function on an already
 * deployed contract and returns the signer who holds bridge authority for
 * that instrument (the party lock()/unlock()/markBridged() are gated on).
 *
 * Nothing downstream (EVMAdapter, the orchestrator, bindAdapterToHardhat)
 * ever looks at `name` or `contractName` — they're carried only for test
 * labels and assertion messages. This array is the ONLY place instrument
 * type is a variable; everything it drives is one shared code path.
 */
const INSTRUMENTS = [
  {
    name: "Invoice",
    contractName: "Invoice",
    async issue(contract, signers) {
      const [seller, buyer] = signers;
      await contract.connect(seller).createInvoice(buyer.address, 10000, "hashUNIFORM");
      return seller;
    },
  },
  {
    name: "BillOfLading",
    contractName: "BillOfLading",
    async issue(contract, signers) {
      const [carrier, holder] = signers;
      await contract
        .connect(carrier)
        .issueEBL(holder.address, "hashUNIFORM", "MV Test", "Rotterdam", "Singapore", "Widgets");
      return holder;
    },
  },
  {
    name: "LetterOfCredit",
    contractName: "LetterOfCredit",
    async issue(contract, signers) {
      const [issuingBank, applicant, beneficiary] = signers;
      const block = await ethers.provider.getBlock("latest");
      await contract
        .connect(issuingBank)
        .openLC(
          applicant.address,
          beneficiary.address,
          50000,
          "USD",
          "hashUNIFORM",
          "Commercial invoice, packing list, eBL",
          block.timestamp + 86400 * 30
        );
      return issuingBank;
    },
  },
  {
    name: "BillOfExchange",
    contractName: "BillOfExchange",
    async issue(contract, signers) {
      const [drawer, drawee, payee] = signers;
      const block = await ethers.provider.getBlock("latest");
      await contract
        .connect(drawer)
        .issueBOE(
          drawee.address,
          payee.address,
          25000,
          "USD",
          block.timestamp + 86400 * 90,
          "hashUNIFORM",
          "BOE-UNIFORM-001"
        );
      return drawer;
    },
  },
];

async function deployAndIssue(spec, signers) {
  const Contract = await ethers.getContractFactory(spec.contractName);
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  const authoritySigner = await spec.issue(contract, signers);
  return { contract, authoritySigner };
}

module.exports = { INSTRUMENTS, deployAndIssue };
