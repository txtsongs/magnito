const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Invoice", function () {
  
  // This runs before each test - deploys a fresh contract
  let invoice;
  let seller;
  let buyer;
  let stranger;

  beforeEach(async function () {
    // Get test accounts
    [seller, buyer, stranger] = await ethers.getSigners();
    
    // Deploy the Invoice contract
    const Invoice = await ethers.getContractFactory("Invoice");
    invoice = await Invoice.deploy();
    await invoice.waitForDeployment();
  });

  // ─────────────────────────────────────────
  // TEST 1: Creating an invoice
  // ─────────────────────────────────────────
  describe("Creating an invoice", function () {
    
    it("Should create an invoice with the correct details", async function () {
      const amount = 10000;
      const docHash = "QmMagnito123abc";

      await invoice.connect(seller).createInvoice(buyer.address, amount, docHash);
      
      const result = await invoice.getInvoice(1);
      
      expect(result.id).to.equal(1);
      expect(result.seller).to.equal(seller.address);
      expect(result.buyer).to.equal(buyer.address);
      expect(result.amount).to.equal(amount);
      expect(result.documentHash).to.equal(docHash);
      expect(result.status).to.equal(0); // 0 = Pending
    });

    it("Should increment the invoice count", async function () {
      await invoice.connect(seller).createInvoice(buyer.address, 5000, "hash1");
      await invoice.connect(seller).createInvoice(buyer.address, 8000, "hash2");
      
      expect(await invoice.invoiceCount()).to.equal(2);
    });

    it("Should emit an InvoiceCreated event", async function () {
      await expect(
        invoice.connect(seller).createInvoice(buyer.address, 10000, "hashABC")
      ).to.emit(invoice, "InvoiceCreated")
        .withArgs(1, seller.address, buyer.address, 10000);
    });

  });

  // ─────────────────────────────────────────
  // TEST 2: Paying an invoice
  // ─────────────────────────────────────────
  describe("Paying an invoice", function () {

    beforeEach(async function () {
      await invoice.connect(seller).createInvoice(buyer.address, 10000, "hashXYZ");
    });

    it("Should allow the buyer to pay an invoice", async function () {
      await invoice.connect(buyer).payInvoice(1);
      
      const result = await invoice.getInvoice(1);
      expect(result.status).to.equal(1); // 1 = Paid
    });

    it("Should not allow the seller to pay their own invoice", async function () {
      await expect(
        invoice.connect(seller).payInvoice(1)
      ).to.be.revertedWith("Only the buyer can pay");
    });

    it("Should not allow a stranger to pay the invoice", async function () {
      await expect(
        invoice.connect(stranger).payInvoice(1)
      ).to.be.revertedWith("Only the buyer can pay");
    });

    it("Should not allow paying an already paid invoice", async function () {
      await invoice.connect(buyer).payInvoice(1);
      
      await expect(
        invoice.connect(buyer).payInvoice(1)
      ).to.be.revertedWith("Invoice is not pending or is locked");
    });

    it("Should emit an InvoicePaid event", async function () {
      await expect(
        invoice.connect(buyer).payInvoice(1)
      ).to.emit(invoice, "InvoicePaid")
        .withArgs(1, buyer.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 3: Cancelling an invoice
  // ─────────────────────────────────────────
  describe("Cancelling an invoice", function () {

    beforeEach(async function () {
      await invoice.connect(seller).createInvoice(buyer.address, 10000, "hashCANCEL");
    });

    it("Should allow the seller to cancel an invoice", async function () {
      await invoice.connect(seller).cancelInvoice(1);
      
      const result = await invoice.getInvoice(1);
      expect(result.status).to.equal(2); // 2 = Cancelled
    });

    it("Should not allow the buyer to cancel an invoice", async function () {
      await expect(
        invoice.connect(buyer).cancelInvoice(1)
      ).to.be.revertedWith("Only the seller can cancel");
    });

    it("Should not allow cancelling a paid invoice", async function () {
      await invoice.connect(buyer).payInvoice(1);
      
      await expect(
        invoice.connect(seller).cancelInvoice(1)
      ).to.be.revertedWith("Invoice is not pending or is locked");
    });

    it("Should emit an InvoiceCancelled event", async function () {
      await expect(
        invoice.connect(seller).cancelInvoice(1)
      ).to.emit(invoice, "InvoiceCancelled")
        .withArgs(1);
    });

  });

  // ─────────────────────────────────────────
  // TEST 4: Edge cases
  // ─────────────────────────────────────────
  describe("Edge cases", function () {

    it("Should not return a non-existent invoice", async function () {
      await expect(
        invoice.getInvoice(999)
      ).to.be.revertedWith("Invoice does not exist");
    });

  });

  // ─────────────────────────────────────────
  // TEST 5: Locking and unlocking
  // ─────────────────────────────────────────
  describe("Locking and unlocking an invoice", function () {

    beforeEach(async function () {
      await invoice.connect(seller).createInvoice(buyer.address, 10000, "hashLOCK");
    });

    it("Should allow the seller to lock an invoice", async function () {
      await invoice.connect(seller).lockInvoice(1);
      const result = await invoice.getInvoice(1);
      expect(result.status).to.equal(3); // 3 = Locked
    });

    it("Should not allow the buyer to lock an invoice", async function () {
      await expect(
        invoice.connect(buyer).lockInvoice(1)
      ).to.be.revertedWith("Only the seller can lock");
    });

    it("Should not allow paying a locked invoice", async function () {
      await invoice.connect(seller).lockInvoice(1);
      await expect(
        invoice.connect(buyer).payInvoice(1)
      ).to.be.revertedWith("Invoice is not pending or is locked");
    });

    it("Should not allow cancelling a locked invoice", async function () {
      await invoice.connect(seller).lockInvoice(1);
      await expect(
        invoice.connect(seller).cancelInvoice(1)
      ).to.be.revertedWith("Invoice is not pending or is locked");
    });

    it("Should allow the seller to unlock an invoice", async function () {
      await invoice.connect(seller).lockInvoice(1);
      await invoice.connect(seller).unlockInvoice(1);
      const result = await invoice.getInvoice(1);
      expect(result.status).to.equal(0); // 0 = Pending
    });

    it("Should not allow the buyer to unlock an invoice", async function () {
      await invoice.connect(seller).lockInvoice(1);
      await expect(
        invoice.connect(buyer).unlockInvoice(1)
      ).to.be.revertedWith("Only the seller can unlock");
    });

    it("Should emit an InvoiceLocked event", async function () {
      await expect(
        invoice.connect(seller).lockInvoice(1)
      ).to.emit(invoice, "InvoiceLocked")
        .withArgs(1);
    });

    it("Should emit an InvoiceUnlocked event", async function () {
      await invoice.connect(seller).lockInvoice(1);
      await expect(
        invoice.connect(seller).unlockInvoice(1)
      ).to.emit(invoice, "InvoiceUnlocked")
        .withArgs(1);
    });

  });

});