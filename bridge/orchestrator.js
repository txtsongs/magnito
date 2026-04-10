/**
 * Magnito Bridge Orchestrator
 * Chain-agnostic 2-phase commit engine.
 * 
 * The orchestrator does not know or care which blockchain it is talking to.
 * It calls the same standard functions for every chain.
 * Each chain has its own adapter that implements those functions.
 * 
 * Adding a new chain = writing one new adapter file.
 * The orchestrator never changes.
 */

class BridgeOrchestrator {
    constructor() {
      this.adapters = {};
      this.evidenceLog = [];
    }
  
    /**
     * Register a chain adapter
     * @param {string} chainId - Unique identifier for the chain (e.g. "ethereum", "xdc", "xrpl")
     * @param {object} adapter - Adapter instance implementing the standard interface
     */
    registerAdapter(chainId, adapter) {
      this.validateAdapter(adapter);
      this.adapters[chainId] = adapter;
      console.log(`[Orchestrator] Adapter registered: ${chainId}`);
    }
  
    /**
     * Validate that an adapter implements the required interface
     */
    validateAdapter(adapter) {
      const required = [
        "lockInstrument",
        "commitInstrument",
        "abortInstrument",
        "issueInstrument",
        "getInstrumentStatus",
      ];
      for (const method of required) {
        if (typeof adapter[method] !== "function") {
          throw new Error(`Adapter missing required method: ${method}`);
        }
      }
    }
  
    /**
     * Get a registered adapter by chain ID
     */
    getAdapter(chainId) {
      const adapter = this.adapters[chainId];
      if (!adapter) throw new Error(`No adapter registered for chain: ${chainId}`);
      return adapter;
    }
  
    /**
     * Bridge an instrument from one chain to another
     * Uses 2-phase commit to preserve MLETR singularity
     * 
     * @param {string} instrumentId - The ID of the instrument to bridge
     * @param {string} fromChain - Source chain ID
     * @param {string} toChain - Target chain ID
     * @param {object} instrumentData - The instrument data to carry across
     */
    async bridgeInstrument(instrumentId, fromChain, toChain, instrumentData) {
      const sourceAdapter = this.getAdapter(fromChain);
      const targetAdapter = this.getAdapter(toChain);
  
      console.log(`\n[Orchestrator] Starting bridge: ${fromChain} → ${toChain}`);
      console.log(`[Orchestrator] Instrument ID: ${instrumentId}`);
  
      const evidence = {
        instrumentId,
        fromChain,
        toChain,
        startTime: new Date().toISOString(),
        steps: [],
        status: "in_progress",
      };
  
      try {
        // ── Phase 1: Prepare ──────────────────────────────────────
        console.log(`\n[Phase 1] Prepare`);
  
        // Step 1 — Lock on source chain
        console.log(`[Step 1] Locking instrument on ${fromChain}...`);
        const lockResult = await sourceAdapter.lockInstrument(instrumentId);
        evidence.steps.push({ step: "lock", chain: fromChain, result: lockResult, time: new Date().toISOString() });
        console.log(`[Step 1] Locked. Tx: ${lockResult.txHash}`);
  
        // Step 2 — Issue on target chain (pending state)
        console.log(`[Step 2] Issuing representation on ${toChain}...`);
        const issueResult = await targetAdapter.issueInstrument(instrumentId, instrumentData);
        evidence.steps.push({ step: "issue", chain: toChain, result: issueResult, time: new Date().toISOString() });
        console.log(`[Step 2] Issued. Tx: ${issueResult.txHash}`);
  
        // ── Phase 2: Commit ───────────────────────────────────────
        console.log(`\n[Phase 2] Commit`);
  
        // Step 3 — Commit on source chain
        console.log(`[Step 3] Committing on ${fromChain}...`);
        const sourceCommit = await sourceAdapter.commitInstrument(instrumentId);
        evidence.steps.push({ step: "commit_source", chain: fromChain, result: sourceCommit, time: new Date().toISOString() });
        console.log(`[Step 3] Source committed. Tx: ${sourceCommit.txHash}`);
  
        // Step 4 — Commit on target chain
        console.log(`[Step 4] Committing on ${toChain}...`);
        const targetCommit = await targetAdapter.commitInstrument(instrumentId);
        evidence.steps.push({ step: "commit_target", chain: toChain, result: targetCommit, time: new Date().toISOString() });
        console.log(`[Step 4] Target committed. Tx: ${targetCommit.txHash}`);
  
        // ── Complete ──────────────────────────────────────────────
        evidence.status = "complete";
        evidence.endTime = new Date().toISOString();
        this.evidenceLog.push(evidence);
  
        console.log(`\n[Orchestrator] Bridge complete.`);
        console.log(`[Orchestrator] ${fromChain} → ${toChain} — MLETR singularity preserved.`);
  
        return { success: true, evidence };
  
      } catch (err) {
        // ── Abort ─────────────────────────────────────────────────
        console.log(`\n[Orchestrator] Error detected. Initiating abort...`);
        evidence.steps.push({ step: "error", error: err.message, time: new Date().toISOString() });
  
        try {
          console.log(`[Abort] Unlocking instrument on ${fromChain}...`);
          const abortResult = await sourceAdapter.abortInstrument(instrumentId);
          evidence.steps.push({ step: "abort", chain: fromChain, result: abortResult, time: new Date().toISOString() });
          console.log(`[Abort] Instrument unlocked. Bridge aborted cleanly.`);
        } catch (abortErr) {
          console.error(`[Abort] Abort failed: ${abortErr.message}`);
          evidence.steps.push({ step: "abort_failed", error: abortErr.message, time: new Date().toISOString() });
        }
  
        evidence.status = "aborted";
        evidence.endTime = new Date().toISOString();
        this.evidenceLog.push(evidence);
  
        return { success: false, error: err.message, evidence };
      }
    }
  
    /**
     * Get all evidence logs
     */
    getEvidenceLogs() {
      return this.evidenceLog;
    }
  }
  
  module.exports = { BridgeOrchestrator };