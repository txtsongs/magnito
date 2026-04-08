const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BillOfLading", function () {

  let billOfLading;
  let carrier;
  let shipper;
  let buyer;
  let bank;
  let stranger;

  // Sample eBL data representing a real shipment
  const sampleEBL = {
    documentHash: "QmMagnitoeBL123abc",
    vesselName: "MV Magnito Express",
    portOfLoading: "Shanghai, China",
    portOfDischarge: "Rotterdam, Netherlands",
    goodsDescription: "Electronics - 500 cartons"
  };

  beforeEach(async function () {
    // Get test accounts
    [carrier, shipper, buyer, bank, stranger] = await ethers.getSigners();

    // Deploy fresh contract before each test
    const BillOfLading = await ethers.getContractFactory("BillOfLading");
    billOfLading = await BillOfLading.deploy();
    await billOfLading.waitForDeployment();
  });

  // ─────────────────────────────────────────
  // TEST 1: Issuing an eBL
  // ─────────────────────────────────────────
  describe("Issuing an eBL", function () {

    it("Should issue an eBL with correct details", async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address,
        sampleEBL.documentHash,
        sampleEBL.vesselName,
        sampleEBL.portOfLoading,
        sampleEBL.portOfDischarge,
        sampleEBL.goodsDescription
      );

      const result = await billOfLading.getEBL(1);

      expect(result.id).to.equal(1);
      expect(result.carrier).to.equal(carrier.address);
      expect(result.holder).to.equal(shipper.address);
      expect(result.documentHash).to.equal(sampleEBL.documentHash);
      expect(result.vesselName).to.equal(sampleEBL.vesselName);
      expect(result.portOfLoading).to.equal(sampleEBL.portOfLoading);
      expect(result.portOfDischarge).to.equal(sampleEBL.portOfDischarge);
      expect(result.goodsDescription).to.equal(sampleEBL.goodsDescription);
      expect(result.status).to.equal(0); // 0 = Active
    });

    it("Should increment the eBL count", async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
        sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
      );
      await billOfLading.connect(carrier).issueEBL(
        buyer.address, "hash2", "MV Second", "Singapore",
        "Hamburg", "Textiles - 200 cartons"
      );

      expect(await billOfLading.eblCount()).to.equal(2);
    });

    it("Should emit an EBLIssued event", async function () {
      await expect(
        billOfLading.connect(carrier).issueEBL(
          shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
          sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
        )
      ).to.emit(billOfLading, "EBLIssued")
        .withArgs(1, carrier.address, shipper.address, sampleEBL.documentHash);
    });

  });

  // ─────────────────────────────────────────
  // TEST 2: Transferring an eBL
  // ─────────────────────────────────────────
  describe("Transferring an eBL", function () {

    beforeEach(async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
        sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
      );
    });

    it("Should allow the holder to transfer to a new holder", async function () {
      await billOfLading.connect(shipper).transferEBL(1, buyer.address);

      const result = await billOfLading.getEBL(1);
      expect(result.holder).to.equal(buyer.address);
    });

    it("Should not allow a stranger to transfer", async function () {
      await expect(
        billOfLading.connect(stranger).transferEBL(1, buyer.address)
      ).to.be.revertedWith("Only the holder can transfer");
    });

    it("Should not allow the carrier to transfer", async function () {
      await expect(
        billOfLading.connect(carrier).transferEBL(1, buyer.address)
      ).to.be.revertedWith("Only the holder can transfer");
    });

    it("Should not allow transfer to the same holder", async function () {
      await expect(
        billOfLading.connect(shipper).transferEBL(1, shipper.address)
      ).to.be.revertedWith("Already the holder");
    });

    it("Should emit an EBLTransferred event", async function () {
      await expect(
        billOfLading.connect(shipper).transferEBL(1, buyer.address)
      ).to.emit(billOfLading, "EBLTransferred")
        .withArgs(1, shipper.address, buyer.address);
    });

    it("Should allow multiple transfers in sequence", async function () {
      await billOfLading.connect(shipper).transferEBL(1, buyer.address);
      await billOfLading.connect(buyer).transferEBL(1, bank.address);

      const result = await billOfLading.getEBL(1);
      expect(result.holder).to.equal(bank.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 3: Pledging an eBL
  // ─────────────────────────────────────────
  describe("Pledging an eBL", function () {

    beforeEach(async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
        sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
      );
    });

    it("Should allow the holder to pledge to a bank", async function () {
      await billOfLading.connect(shipper).pledgeEBL(1, bank.address);

      const result = await billOfLading.getEBL(1);
      expect(result.status).to.equal(1); // 1 = Pledged
      expect(result.pledgee).to.equal(bank.address);
    });

    it("Should not allow transfer while pledged", async function () {
      await billOfLading.connect(shipper).pledgeEBL(1, bank.address);

      await expect(
        billOfLading.connect(shipper).transferEBL(1, buyer.address)
      ).to.be.revertedWith("eBL is not active");
    });

    it("Should not allow a stranger to pledge", async function () {
      await expect(
        billOfLading.connect(stranger).pledgeEBL(1, bank.address)
      ).to.be.revertedWith("Only the holder can pledge");
    });

    it("Should emit an EBLPledged event", async function () {
      await expect(
        billOfLading.connect(shipper).pledgeEBL(1, bank.address)
      ).to.emit(billOfLading, "EBLPledged")
        .withArgs(1, shipper.address, bank.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 4: Unpledging an eBL
  // ─────────────────────────────────────────
  describe("Unpledging an eBL", function () {

    beforeEach(async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
        sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
      );
      await billOfLading.connect(shipper).pledgeEBL(1, bank.address);
    });

    it("Should allow the bank to unpledge", async function () {
      await billOfLading.connect(bank).unpledgeEBL(1);

      const result = await billOfLading.getEBL(1);
      expect(result.status).to.equal(0); // 0 = Active
      expect(result.pledgee).to.equal(ethers.ZeroAddress);
    });

    it("Should not allow the holder to unpledge", async function () {
      await expect(
        billOfLading.connect(shipper).unpledgeEBL(1)
      ).to.be.revertedWith("Only the pledgee can unpledge");
    });

    it("Should not allow a stranger to unpledge", async function () {
      await expect(
        billOfLading.connect(stranger).unpledgeEBL(1)
      ).to.be.revertedWith("Only the pledgee can unpledge");
    });

    it("Should allow transfer after unpledging", async function () {
      await billOfLading.connect(bank).unpledgeEBL(1);
      await billOfLading.connect(shipper).transferEBL(1, buyer.address);

      const result = await billOfLading.getEBL(1);
      expect(result.holder).to.equal(buyer.address);
    });

    it("Should emit an EBLUnpledged event", async function () {
      await expect(
        billOfLading.connect(bank).unpledgeEBL(1)
      ).to.emit(billOfLading, "EBLUnpledged")
        .withArgs(1, bank.address, shipper.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 5: Surrendering an eBL
  // ─────────────────────────────────────────
  describe("Surrendering an eBL", function () {

    beforeEach(async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
        sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
      );
    });

    it("Should allow the holder to surrender", async function () {
      await billOfLading.connect(shipper).surrenderEBL(1);

      const result = await billOfLading.getEBL(1);
      expect(result.status).to.equal(2); // 2 = Surrendered
    });

    it("Should not allow transfer after surrender", async function () {
      await billOfLading.connect(shipper).surrenderEBL(1);

      await expect(
        billOfLading.connect(shipper).transferEBL(1, buyer.address)
      ).to.be.revertedWith("eBL is not active");
    });

    it("Should not allow a stranger to surrender", async function () {
      await expect(
        billOfLading.connect(stranger).surrenderEBL(1)
      ).to.be.revertedWith("Only the holder can surrender");
    });

    it("Should not allow surrendering a pledged eBL", async function () {
      await billOfLading.connect(shipper).pledgeEBL(1, bank.address);

      await expect(
        billOfLading.connect(shipper).surrenderEBL(1)
      ).to.be.revertedWith("eBL must be active to surrender");
    });

    it("Should emit an EBLSurrendered event", async function () {
      await expect(
        billOfLading.connect(shipper).surrenderEBL(1)
      ).to.emit(billOfLading, "EBLSurrendered")
        .withArgs(1, shipper.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 6: Helper functions
  // ─────────────────────────────────────────
  describe("Helper functions", function () {

    beforeEach(async function () {
      await billOfLading.connect(carrier).issueEBL(
        shipper.address, sampleEBL.documentHash, sampleEBL.vesselName,
        sampleEBL.portOfLoading, sampleEBL.portOfDischarge, sampleEBL.goodsDescription
      );
    });

    it("Should correctly identify the holder", async function () {
      expect(await billOfLading.isHolder(1, shipper.address)).to.equal(true);
      expect(await billOfLading.isHolder(1, buyer.address)).to.equal(false);
    });

    it("Should not return a non-existent eBL", async function () {
      await expect(
        billOfLading.getEBL(999)
      ).to.be.revertedWith("eBL does not exist");
    });

  });

});