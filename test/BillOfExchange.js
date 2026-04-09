const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BillOfExchange", function () {

  let boe;
  let drawer;
  let drawee;
  let payee;
  let financier;
  let stranger;

  // One day and 30 days in seconds
  const ONE_DAY = 86400;
  const THIRTY_DAYS = 30 * ONE_DAY;

  beforeEach(async function () {
    [drawer, drawee, payee, financier, stranger] = await ethers.getSigners();

    const BOE = await ethers.getContractFactory("BillOfExchange");
    boe = await BOE.deploy();
    await boe.waitForDeployment();
  });

  // Helper — gets a future maturity date
  async function futureMaturity(daysFromNow = 30) {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + daysFromNow * ONE_DAY;
  }

  // Helper — issues a standard test bill
  async function issueBill() {
    const maturity = await futureMaturity();
    await boe.connect(drawer).issueBOE(
      drawee.address,
      payee.address,
      50000,
      "USD",
      maturity,
      "QmBillOfExchangeTest001",
      "BOE-2026-001"
    );
    return maturity;
  }

  // ─────────────────────────────────────────
  // TEST 1: Issuing a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Issuing a Bill of Exchange", function () {

    it("Should issue a bill with correct details", async function () {
      const maturity = await issueBill();
      const result = await boe.getBOE(1);

      expect(result.id).to.equal(1);
      expect(result.drawer).to.equal(drawer.address);
      expect(result.drawee).to.equal(drawee.address);
      expect(result.payee).to.equal(payee.address);
      expect(result.amount).to.equal(50000);
      expect(result.currency).to.equal("USD");
      expect(result.maturityDate).to.equal(maturity);
      expect(result.documentHash).to.equal("QmBillOfExchangeTest001");
      expect(result.billReference).to.equal("BOE-2026-001");
      expect(result.status).to.equal(0); // 0 = Issued
    });

    it("Should increment the bill count", async function () {
      await issueBill();
      await issueBill();
      expect(await boe.billCount()).to.equal(2);
    });

    it("Should not allow zero amount", async function () {
      const maturity = await futureMaturity();
      await expect(
        boe.connect(drawer).issueBOE(
          drawee.address, payee.address, 0, "USD",
          maturity, "QmTest", "BOE-001"
        )
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("Should not allow maturity date in the past", async function () {
      const block = await ethers.provider.getBlock("latest");
      const pastDate = block.timestamp - ONE_DAY;
      await expect(
        boe.connect(drawer).issueBOE(
          drawee.address, payee.address, 50000, "USD",
          pastDate, "QmTest", "BOE-001"
        )
      ).to.be.revertedWith("Maturity date must be in the future");
    });

    it("Should emit a BOEIssued event", async function () {
      const maturity = await futureMaturity();
      await expect(
        boe.connect(drawer).issueBOE(
          drawee.address, payee.address, 50000, "USD",
          maturity, "QmTest", "BOE-001"
        )
      ).to.emit(boe, "BOEIssued")
        .withArgs(1, drawer.address, drawee.address, payee.address, 50000, maturity);
    });

  });

  // ─────────────────────────────────────────
  // TEST 2: Accepting a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Accepting a Bill of Exchange", function () {

    beforeEach(async function () {
      await issueBill();
    });

    it("Should allow the drawee to accept", async function () {
      await boe.connect(drawee).acceptBOE(1);
      const result = await boe.getBOE(1);
      expect(result.status).to.equal(1); // 1 = Accepted
    });

    it("Should not allow the drawer to accept", async function () {
      await expect(
        boe.connect(drawer).acceptBOE(1)
      ).to.be.revertedWith("Only the drawee can accept");
    });

    it("Should not allow a stranger to accept", async function () {
      await expect(
        boe.connect(stranger).acceptBOE(1)
      ).to.be.revertedWith("Only the drawee can accept");
    });

    it("Should not allow accepting twice", async function () {
      await boe.connect(drawee).acceptBOE(1);
      await expect(
        boe.connect(drawee).acceptBOE(1)
      ).to.be.revertedWith("Bill is not in issued state");
    });

    it("Should emit a BOEAccepted event", async function () {
      await expect(
        boe.connect(drawee).acceptBOE(1)
      ).to.emit(boe, "BOEAccepted")
        .withArgs(1, drawee.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 3: Transferring a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Transferring a Bill of Exchange", function () {

    beforeEach(async function () {
      await issueBill();
      await boe.connect(drawee).acceptBOE(1);
    });

    it("Should allow the payee to transfer", async function () {
      await boe.connect(payee).transferBOE(1, financier.address);
      const result = await boe.getBOE(1);
      expect(result.payee).to.equal(financier.address);
      expect(result.status).to.equal(2); // 2 = Transferred
    });

    it("Should not allow the drawer to transfer", async function () {
      await expect(
        boe.connect(drawer).transferBOE(1, financier.address)
      ).to.be.revertedWith("Only the current payee can transfer");
    });

    it("Should not allow a stranger to transfer", async function () {
      await expect(
        boe.connect(stranger).transferBOE(1, financier.address)
      ).to.be.revertedWith("Only the current payee can transfer");
    });

    it("Should not allow transfer to the same payee", async function () {
      await expect(
        boe.connect(payee).transferBOE(1, payee.address)
      ).to.be.revertedWith("Cannot transfer to the same payee");
    });

    it("Should not allow transfer of an unaccepted bill", async function () {
      await issueBill();
      await expect(
        boe.connect(payee).transferBOE(2, financier.address)
      ).to.be.revertedWith("Bill must be accepted or transferred to transfer again");
    });

    it("Should allow multiple transfers in sequence", async function () {
      await boe.connect(payee).transferBOE(1, financier.address);
      await boe.connect(financier).transferBOE(1, stranger.address);
      const result = await boe.getBOE(1);
      expect(result.payee).to.equal(stranger.address);
    });

    it("Should emit a BOETransferred event", async function () {
      await expect(
        boe.connect(payee).transferBOE(1, financier.address)
      ).to.emit(boe, "BOETransferred")
        .withArgs(1, payee.address, financier.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 4: Discounting a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Discounting a Bill of Exchange", function () {

    beforeEach(async function () {
      await issueBill();
      await boe.connect(drawee).acceptBOE(1);
    });

    it("Should allow the payee to discount to a financier", async function () {
      await boe.connect(payee).discountBOE(1, financier.address);
      const result = await boe.getBOE(1);
      expect(result.payee).to.equal(financier.address);
      expect(result.financier).to.equal(financier.address);
      expect(result.status).to.equal(3); // 3 = Discounted
    });

    it("Should not allow a stranger to discount", async function () {
      await expect(
        boe.connect(stranger).discountBOE(1, financier.address)
      ).to.be.revertedWith("Only the current payee can discount");
    });

    it("Should not allow discounting an unaccepted bill", async function () {
      await issueBill();
      await expect(
        boe.connect(payee).discountBOE(2, financier.address)
      ).to.be.revertedWith("Bill must be accepted to be discounted");
    });

    it("Should emit a BOEDiscounted event", async function () {
      await expect(
        boe.connect(payee).discountBOE(1, financier.address)
      ).to.emit(boe, "BOEDiscounted")
        .withArgs(1, payee.address, financier.address, 50000);
    });

  });

  // ─────────────────────────────────────────
  // TEST 5: Settling a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Settling a Bill of Exchange", function () {

    beforeEach(async function () {
      await issueBill();
      await boe.connect(drawee).acceptBOE(1);
    });

    it("Should allow the drawee to settle", async function () {
      await boe.connect(drawee).settleBOE(1);
      const result = await boe.getBOE(1);
      expect(result.status).to.equal(4); // 4 = Settled
    });

    it("Should not allow the payee to settle", async function () {
      await expect(
        boe.connect(payee).settleBOE(1)
      ).to.be.revertedWith("Only the drawee can settle");
    });

    it("Should not allow settling an unaccepted bill", async function () {
      await issueBill();
      await expect(
        boe.connect(drawee).settleBOE(2)
      ).to.be.revertedWith("Bill cannot be settled in current state");
    });

    it("Should emit a BOESettled event", async function () {
      await expect(
        boe.connect(drawee).settleBOE(1)
      ).to.emit(boe, "BOESettled")
        .withArgs(1);
    });

  });

  // ─────────────────────────────────────────
  // TEST 6: Dishonouring a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Dishonouring a Bill of Exchange", function () {

    beforeEach(async function () {
      await issueBill();
      await boe.connect(drawee).acceptBOE(1);
    });

    it("Should allow the drawee to dishonour", async function () {
      await boe.connect(drawee).dishonourBOE(1);
      const result = await boe.getBOE(1);
      expect(result.status).to.equal(5); // 5 = Dishonoured
    });

    it("Should not allow the payee to dishonour", async function () {
      await expect(
        boe.connect(payee).dishonourBOE(1)
      ).to.be.revertedWith("Only the drawee can dishonour");
    });

    it("Should emit a BOEDishonoured event", async function () {
      await expect(
        boe.connect(drawee).dishonourBOE(1)
      ).to.emit(boe, "BOEDishonoured")
        .withArgs(1);
    });

  });

  // ─────────────────────────────────────────
  // TEST 7: Cancelling a Bill of Exchange
  // ─────────────────────────────────────────
  describe("Cancelling a Bill of Exchange", function () {

    beforeEach(async function () {
      await issueBill();
    });

    it("Should allow the drawer to cancel an issued bill", async function () {
      await boe.connect(drawer).cancelBOE(1);
      const result = await boe.getBOE(1);
      expect(result.status).to.equal(6); // 6 = Cancelled
    });

    it("Should not allow cancelling an accepted bill", async function () {
      await boe.connect(drawee).acceptBOE(1);
      await expect(
        boe.connect(drawer).cancelBOE(1)
      ).to.be.revertedWith("Only issued bills can be cancelled");
    });

    it("Should not allow a stranger to cancel", async function () {
      await expect(
        boe.connect(stranger).cancelBOE(1)
      ).to.be.revertedWith("Only the drawer can cancel");
    });

    it("Should emit a BOECancelled event", async function () {
      await expect(
        boe.connect(drawer).cancelBOE(1)
      ).to.emit(boe, "BOECancelled")
        .withArgs(1);
    });

  });

  // ─────────────────────────────────────────
  // TEST 8: Maturity and edge cases
  // ─────────────────────────────────────────
  describe("Maturity and edge cases", function () {

    it("Should correctly report a bill as not matured", async function () {
      await issueBill();
      expect(await boe.isMatured(1)).to.equal(false);
    });

    it("Should not return a non-existent bill", async function () {
      await expect(
        boe.getBOE(999)
      ).to.be.revertedWith("Bill does not exist");
    });

  });

});