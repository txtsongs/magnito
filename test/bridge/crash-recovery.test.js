const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BridgeOrchestrator } = require("../../bridge/orchestrator");
const { bindAdapterToHardhat } = require("./helpers/bindAdapterToHardhat");
const { mockTargetAdapter } = require("./helpers/mockTargetAdapter");
const { makeTempJournalPath, cleanupJournalPath } = require("./helpers/tempJournalPath");

// ─────────────────────────────────────────────────────────────────────────
// STAGE C — durable journal + crash recovery.
//
// A real process crash can't be simulated by literally killing this test
// process (that would also kill the in-process Hardhat network the
// "on-chain" state lives on). Instead these tests reproduce exactly what
// a crash leaves behind: real on-chain state from whatever steps actually
// ran, plus whatever the journal durably captured for the step in
// progress — and nothing else. A brand-new BridgeOrchestrator instance
// ("process 2") is then pointed at that same journal file and asked to
// recover, exactly as a restarted process would.
// ─────────────────────────────────────────────────────────────────────────

describe("[SAFETY NET] Crash recovery — an in-flight bridge must survive a restart", function () {
  let invoice, seller, buyer, journalPath;

  beforeEach(async function () {
    [seller, buyer] = await ethers.getSigners();
    const Invoice = await ethers.getContractFactory("Invoice");
    invoice = await Invoice.deploy();
    await invoice.waitForDeployment();
    await invoice.connect(seller).createInvoice(buyer.address, 10000, "hashCRASH");
    journalPath = makeTempJournalPath();
  });

  afterEach(function () {
    cleanupJournalPath(journalPath);
  });

  it("a crash after lock but before commit rolls BACK on restart — source ends up unlocked", async function () {
    const invoiceAddress = await invoice.getAddress();

    // ── "Process 1": gets exactly as far as Step 1 (lock), then dies. ──
    const orchestrator1 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter1 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: invoiceAddress,
      hardhatContract: invoice,
      signer: seller,
    });
    orchestrator1.registerAdapter("xdc-apothem-test", sourceAdapter1);
    orchestrator1.registerAdapter("xrpl-mock", mockTargetAdapter());

    await sourceAdapter1.lockInstrument("1");
    orchestrator1.journal.write("xdc-apothem-test->xrpl-mock:1", {
      instrumentId: "1",
      fromChain: "xdc-apothem-test",
      toChain: "xrpl-mock",
      instrumentData: { documentHash: "hashCRASH" },
      phase: "locked",
      steps: [],
      startTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    });
    // No further calls on orchestrator1 — this IS the crash. No clean
    // shutdown, no abort, nothing beyond what a killed process leaves.

    const preRecovery = await invoice.getInvoice(1);
    expect(preRecovery.status, "the crash must have left the instrument genuinely Locked on-chain").to.equal(3);

    // ── "Process 2": fresh orchestrator, same journal file on disk. ──
    const orchestrator2 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter2 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: invoiceAddress,
      hardhatContract: invoice,
      signer: seller,
    });
    orchestrator2.registerAdapter("xdc-apothem-test", sourceAdapter2);
    orchestrator2.registerAdapter("xrpl-mock", mockTargetAdapter());

    const results = await orchestrator2.recover();

    expect(results).to.have.lengthOf(1);
    expect(results[0].outcome).to.equal("rolled_back");

    const postRecovery = await invoice.getInvoice(1);
    expect(postRecovery.status, "recovery must unlock a source that never reached the terminal state").to.equal(0); // Pending

    expect(orchestrator2.journal.all(), "a resolved recovery must leave nothing in the journal").to.deep.equal({});
  });

  it("a crash after source commit rolls FORWARD on restart — never unlocks a terminal instrument", async function () {
    const invoiceAddress = await invoice.getAddress();

    // ── "Process 1": reaches Step 3 (source commit = markBridged) and dies
    // before Step 4 (target commit) ever runs. ──
    const orchestrator1 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter1 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: invoiceAddress,
      hardhatContract: invoice,
      signer: seller,
    });
    orchestrator1.registerAdapter("xdc-apothem-test", sourceAdapter1);

    await sourceAdapter1.lockInstrument("1");
    await sourceAdapter1.commitInstrument("1"); // markBridged — terminal, point of no return
    orchestrator1.journal.write("xdc-apothem-test->xrpl-mock:1", {
      instrumentId: "1",
      fromChain: "xdc-apothem-test",
      toChain: "xrpl-mock",
      instrumentData: { documentHash: "hashCRASH" },
      phase: "source_committed",
      steps: [],
      startTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    });

    const preRecovery = await invoice.getInvoice(1);
    expect(preRecovery.status, "the source must already be terminally Bridged before recovery runs").to.equal(4);

    // ── "Process 2": fresh orchestrator, same journal file on disk. ──
    const orchestrator2 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter2 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: invoiceAddress,
      hardhatContract: invoice,
      signer: seller,
    });
    const target2 = mockTargetAdapter();
    orchestrator2.registerAdapter("xdc-apothem-test", sourceAdapter2);
    orchestrator2.registerAdapter("xrpl-mock", target2);

    const results = await orchestrator2.recover();

    expect(results).to.have.lengthOf(1);
    expect(results[0].outcome).to.equal("rolled_forward");
    expect(target2.calls.map((c) => c.action)).to.include("issue");
    expect(target2.calls.map((c) => c.action)).to.include("commit");

    // The whole point: recovery must NEVER unlock an already-terminal
    // instrument. It must still be Bridged, not back in Pending.
    const postRecovery = await invoice.getInvoice(1);
    expect(postRecovery.status, "recovery must never unlock a terminal instrument").to.equal(4); // Bridged

    expect(orchestrator2.journal.all()).to.deep.equal({});
  });

  it("recovering an empty journal is a no-op", async function () {
    const orchestrator = new BridgeOrchestrator({ journalPath });
    const results = await orchestrator.recover();
    expect(results).to.deep.equal([]);
  });

  it("a stale entry whose lock never actually landed is discarded, not acted on", async function () {
    // Simulate a crash that happened WHILE the lock tx was still in
    // flight, before it was ever mined — the journal has a "starting"
    // breadcrumb but the source chain never left Pending.
    const invoiceAddress = await invoice.getAddress();

    const orchestrator1 = new BridgeOrchestrator({ journalPath });
    orchestrator1.journal.write("xdc-apothem-test->xrpl-mock:1", {
      instrumentId: "1",
      fromChain: "xdc-apothem-test",
      toChain: "xrpl-mock",
      instrumentData: { documentHash: "hashCRASH" },
      phase: "starting",
      steps: [],
      startTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    });

    const orchestrator2 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter2 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: invoiceAddress,
      hardhatContract: invoice,
      signer: seller,
    });
    orchestrator2.registerAdapter("xdc-apothem-test", sourceAdapter2);
    orchestrator2.registerAdapter("xrpl-mock", mockTargetAdapter());

    const results = await orchestrator2.recover();

    expect(results[0].outcome).to.equal("discarded_stale");

    const status = await invoice.getInvoice(1);
    expect(status.status).to.equal(0); // untouched — still Pending

    expect(orchestrator2.journal.all()).to.deep.equal({});
  });

  it("an entry that previously failed to abort is surfaced for manual attention, never silently retried", async function () {
    const orchestrator1 = new BridgeOrchestrator({ journalPath });
    orchestrator1.journal.write("xdc-apothem-test->xrpl-mock:1", {
      instrumentId: "1",
      fromChain: "xdc-apothem-test",
      toChain: "xrpl-mock",
      instrumentData: {},
      phase: "abort_failed",
      steps: [],
      startTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    });

    // Deliberately register no adapters — a stuck abort_failed entry must
    // be flagged without even needing to touch a chain.
    const orchestrator2 = new BridgeOrchestrator({ journalPath });
    const results = await orchestrator2.recover();

    expect(results).to.have.lengthOf(1);
    expect(results[0].outcome).to.equal("needs_manual_attention");

    // Left in place on purpose — this is not auto-resolved.
    expect(orchestrator2.journal.all()).to.not.deep.equal({});
  });
});
