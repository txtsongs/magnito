/**
 * XRPL Adapter
 * Implements the standard Magnito adapter interface for the XRP Ledger.
 * Non-EVM chain — uses the xrpl.js library instead of ethers.js.
 *
 * Honest framing: XRPL is Magnito's settlement/liquidity rail, not a second
 * title ledger. Every method here writes a signed JSON memo on a 1-drop
 * Payment transaction — a representation/settlement record of a bridge
 * event, not an on-chain object with enforceable transfer/holder semantics.
 * Nothing on XRPL currently gates who can write a memo naming a given
 * instrumentId, so "locked"/"committed" here means "recorded", not
 * "enforced" — XDC remains the sole authoritative, enforcing ledger for
 * MLETR singularity. Upgrading this to an actually enforceable
 * representation (XLS-20 NFTs or MPTs) is tracked as separate roadmap
 * work, not implied by these method names.
 *
 * Implements the standard Magnito adapter interface:
 * - lockInstrument()
 * - commitInstrument()
 * - abortInstrument()
 * - issueInstrument()
 * - getInstrumentStatus()
 */

const xrpl = require("xrpl");

class XRPLAdapter {
  /**
   * @param {object} config - Chain configuration
   * @param {string} config.rpcUrl - XRPL websocket URL
   * @param {string} config.walletSeed - Bridge wallet seed (from .env)
   * @param {string} config.destination - Default destination address for memo transactions
   */
  constructor(config) {
    this.chainId = "xrpl";
    this.rpcUrl = config.rpcUrl;
    this.walletSeed = config.walletSeed;
    this.destination = config.destination || "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
    this.client = null;
    this.wallet = null;
    console.log(`[XRPLAdapter] Initialized`);
  }

  /**
   * Connect to the XRPL network
   */
  async connect() {
    this.client = new xrpl.Client(this.rpcUrl);
    await this.client.connect();
    this.wallet = xrpl.Wallet.fromSeed(this.walletSeed);
    console.log(`[XRPLAdapter] Connected. Wallet: ${this.wallet.address}`);
  }

  /**
   * Disconnect from the XRPL network
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      console.log(`[XRPLAdapter] Disconnected`);
    }
  }

  /**
   * Submit a memo transaction to XRPL
   * This is the core mechanism for recording bridge events on XRPL
   */
  async submitMemo(memoData) {
    if (!this.client || !this.wallet) {
      throw new Error("XRPL adapter not connected. Call connect() first.");
    }

    const memoHex = Buffer.from(JSON.stringify(memoData)).toString("hex");

    const prepared = await this.client.autofill({
      TransactionType: "Payment",
      Account: this.wallet.address,
      Amount: "1",
      Destination: this.destination,
      Memos: [{ Memo: { MemoData: memoHex } }],
    });

    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(`XRPL transaction failed: ${result.result.meta.TransactionResult}`);
    }

    return result.result.hash;
  }

  /**
   * Lock an instrument — Phase 1 of 2PC
   * XRPL never holds title, so there is nothing to freeze here — this
   * writes a settlement/representation record noting that the source
   * instrument was locked elsewhere.
   */
  async lockInstrument(instrumentId) {
    console.log(`[XRPLAdapter] Writing settlement record: lock noted for instrument ${instrumentId}...`);
    const txHash = await this.submitMemo({
      magnito: "bridge",
      action: "lock",
      instrumentId: instrumentId.toString(),
      chain: "xrpl",
      timestamp: new Date().toISOString(),
    });
    return {
      success: true,
      txHash,
      chain: this.chainId,
      action: "lock",
      instrumentId,
    };
  }

  /**
   * Commit an instrument — Phase 2 of 2PC
   * Writes a settlement/representation record marking the bridge as
   * finalized from XRPL's side. This is a record of the fact, not an
   * enforcement of it — the terminal, enforced state lives on the source
   * chain via markBridged().
   */
  async commitInstrument(instrumentId) {
    console.log(`[XRPLAdapter] Writing settlement record: commit noted for instrument ${instrumentId}...`);
    const txHash = await this.submitMemo({
      magnito: "bridge",
      action: "commit",
      instrumentId: instrumentId.toString(),
      chain: "xrpl",
      timestamp: new Date().toISOString(),
    });
    return {
      success: true,
      txHash,
      chain: this.chainId,
      action: "commit",
      instrumentId,
    };
  }

  /**
   * Abort an instrument — rollback on failure
   * Writes a settlement/representation record noting the abort. There is
   * no XRPL-side state to actually roll back — the real rollback happens
   * on the source chain via unlock().
   */
  async abortInstrument(instrumentId) {
    console.log(`[XRPLAdapter] Writing settlement record: abort noted for instrument ${instrumentId}...`);
    const txHash = await this.submitMemo({
      magnito: "bridge",
      action: "abort",
      instrumentId: instrumentId.toString(),
      chain: "xrpl",
      timestamp: new Date().toISOString(),
    });
    return {
      success: true,
      txHash,
      chain: this.chainId,
      action: "abort",
      instrumentId,
    };
  }

  /**
   * Write a settlement/representation record for an instrument on XRPL
   * Records the instrument data as a memo transaction. This is evidence
   * that a bridge is in progress, not a controllable on-chain object — no
   * XRPL account holds "the" representation the way an XDC address holds
   * an instrument; anyone can write a memo naming any instrumentId. Treat
   * this as a settlement-layer audit trail, not a title.
   */
  async issueInstrument(instrumentId, instrumentData) {
    console.log(`[XRPLAdapter] Writing settlement/representation record for instrument ${instrumentId}...`);
    const txHash = await this.submitMemo({
      magnito: "bridge",
      action: "issue",
      instrumentId: instrumentId.toString(),
      documentHash: instrumentData.documentHash || "",
      amount: instrumentData.amount || "0",
      seller: instrumentData.seller || "",
      fromChain: instrumentData.fromChain || "unknown",
      bridgeStatus: "locked",
      timestamp: new Date().toISOString(),
    });
    return {
      success: true,
      txHash,
      chain: this.chainId,
      action: "issue",
      instrumentId,
    };
  }

  /**
   * Get the current status of an instrument on XRPL
   *
   * This does not query or index memo history — it is a stub that always
   * reports "Active". A real implementation would need to walk this
   * account's transaction history for memos matching instrumentId, and
   * even then the result would be a settlement/representation record, not
   * an enforceable status the way IInstrument.bridgeState() is on the
   * source chain. Not used for anything decision-critical today: the
   * orchestrator only calls getInstrumentStatus() on the SOURCE adapter
   * (to confirm the terminal Bridged state and to drive crash recovery),
   * never on the XRPL target adapter.
   */
  async getInstrumentStatus(instrumentId) {
    return {
      instrumentId: instrumentId.toString(),
      status: "Active",
      chain: this.chainId,
      note: "Stub — does not reflect actual memo history. See method comment.",
    };
  }
}

module.exports = { XRPLAdapter };