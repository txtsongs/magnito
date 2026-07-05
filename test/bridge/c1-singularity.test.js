const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BridgeOrchestrator } = require("../../bridge/orchestrator");
const { bindAdapterToHardhat } = require("./helpers/bindAdapterToHardhat");
const { mockTargetAdapter } = require("./helpers/mockTargetAdapter");
const { makeTempJournalPath, cleanupJournalPath } = require("./helpers/tempJournalPath");

// ─────────────────────────────────────────────────────────────────────────
// SAFETY-NET TEST — pins ANALYSIS.md finding C-1.
//
// evm-adapter.js's commitInstrument() calls unlockInvoice() — the same
// function abortInstrument() calls. On a "successful" bridge, Phase-2 commit
// therefore returns the source Invoice to Status.Pending: fully live,
// payable, and cancellable again, at the same moment a representation now
// also exists on the target chain. MLETR singularity is broken, not
// preserved, by the current shipped code.
//
// This test MUST FAIL against the current contracts/adapter. Do not fix
// anything until this failure has been reviewed and approved.
// ─────────────────────────────────────────────────────────────────────────

describe("[SAFETY NET] C-1 — bridge commit must not un-finalize the source instrument", function () {
  let invoice, seller, buyer, journalPath;

  beforeEach(async function () {
    [seller, buyer] = await ethers.getSigners();
    const Invoice = await ethers.getContractFactory("Invoice");
    invoice = await Invoice.deploy();
    await invoice.waitForDeployment();
    journalPath = makeTempJournalPath();
  });

  afterEach(function () {
    cleanupJournalPath(journalPath);
  });

  it("REGRESSION: after a committed XDC→XRPL bridge, the Invoice must be un-payable, un-cancellable, un-relockable, and out of Pending", async function () {
    await invoice.connect(seller).createInvoice(buyer.address, 10000, "hashBRIDGE");
    const invoiceAddress = await invoice.getAddress();

    const orchestrator = new BridgeOrchestrator({ journalPath });

    const sourceAdapter = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: invoiceAddress,
      hardhatContract: invoice,
      signer: seller,
    });
    orchestrator.registerAdapter("xdc-apothem-test", sourceAdapter);
    orchestrator.registerAdapter("xrpl-mock", mockTargetAdapter());

    const result = await orchestrator.bridgeInstrument(
      "1",
      "xdc-apothem-test",
      "xrpl-mock",
      {
        documentHash: "hashBRIDGE",
        amount: "10000",
        seller: seller.address,
        fromChain: "xdc-apothem-test",
      }
    );

    expect(result.success, `bridge should complete cleanly: ${result.error}`).to.equal(true);

    // Stage C requirement: "singularity preserved" must be a confirmed
    // on-chain fact, not an assumption that the calls didn't throw.
    expect(
      result.evidence.singularityConfirmed,
      "a completed bridge must have confirmed the terminal Bridged state on-chain"
    ).to.equal(true);

    // A completed bridge must leave nothing in the durable journal — it
    // fully resolved, so there is nothing left to recover.
    expect(orchestrator.journal.all()).to.deep.equal({});

    // The core assertion: singularity means the source instrument is
    // TERMINALLY out of circulation once the bridge commits. Today it is
    // not — status goes back to Pending (0).
    const postBridge = await invoice.getInvoice(1);
    expect(
      postBridge.status,
      "source instrument must not be back in Pending status after a committed bridge"
    ).to.not.equal(0);

    await expect(
      invoice.connect(buyer).payInvoice(1),
      "a bridged instrument must not be payable on the source chain"
    ).to.be.reverted;

    await expect(
      invoice.connect(seller).cancelInvoice(1),
      "a bridged instrument must not be cancellable on the source chain"
    ).to.be.reverted;

    await expect(
      invoice.connect(seller).lockInvoice(1),
      "a bridged instrument must already be terminal — it should not be re-lockable from a live state"
    ).to.be.reverted;
  });
});
