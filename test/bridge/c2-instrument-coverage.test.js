const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BridgeOrchestrator } = require("../../bridge/orchestrator");
const { bindAdapterToHardhat } = require("./helpers/bindAdapterToHardhat");
const { mockTargetAdapter } = require("./helpers/mockTargetAdapter");
const { makeTempJournalPath, cleanupJournalPath } = require("./helpers/tempJournalPath");

// ─────────────────────────────────────────────────────────────────────────
// SAFETY-NET TEST — pins ANALYSIS.md finding C-2.
//
// Only Invoice.sol has lock/unlock hooks. BillOfLading, LetterOfCredit, and
// BillOfExchange expose none, and EVMAdapter's ABI is hardcoded to Invoice's
// lockInvoice/unlockInvoice/getInvoice. Registering any of the other three
// instruments and calling bridgeInstrument() fails today.
//
// These tests encode the TARGET behavior (every instrument bridges through
// the orchestrator, same as Invoice) and MUST FAIL against the current
// contracts/adapter. Do not fix anything until reviewed and approved.
// ─────────────────────────────────────────────────────────────────────────

// Chain-relative, not Date.now()-relative: test/Lock.js (the stock Hardhat
// sample, flagged for removal in ANALYSIS.md L-5) advances the shared
// Hardhat Network's block timestamp by ~1 year to exercise its unlock
// logic, and that clock is monotonic for the rest of this mocha process.
const futureDeadline = async (daysFromNow = 30) => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + 86400 * daysFromNow;
};

describe("[SAFETY NET] C-2 — every instrument must be bridgeable, not just Invoice", function () {
  let journalPath;

  beforeEach(function () {
    journalPath = makeTempJournalPath();
  });

  afterEach(function () {
    cleanupJournalPath(journalPath);
  });

  describe("BillOfLading", function () {
    let ebl, carrier, holder;

    beforeEach(async function () {
      [carrier, holder] = await ethers.getSigners();
      const BillOfLading = await ethers.getContractFactory("BillOfLading");
      ebl = await BillOfLading.deploy();
      await ebl.waitForDeployment();
      await ebl
        .connect(carrier)
        .issueEBL(holder.address, "hashEBL", "MV Test", "Rotterdam", "Singapore", "Widgets");
    });

    it("structural: BillOfLading exposes no lock/unlock bridge hooks today", function () {
      expect(ebl.lockInvoice, "BillOfLading must not need Invoice-shaped hooks, but also has none of its own yet").to.be.undefined;
      expect(ebl.unlockInvoice).to.be.undefined;
    });

    it("TARGET BEHAVIOR: an eBL should bridge XDC→XRPL exactly like an Invoice does", async function () {
      const orchestrator = new BridgeOrchestrator({ journalPath });
      const sourceAdapter = bindAdapterToHardhat({
        chainId: "xdc-apothem-test",
        contractAddress: await ebl.getAddress(),
        hardhatContract: ebl,
        signer: holder, // the eBL holder is the analog of the Invoice seller — the party who must authorize a lock
      });
      orchestrator.registerAdapter("xdc-apothem-test", sourceAdapter);
      orchestrator.registerAdapter("xrpl-mock", mockTargetAdapter());

      const result = await orchestrator.bridgeInstrument(
        "1",
        "xdc-apothem-test",
        "xrpl-mock",
        { documentHash: "hashEBL", fromChain: "xdc-apothem-test" }
      );

      expect(
        result.success,
        `eBL bridge should succeed once bridge hooks exist: ${result.error}`
      ).to.equal(true);
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

    it("structural: LetterOfCredit exposes no lock/unlock bridge hooks today", function () {
      expect(lc.lockInvoice).to.be.undefined;
      expect(lc.unlockInvoice).to.be.undefined;
    });

    it("TARGET BEHAVIOR: an LC should bridge XDC→XRPL exactly like an Invoice does", async function () {
      const orchestrator = new BridgeOrchestrator({ journalPath });
      const sourceAdapter = bindAdapterToHardhat({
        chainId: "xdc-apothem-test",
        contractAddress: await lc.getAddress(),
        hardhatContract: lc,
        signer: issuingBank, // the issuing bank is the analog of the Invoice seller — controls the instrument's authoritative state
      });
      orchestrator.registerAdapter("xdc-apothem-test", sourceAdapter);
      orchestrator.registerAdapter("xrpl-mock", mockTargetAdapter());

      const result = await orchestrator.bridgeInstrument(
        "1",
        "xdc-apothem-test",
        "xrpl-mock",
        { documentHash: "hashLC", fromChain: "xdc-apothem-test" }
      );

      expect(
        result.success,
        `LC bridge should succeed once bridge hooks exist: ${result.error}`
      ).to.equal(true);
    });
  });

  describe("BillOfExchange", function () {
    let boe, drawer, drawee, payee;

    beforeEach(async function () {
      [drawer, drawee, payee] = await ethers.getSigners();
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

    it("structural: BillOfExchange exposes no lock/unlock bridge hooks today", function () {
      expect(boe.lockInvoice).to.be.undefined;
      expect(boe.unlockInvoice).to.be.undefined;
    });

    it("TARGET BEHAVIOR: a Bill of Exchange should bridge XDC→XRPL exactly like an Invoice does", async function () {
      const orchestrator = new BridgeOrchestrator({ journalPath });
      const sourceAdapter = bindAdapterToHardhat({
        chainId: "xdc-apothem-test",
        contractAddress: await boe.getAddress(),
        hardhatContract: boe,
        signer: drawer, // the drawer is the analog of the Invoice seller — issues and controls the instrument pre-acceptance
      });
      orchestrator.registerAdapter("xdc-apothem-test", sourceAdapter);
      orchestrator.registerAdapter("xrpl-mock", mockTargetAdapter());

      const result = await orchestrator.bridgeInstrument(
        "1",
        "xdc-apothem-test",
        "xrpl-mock",
        { documentHash: "hashBOE", fromChain: "xdc-apothem-test" }
      );

      expect(
        result.success,
        `Bill of Exchange bridge should succeed once bridge hooks exist: ${result.error}`
      ).to.equal(true);
    });
  });
});
