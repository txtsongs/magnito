/**
 * A minimal in-memory stand-in for a target-chain adapter, implementing the
 * orchestrator's standard 5-method interface. Used in place of the real
 * XRPLAdapter so these tests never dial a real network — the bugs pinned here
 * live entirely in the source-chain contract + source-chain adapter behavior,
 * which the mock target does not participate in.
 */
function mockTargetAdapter(chainId = "xrpl-mock") {
  const calls = [];
  return {
    chainId,
    calls,
    async lockInstrument(instrumentId) {
      calls.push({ action: "lock", instrumentId });
      return { success: true, txHash: "mock-lock", chain: chainId, action: "lock", instrumentId };
    },
    async commitInstrument(instrumentId) {
      calls.push({ action: "commit", instrumentId });
      return { success: true, txHash: "mock-commit", chain: chainId, action: "commit", instrumentId };
    },
    async abortInstrument(instrumentId) {
      calls.push({ action: "abort", instrumentId });
      return { success: true, txHash: "mock-abort", chain: chainId, action: "abort", instrumentId };
    },
    async issueInstrument(instrumentId, instrumentData) {
      calls.push({ action: "issue", instrumentId, instrumentData });
      return { success: true, txHash: "mock-issue", chain: chainId, action: "issue", instrumentId };
    },
    async getInstrumentStatus(instrumentId) {
      return { instrumentId: String(instrumentId), status: "Active", chain: chainId };
    },
  };
}

module.exports = { mockTargetAdapter };
