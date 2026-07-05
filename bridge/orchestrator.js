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
 *
 * Every 2PC step is durably journaled to disk before and after it runs, so
 * a crash between any two steps (e.g. between lock and mint) leaves a
 * breadcrumb that recover() can reconcile on restart against real on-chain
 * state — never against a possibly-stale in-memory assumption.
 */

const { JournalStore } = require("./journalStore");

class BridgeOrchestrator {
    /**
     * @param {object} [options]
     * @param {JournalStore} [options.journal] - an already-constructed journal store (mainly for tests)
     * @param {string} [options.journalPath] - path to the durable journal file (defaults to data/bridge-journal.json)
     */
    constructor(options = {}) {
      this.adapters = {};
      this.evidenceLog = [];
      this.journal = options.journal || new JournalStore(options.journalPath);
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
     * Deterministic journal key for one bridge of one instrument between
     * one chain pair. Two bridges of the same instrument between the same
     * pair are not expected to run concurrently.
     */
    _journalKey(fromChain, toChain, instrumentId) {
      return `${fromChain}->${toChain}:${instrumentId}`;
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
      const key = this._journalKey(fromChain, toChain, instrumentId);

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

      // Persisted before every state-changing call, not just after, so a
      // crash mid-await (tx submitted, receipt never seen) still leaves a
      // breadcrumb — recover() re-checks real chain state rather than
      // trusting this phase label blindly.
      const persist = (phase) => {
        this.journal.write(key, {
          instrumentId,
          fromChain,
          toChain,
          instrumentData,
          phase,
          steps: evidence.steps,
          startTime: evidence.startTime,
          updatedTime: new Date().toISOString(),
        });
      };

      persist("starting");

      try {
        // ── Phase 1: Prepare ──────────────────────────────────────
        console.log(`\n[Phase 1] Prepare`);

        // Step 1 — Lock on source chain
        console.log(`[Step 1] Locking instrument on ${fromChain}...`);
        const lockResult = await sourceAdapter.lockInstrument(instrumentId);
        evidence.steps.push({ step: "lock", chain: fromChain, result: lockResult, time: new Date().toISOString() });
        console.log(`[Step 1] Locked. Tx: ${lockResult.txHash}`);
        persist("locked");

        // Step 2 — Issue on target chain (pending state)
        console.log(`[Step 2] Issuing representation on ${toChain}...`);
        const issueResult = await targetAdapter.issueInstrument(instrumentId, instrumentData);
        evidence.steps.push({ step: "issue", chain: toChain, result: issueResult, time: new Date().toISOString() });
        console.log(`[Step 2] Issued. Tx: ${issueResult.txHash}`);
        persist("issued");

        // ── Phase 2: Commit ───────────────────────────────────────
        console.log(`\n[Phase 2] Commit`);

        // Step 3 — Commit on source chain. This is markBridged — terminal,
        // never unlock. Once this call succeeds, the source instrument can
        // never come back to life, so from here recovery must always roll
        // FORWARD (finish the target side), never roll back.
        console.log(`[Step 3] Committing on ${fromChain}...`);
        const sourceCommit = await sourceAdapter.commitInstrument(instrumentId);
        evidence.steps.push({ step: "commit_source", chain: fromChain, result: sourceCommit, time: new Date().toISOString() });
        console.log(`[Step 3] Source committed. Tx: ${sourceCommit.txHash}`);
        persist("source_committed");

        // Step 4 — Commit on target chain
        console.log(`[Step 4] Committing on ${toChain}...`);
        const targetCommit = await targetAdapter.commitInstrument(instrumentId);
        evidence.steps.push({ step: "commit_target", chain: toChain, result: targetCommit, time: new Date().toISOString() });
        console.log(`[Step 4] Target committed. Tx: ${targetCommit.txHash}`);
        persist("target_committed");

        // ── Confirm ───────────────────────────────────────────────
        // Never claim singularity is preserved on the strength of "the
        // calls didn't throw" alone — read the source chain back and
        // require it to actually report the terminal Bridged state.
        const singularityConfirmed = await this._confirmSingularity(sourceAdapter, instrumentId, fromChain);

        // ── Complete ──────────────────────────────────────────────
        evidence.status = "complete";
        evidence.singularityConfirmed = singularityConfirmed;
        evidence.endTime = new Date().toISOString();
        this.evidenceLog.push(evidence);
        this.journal.remove(key);

        console.log(`\n[Orchestrator] Bridge complete.`);
        if (singularityConfirmed) {
          console.log(`[Orchestrator] ${fromChain} → ${toChain} — MLETR singularity preserved.`);
        } else {
          console.warn(
            `[Orchestrator] WARNING: ${fromChain} → ${toChain} — bridge completed but the terminal ` +
            `Bridged state could not be confirmed on-chain. Singularity NOT verified.`
          );
        }

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
          this.journal.remove(key);
        } catch (abortErr) {
          console.error(`[Abort] Abort failed: ${abortErr.message}`);
          evidence.steps.push({ step: "abort_failed", error: abortErr.message, time: new Date().toISOString() });
          // Neither committed nor cleanly rolled back — leave this in the
          // journal deliberately. recover() will surface it for manual
          // attention rather than silently retrying an abort that already
          // failed for an unknown reason.
          persist("abort_failed");
        }

        evidence.status = "aborted";
        evidence.endTime = new Date().toISOString();
        this.evidenceLog.push(evidence);

        return { success: false, error: err.message, evidence };
      }
    }

    /**
     * Read the source chain back and confirm it actually reports the
     * terminal Bridged state before anyone is told singularity is
     * preserved. A failed or mismatched read never re-triggers abort —
     * the 2PC steps have already committed by this point; this is a
     * read-only confirmation, not a decision point.
     */
    async _confirmSingularity(sourceAdapter, instrumentId, fromChain) {
      try {
        const status = await sourceAdapter.getInstrumentStatus(instrumentId);
        return status.status === "Bridged";
      } catch (err) {
        console.warn(`[Orchestrator] Could not confirm terminal state on ${fromChain}: ${err.message}`);
        return false;
      }
    }

    /**
     * Get all evidence logs
     */
    getEvidenceLogs() {
      return this.evidenceLog;
    }

    // ───────────────────────────────────────────────────────────────
    // Crash recovery
    // ───────────────────────────────────────────────────────────────

    /**
     * Reconcile every in-flight bridge left in the journal — e.g. after a
     * process crash between lock and mint. Call once at startup, after
     * every adapter any in-flight entry might need has been registered.
     *
     * Recovery never trusts the journal's last-written phase blindly — a
     * crash can land between an on-chain state change and the journal
     * write for it. Instead it re-reads the SOURCE chain's actual status
     * and decides from there:
     *   - source already Bridged → roll FORWARD (finish the target commit).
     *     Once the source has committed there is no way back; recovery
     *     must never unlock a terminal instrument.
     *   - source still Locked    → roll BACK (abort/unlock the source).
     *     Nothing durable has happened yet anywhere, so unwinding is safe.
     *   - source neither         → nothing in flight; discard the stale entry.
     *
     * @returns {Promise<Array<object>>} one outcome record per journal entry found
     */
    async recover() {
      const all = this.journal.all();
      const keys = Object.keys(all);
      if (keys.length === 0) return [];

      console.log(`[Orchestrator] Recovery: ${keys.length} in-flight bridge(s) found in journal.`);
      const results = [];
      for (const key of keys) {
        const entry = all[key];
        if (entry.phase === "abort_failed") {
          console.warn(
            `[Orchestrator] Recovery: ${key} previously failed to abort and needs manual attention. ` +
            `Leaving in journal.`
          );
          results.push({ key, outcome: "needs_manual_attention" });
          continue;
        }
        results.push(await this._recoverEntry(key, entry));
      }
      return results;
    }

    async _recoverEntry(key, entry) {
      const { instrumentId, fromChain, toChain, instrumentData } = entry;

      let sourceAdapter, targetAdapter;
      try {
        sourceAdapter = this.getAdapter(fromChain);
        targetAdapter = this.getAdapter(toChain);
      } catch (err) {
        console.warn(`[Orchestrator] Recovery: ${key} — adapters not registered yet (${err.message}). Skipping for now.`);
        return { key, outcome: "skipped_adapter_unavailable" };
      }

      const sourceStatus = await sourceAdapter.getInstrumentStatus(instrumentId);
      console.log(`[Orchestrator] Recovery: ${key} — source status on ${fromChain} is "${sourceStatus.status}".`);

      if (sourceStatus.status === "Bridged") {
        try {
          const issueResult = await targetAdapter.issueInstrument(instrumentId, instrumentData || {});
          const commitResult = await targetAdapter.commitInstrument(instrumentId);
          this.journal.remove(key);
          console.log(`[Orchestrator] Recovery: ${key} — rolled forward, target commit completed.`);
          return { key, outcome: "rolled_forward", issueResult, commitResult };
        } catch (err) {
          console.warn(`[Orchestrator] Recovery: ${key} — roll-forward failed (${err.message}). Leaving in journal for the next recovery pass.`);
          return { key, outcome: "roll_forward_failed", error: err.message };
        }
      }

      if (sourceStatus.status === "Locked") {
        try {
          const abortResult = await sourceAdapter.abortInstrument(instrumentId);
          this.journal.remove(key);
          console.log(`[Orchestrator] Recovery: ${key} — rolled back, source unlocked.`);
          return { key, outcome: "rolled_back", abortResult };
        } catch (err) {
          console.warn(`[Orchestrator] Recovery: ${key} — rollback failed (${err.message}). Leaving in journal for manual attention.`);
          this.journal.write(key, { ...entry, phase: "abort_failed", updatedTime: new Date().toISOString() });
          return { key, outcome: "rollback_failed", error: err.message };
        }
      }

      // Neither Locked nor Bridged — the lock never took effect (crash
      // happened before or during that tx), or this was already resolved
      // by a prior recovery pass. Nothing to reconcile.
      this.journal.remove(key);
      console.log(`[Orchestrator] Recovery: ${key} — source was never locked; discarding stale journal entry.`);
      return { key, outcome: "discarded_stale" };
    }
  }

  module.exports = { BridgeOrchestrator };
