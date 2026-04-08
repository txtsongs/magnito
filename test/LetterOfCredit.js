const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LetterOfCredit", function () {

  let letterOfCredit;
  let issuingBank;
  let applicant;
  let beneficiary;
  let stranger;

  // Helper to get future timestamp
  const futureDeadline = () => Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now

  // Sample document hashes
  const sampleDocs = [
    "QmInvoiceHash123",
    "QmBillOfLadingHash456",
    "QmInsuranceHash789"
  ];

  beforeEach(async function () {
    [issuingBank, applicant, beneficiary, stranger] = await ethers.getSigners();

    const LetterOfCredit = await ethers.getContractFactory("LetterOfCredit");
    letterOfCredit = await LetterOfCredit.deploy();
    await letterOfCredit.waitForDeployment();
  });

  // ─────────────────────────────────────────
  // TEST 1: Opening an LC
  // ─────────────────────────────────────────
  describe("Opening an LC", function () {

    it("Should open an LC with correct details", async function () {
      const deadline = futureDeadline();

      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address,
        beneficiary.address,
        100000,
        "USD",
        "QmLCDocHash001",
        "Invoice, Bill of Lading, Insurance Certificate",
        deadline
      );

      const result = await letterOfCredit.getLC(1);

      expect(result.id).to.equal(1);
      expect(result.issuingBank).to.equal(issuingBank.address);
      expect(result.applicant).to.equal(applicant.address);
      expect(result.beneficiary).to.equal(beneficiary.address);
      expect(result.amount).to.equal(100000);
      expect(result.currency).to.equal("USD");
      expect(result.status).to.equal(0); // 0 = Open
    });

    it("Should increment the LC count", async function () {
      const deadline = futureDeadline();

      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmHash1", "Invoice", deadline
      );
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 200000, "EUR",
        "QmHash2", "Invoice, BL", deadline
      );

      expect(await letterOfCredit.lcCount()).to.equal(2);
    });

    it("Should not allow zero amount", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).openLC(
          applicant.address, beneficiary.address, 0, "USD",
          "QmHash", "Invoice", futureDeadline()
        )
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("Should not allow deadline in the past", async function () {
      const pastDeadline = Math.floor(Date.now() / 1000) - 86400;

      await expect(
        letterOfCredit.connect(issuingBank).openLC(
          applicant.address, beneficiary.address, 100000, "USD",
          "QmHash", "Invoice", pastDeadline
        )
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("Should emit an LCOpened event", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).openLC(
          applicant.address, beneficiary.address, 100000, "USD",
          "QmHash", "Invoice", futureDeadline()
        )
      ).to.emit(letterOfCredit, "LCOpened")
        .withArgs(1, issuingBank.address, applicant.address, beneficiary.address, 100000, "USD");
    });

  });

  // ─────────────────────────────────────────
  // TEST 2: Presenting Documents
  // ─────────────────────────────────────────
  describe("Presenting Documents", function () {

    beforeEach(async function () {
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmLCDocHash001", "Invoice, Bill of Lading, Insurance",
        futureDeadline()
      );
    });

    it("Should allow beneficiary to present documents", async function () {
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);

      const result = await letterOfCredit.getLC(1);
      expect(result.status).to.equal(1); // 1 = Presented
    });

    it("Should store presented document hashes", async function () {
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);

      const docs = await letterOfCredit.getPresentedDocs(1);
      expect(docs.length).to.equal(3);
      expect(docs[0]).to.equal(sampleDocs[0]);
      expect(docs[1]).to.equal(sampleDocs[1]);
      expect(docs[2]).to.equal(sampleDocs[2]);
    });

    it("Should set examination deadline to 5 days after presentation", async function () {
      const tx = await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);
      const block = await ethers.provider.getBlock(tx.blockNumber);

      const result = await letterOfCredit.getLC(1);
      const expectedDeadline = block.timestamp + 86400 * 5;

      expect(result.examinationDeadline).to.equal(expectedDeadline);
    });

    it("Should not allow applicant to present documents", async function () {
      await expect(
        letterOfCredit.connect(applicant).presentDocuments(1, sampleDocs)
      ).to.be.revertedWith("Only the beneficiary can present");
    });

    it("Should not allow stranger to present documents", async function () {
      await expect(
        letterOfCredit.connect(stranger).presentDocuments(1, sampleDocs)
      ).to.be.revertedWith("Only the beneficiary can present");
    });

    it("Should not allow empty document array", async function () {
      await expect(
        letterOfCredit.connect(beneficiary).presentDocuments(1, [])
      ).to.be.revertedWith("Must present at least one document");
    });

    it("Should emit a DocumentsPresented event", async function () {
      await expect(
        letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs)
      ).to.emit(letterOfCredit, "DocumentsPresented");
    });

  });

  // ─────────────────────────────────────────
  // TEST 3: Marking Discrepancy
  // ─────────────────────────────────────────
  describe("Marking Discrepancy", function () {

    beforeEach(async function () {
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmLCDocHash001", "Invoice, Bill of Lading, Insurance",
        futureDeadline()
      );
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);
    });

    it("Should allow issuing bank to mark discrepancy", async function () {
      await letterOfCredit.connect(issuingBank).markDiscrepancy(
        1, "Invoice amount does not match LC amount"
      );

      const result = await letterOfCredit.getLC(1);
      expect(result.status).to.equal(2); // 2 = Discrepancy
      expect(result.discrepancyReason).to.equal("Invoice amount does not match LC amount");
    });

    it("Should not allow beneficiary to mark discrepancy", async function () {
      await expect(
        letterOfCredit.connect(beneficiary).markDiscrepancy(1, "Some reason")
      ).to.be.revertedWith("Only the issuing bank can mark discrepancy");
    });

    it("Should not allow stranger to mark discrepancy", async function () {
      await expect(
        letterOfCredit.connect(stranger).markDiscrepancy(1, "Some reason")
      ).to.be.revertedWith("Only the issuing bank can mark discrepancy");
    });

    it("Should not allow empty discrepancy reason", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).markDiscrepancy(1, "")
      ).to.be.revertedWith("Must provide a discrepancy reason");
    });

    it("Should emit a DiscrepancyMarked event", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).markDiscrepancy(
          1, "Invoice amount does not match LC amount"
        )
      ).to.emit(letterOfCredit, "DiscrepancyMarked")
        .withArgs(1, issuingBank.address, "Invoice amount does not match LC amount");
    });

  });

  // ─────────────────────────────────────────
  // TEST 4: Accepting an LC
  // ─────────────────────────────────────────
  describe("Accepting an LC", function () {

    beforeEach(async function () {
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmLCDocHash001", "Invoice, Bill of Lading, Insurance",
        futureDeadline()
      );
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);
    });

    it("Should allow issuing bank to accept after presentation", async function () {
      await letterOfCredit.connect(issuingBank).acceptLC(1);

      const result = await letterOfCredit.getLC(1);
      expect(result.status).to.equal(3); // 3 = Accepted
    });

    it("Should allow issuing bank to accept after discrepancy", async function () {
      await letterOfCredit.connect(issuingBank).markDiscrepancy(1, "Minor issue");
      await letterOfCredit.connect(issuingBank).acceptLC(1);

      const result = await letterOfCredit.getLC(1);
      expect(result.status).to.equal(3); // 3 = Accepted
    });

    it("Should not allow beneficiary to accept", async function () {
      await expect(
        letterOfCredit.connect(beneficiary).acceptLC(1)
      ).to.be.revertedWith("Only the issuing bank can accept");
    });

    it("Should not allow stranger to accept", async function () {
      await expect(
        letterOfCredit.connect(stranger).acceptLC(1)
      ).to.be.revertedWith("Only the issuing bank can accept");
    });

    it("Should emit an LCAccepted event", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).acceptLC(1)
      ).to.emit(letterOfCredit, "LCAccepted")
        .withArgs(1, issuingBank.address);
    });

  });

  // ─────────────────────────────────────────
  // TEST 5: Refusing an LC
  // ─────────────────────────────────────────
  describe("Refusing an LC", function () {

    beforeEach(async function () {
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmLCDocHash001", "Invoice, Bill of Lading, Insurance",
        futureDeadline()
      );
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);
    });

    it("Should allow issuing bank to refuse", async function () {
      await letterOfCredit.connect(issuingBank).refuseLC(
        1, "Documents do not comply with LC terms"
      );

      const result = await letterOfCredit.getLC(1);
      expect(result.status).to.equal(4); // 4 = Refused
    });

    it("Should not allow beneficiary to refuse", async function () {
      await expect(
        letterOfCredit.connect(beneficiary).refuseLC(1, "Some reason")
      ).to.be.revertedWith("Only the issuing bank can refuse");
    });

    it("Should not allow empty refusal reason", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).refuseLC(1, "")
      ).to.be.revertedWith("Must provide a refusal reason");
    });

    it("Should emit an LCRefused event", async function () {
      await expect(
        letterOfCredit.connect(issuingBank).refuseLC(
          1, "Documents do not comply with LC terms"
        )
      ).to.emit(letterOfCredit, "LCRefused")
        .withArgs(1, issuingBank.address, "Documents do not comply with LC terms");
    });

  });

  // ─────────────────────────────────────────
  // TEST 6: Edge cases
  // ─────────────────────────────────────────
  describe("Edge cases", function () {

    it("Should not return a non-existent LC", async function () {
      await expect(
        letterOfCredit.getLC(999)
      ).to.be.revertedWith("LC does not exist");
    });

    it("Should correctly report examination window status", async function () {
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmHash", "Invoice", futureDeadline()
      );
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);

      expect(await letterOfCredit.isWithinExaminationWindow(1)).to.equal(true);
    });

    it("Should not allow presenting documents twice", async function () {
      await letterOfCredit.connect(issuingBank).openLC(
        applicant.address, beneficiary.address, 100000, "USD",
        "QmHash", "Invoice", futureDeadline()
      );
      await letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs);

      await expect(
        letterOfCredit.connect(beneficiary).presentDocuments(1, sampleDocs)
      ).to.be.revertedWith("LC is not open");
    });

  });

});