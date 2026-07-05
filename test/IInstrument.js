const { expect } = require("chai");
const { ethers } = require("hardhat");

// ─────────────────────────────────────────────────────────────────────────
// Stage B — IInstrument interface + terminal Bridged state.
//
// Verifies, per contract: lock/unlock/markBridged work and are
// authority-gated, and that once Bridged, every listed mutating action
// (pay, transfer, pledge, accept, discount, settle, cancel) is permanently
// blocked on the source chain. No existing business rule is touched here —
// every assertion below targets NEW functions or the NEW terminal state.
// ─────────────────────────────────────────────────────────────────────────

const futureDeadline = async (daysFromNow = 30) => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + 86400 * daysFromNow;
};

describe("IInstrument — shared bridge interface", function () {
  describe("Invoice", function () {
    let invoice, seller, buyer;

    beforeEach(async function () {
      [seller, buyer] = await ethers.getSigners();
      const Invoice = await ethers.getContractFactory("Invoice");
      invoice = await Invoice.deploy();
      await invoice.waitForDeployment();
      await invoice.connect(seller).createInvoice(buyer.address, 10000, "hashIINS");
    });

    it("markBridged requires Locked and seller authority, and is terminal", async function () {
      await expect(invoice.connect(seller).markBridged(1)).to.be.revertedWith(
        "Invoice is not locked"
      );

      await invoice.connect(seller).lockInvoice(1);
      await expect(invoice.connect(buyer).markBridged(1)).to.be.revertedWith(
        "Only the seller can mark as bridged"
      );

      await expect(invoice.connect(seller).markBridged(1))
        .to.emit(invoice, "InvoiceBridged")
        .withArgs(1);

      const result = await invoice.getInvoice(1);
      expect(result.status).to.equal(4); // 4 = Bridged
    });

    it("interface lock()/unlock() delegate to lockInvoice()/unlockInvoice()", async function () {
      await invoice.connect(seller).lock(1);
      let result = await invoice.getInvoice(1);
      expect(result.status).to.equal(3); // Locked

      await invoice.connect(seller).unlock(1);
      result = await invoice.getInvoice(1);
      expect(result.status).to.equal(0); // Pending
    });

    it("isBridged() reflects terminal state only after markBridged", async function () {
      expect(await invoice.isBridged(1)).to.equal(false);
      await invoice.connect(seller).lockInvoice(1);
      expect(await invoice.isBridged(1)).to.equal(false);
      await invoice.connect(seller).markBridged(1);
      expect(await invoice.isBridged(1)).to.equal(true);
    });

    it("a Bridged invoice can never be paid or cancelled again", async function () {
      await invoice.connect(seller).lockInvoice(1);
      await invoice.connect(seller).markBridged(1);

      await expect(invoice.connect(buyer).payInvoice(1)).to.be.reverted;
      await expect(invoice.connect(seller).cancelInvoice(1)).to.be.reverted;
      await expect(invoice.connect(seller).lockInvoice(1)).to.be.reverted;
      await expect(invoice.connect(seller).unlockInvoice(1)).to.be.reverted;
    });
  });

  describe("BillOfLading", function () {
    let ebl, carrier, holder, pledgee;

    beforeEach(async function () {
      [carrier, holder, pledgee] = await ethers.getSigners();
      const BillOfLading = await ethers.getContractFactory("BillOfLading");
      ebl = await BillOfLading.deploy();
      await ebl.waitForDeployment();
      await ebl
        .connect(carrier)
        .issueEBL(holder.address, "hashEBL", "MV Test", "Rotterdam", "Singapore", "Widgets");
    });

    it("lock/unlock are holder-gated and round-trip to Active", async function () {
      await expect(ebl.connect(carrier).lock(1)).to.be.revertedWith("Only the holder can lock");

      await ebl.connect(holder).lock(1);
      let result = await ebl.getEBL(1);
      expect(result.status).to.equal(3); // Locked

      await expect(ebl.connect(carrier).unlock(1)).to.be.revertedWith("Only the holder can unlock");
      await ebl.connect(holder).unlock(1);
      result = await ebl.getEBL(1);
      expect(result.status).to.equal(0); // Active
    });

    it("markBridged is terminal and blocks transfer, pledge, and surrender", async function () {
      await ebl.connect(holder).lock(1);
      await expect(ebl.connect(holder).markBridged(1))
        .to.emit(ebl, "EBLBridged")
        .withArgs(1, holder.address);

      expect(await ebl.isBridged(1)).to.equal(true);

      await expect(ebl.connect(holder).transferEBL(1, pledgee.address)).to.be.reverted;
      await expect(ebl.connect(holder).pledgeEBL(1, pledgee.address)).to.be.reverted;
      await expect(ebl.connect(holder).surrenderEBL(1)).to.be.reverted;
      await expect(ebl.connect(holder).unlock(1)).to.be.reverted;
      await expect(ebl.connect(holder).lock(1)).to.be.reverted;
    });
  });

  describe("LetterOfCredit", function () {
    let lc, issuingBank, applicant, beneficiary;

    beforeEach(async function () {
      [issuingBank, applicant, beneficiary] = await ethers.getSigners();
      const LetterOfCredit = await ethers.getContractFactory("LetterOfCredit");
      lc = await LetterOfCredit.deploy();
      await lc.waitForDeployment();
      await lc
        .connect(issuingBank)
        .openLC(
          applicant.address,
          beneficiary.address,
          50000,
          "USD",
          "hashLC",
          "Commercial invoice, packing list, eBL",
          await futureDeadline()
        );
    });

    it("lock/unlock are issuing-bank-gated and round-trip to Open", async function () {
      await expect(lc.connect(beneficiary).lock(1)).to.be.revertedWith(
        "Only the issuing bank can lock"
      );

      await lc.connect(issuingBank).lock(1);
      let result = await lc.getLC(1);
      expect(result.status).to.equal(6); // Locked

      await lc.connect(issuingBank).unlock(1);
      result = await lc.getLC(1);
      expect(result.status).to.equal(0); // Open
    });

    it("markBridged is terminal and blocks presentation (and everything downstream of it)", async function () {
      await lc.connect(issuingBank).lock(1);
      await expect(lc.connect(issuingBank).markBridged(1))
        .to.emit(lc, "LCBridged")
        .withArgs(1, issuingBank.address);

      expect(await lc.isBridged(1)).to.equal(true);

      // presentDocuments requires Open — Bridged forecloses it, which
      // transitively forecloses markDiscrepancy/acceptLC/refuseLC/expireLC
      // too, since none of those are reachable without a presentation first.
      await expect(lc.connect(beneficiary).presentDocuments(1, ["hashDoc"])).to.be.reverted;
      await expect(lc.connect(issuingBank).unlock(1)).to.be.reverted;
      await expect(lc.connect(issuingBank).lock(1)).to.be.reverted;
    });
  });

  describe("BillOfExchange", function () {
    let boe, drawer, drawee, payee, financier;

    beforeEach(async function () {
      [drawer, drawee, payee, financier] = await ethers.getSigners();
      const BillOfExchange = await ethers.getContractFactory("BillOfExchange");
      boe = await BillOfExchange.deploy();
      await boe.waitForDeployment();
      await boe
        .connect(drawer)
        .issueBOE(
          drawee.address,
          payee.address,
          25000,
          "USD",
          await futureDeadline(90),
          "hashBOE",
          "BOE-2026-001"
        );
    });

    it("lock/unlock are drawer-gated and round-trip to Issued", async function () {
      await expect(boe.connect(drawee).lock(1)).to.be.revertedWith("Only the drawer can lock");

      await boe.connect(drawer).lock(1);
      let result = await boe.getBOE(1);
      expect(result.status).to.equal(7); // Locked

      await boe.connect(drawer).unlock(1);
      result = await boe.getBOE(1);
      expect(result.status).to.equal(0); // Issued
    });

    it("markBridged is terminal and blocks acceptance and cancellation (and everything downstream)", async function () {
      await boe.connect(drawer).lock(1);
      await expect(boe.connect(drawer).markBridged(1))
        .to.emit(boe, "BOEBridged")
        .withArgs(1, drawer.address);

      expect(await boe.isBridged(1)).to.equal(true);

      // acceptBOE/cancelBOE both require Issued — Bridged forecloses both,
      // which transitively forecloses transfer/discount/settle/dishonour
      // too, since none of those are reachable without acceptance first.
      await expect(boe.connect(drawee).acceptBOE(1)).to.be.reverted;
      await expect(boe.connect(drawer).cancelBOE(1)).to.be.reverted;
      await expect(boe.connect(drawer).unlock(1)).to.be.reverted;
      await expect(boe.connect(drawer).lock(1)).to.be.reverted;
    });
  });
});
