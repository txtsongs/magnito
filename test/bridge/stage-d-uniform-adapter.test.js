const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BridgeOrchestrator } = require("../../bridge/orchestrator");
const { bindAdapterToHardhat } = require("./helpers/bindAdapterToHardhat");
const { mockTargetAdapter } = require("./helpers/mockTargetAdapter");
const { makeTempJournalPath, cleanupJournalPath } = require("./helpers/tempJournalPath");
const { INSTRUMENTS, deployAndIssue } = require("./helpers/instrumentFixtures");

// ─────────────────────────────────────────────────────────────────────────
// STAGE D — the completion test.
//
// EVMAdapter now speaks only IInstrument (lock/unlock/markBridged/
// isBridged) — never a hardcoded Invoice ABI. This file is the proof: the
// SAME bridgeOneInstrument() function below bridges all four instrument
// types. The only thing that varies across the loop is the fixtures array
// (contract name, issue call, authority signer) — data, not code. Nothing
// in this file, in EVMAdapter, or in the orchestrator branches on
// instrument type. If any of that had needed an
// `if (spec.name === "Invoice")`, this test would be the wrong shape.
// ─────────────────────────────────────────────────────────────────────────

describe("[STAGE D] One EVM adapter, zero per-instrument code, all four instruments", function () {
  let journalPath, signers;

  beforeEach(async function () {
    journalPath = makeTempJournalPath();
    signers = await ethers.getSigners();
  });

  afterEach(function () {
    cleanupJournalPath(journalPath);
  });

  async function bridgeOneInstrument(spec) {
    const { contract, authoritySigner } = await deployAndIssue(spec, signers);

    const orchestrator = new BridgeOrchestrator({ journalPath });
    const sourceAdapter = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress: await contract.getAddress(),
      hardhatContract: contract,
      signer: authoritySigner,
    });
    orchestrator.registerAdapter("xdc-apothem-test", sourceAdapter);
    orchestrator.registerAdapter("xrpl-mock", mockTargetAdapter());

    const result = await orchestrator.bridgeInstrument(
      "1",
      "xdc-apothem-test",
      "xrpl-mock",
      { documentHash: "hashUNIFORM" }
    );

    return { contract, result };
  }

  for (const spec of INSTRUMENTS) {
    it(`bridges ${spec.name} through the shared EVMAdapter with zero per-instrument code`, async function () {
      const { contract, result } = await bridgeOneInstrument(spec);

      expect(result.success, `${spec.name} bridge should succeed: ${result.error}`).to.equal(true);
      expect(
        result.evidence.singularityConfirmed,
        `${spec.name}'s terminal Bridged state should be confirmed on-chain`
      ).to.equal(true);
      expect(
        await contract.isBridged(1),
        `${spec.name} must report isBridged() === true after a committed bridge`
      ).to.equal(true);
    });
  }

  // ── Recovery must be equally uniform ─────────────────────────────
  // getInstrumentStatus() (see evm-adapter.js) has no per-instrument enum
  // knowledge — it only ever calls isBridged() and static-call-probes
  // unlock(). Prove recover()'s roll-back path works identically for all
  // four instrument types, not just Invoice.
  for (const spec of INSTRUMENTS) {
    it(`recovers a ${spec.name} crashed after lock — rolls back on restart`, async function () {
      const { contract, authoritySigner } = await deployAndIssue(spec, signers);
      const contractAddress = await contract.getAddress();

      const orchestrator1 = new BridgeOrchestrator({ journalPath });
      const sourceAdapter1 = bindAdapterToHardhat({
        chainId: "xdc-apothem-test",
        contractAddress,
        hardhatContract: contract,
        signer: authoritySigner,
      });
      orchestrator1.registerAdapter("xdc-apothem-test", sourceAdapter1);
      orchestrator1.registerAdapter("xrpl-mock", mockTargetAdapter());

      await sourceAdapter1.lockInstrument("1");
      orchestrator1.journal.write("xdc-apothem-test->xrpl-mock:1", {
        instrumentId: "1",
        fromChain: "xdc-apothem-test",
        toChain: "xrpl-mock",
        instrumentData: { documentHash: "hashUNIFORM" },
        phase: "locked",
        steps: [],
        startTime: new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      });

      expect(await contract.isBridged(1), `${spec.name} must not be Bridged yet`).to.equal(false);

      const orchestrator2 = new BridgeOrchestrator({ journalPath });
      const sourceAdapter2 = bindAdapterToHardhat({
        chainId: "xdc-apothem-test",
        contractAddress,
        hardhatContract: contract,
        signer: authoritySigner,
      });
      orchestrator2.registerAdapter("xdc-apothem-test", sourceAdapter2);
      orchestrator2.registerAdapter("xrpl-mock", mockTargetAdapter());

      const results = await orchestrator2.recover();

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome, `${spec.name} should roll back`).to.equal("rolled_back");
      expect(orchestrator2.journal.all()).to.deep.equal({});
    });
  }

  // One deeper check on a non-Invoice instrument: roll-forward must
  // generalize too, not just roll-back.
  it("recovers a BillOfLading crashed after source commit — rolls forward, never unlocks a terminal eBL", async function () {
    const spec = INSTRUMENTS.find((s) => s.name === "BillOfLading");
    const { contract, authoritySigner } = await deployAndIssue(spec, signers);
    const contractAddress = await contract.getAddress();

    const orchestrator1 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter1 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress,
      hardhatContract: contract,
      signer: authoritySigner,
    });
    orchestrator1.registerAdapter("xdc-apothem-test", sourceAdapter1);

    await sourceAdapter1.lockInstrument("1");
    await sourceAdapter1.commitInstrument("1"); // markBridged — terminal
    orchestrator1.journal.write("xdc-apothem-test->xrpl-mock:1", {
      instrumentId: "1",
      fromChain: "xdc-apothem-test",
      toChain: "xrpl-mock",
      instrumentData: { documentHash: "hashUNIFORM" },
      phase: "source_committed",
      steps: [],
      startTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    });

    expect(await contract.isBridged(1)).to.equal(true);

    const orchestrator2 = new BridgeOrchestrator({ journalPath });
    const sourceAdapter2 = bindAdapterToHardhat({
      chainId: "xdc-apothem-test",
      contractAddress,
      hardhatContract: contract,
      signer: authoritySigner,
    });
    const target2 = mockTargetAdapter();
    orchestrator2.registerAdapter("xdc-apothem-test", sourceAdapter2);
    orchestrator2.registerAdapter("xrpl-mock", target2);

    const results = await orchestrator2.recover();

    expect(results[0].outcome).to.equal("rolled_forward");
    expect(target2.calls.map((c) => c.action)).to.include("commit");
    expect(
      await contract.isBridged(1),
      "recovery must never un-bridge a terminal eBL"
    ).to.equal(true);
  });
});
