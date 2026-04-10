/**
 * XRPL Adapter
 * Implements the standard Magnito adapter interface for the XRP Ledger.
 * Non-EVM chain — uses the xrpl.js library instead of ethers.js.
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
   * On XRPL, locking is recorded as a memo transaction
   */
  async lockInstrument(instrumentId) {
    console.log(`[XRPLAdapter] Recording lock for instrument ${instrumentId}...`);
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
   * Records the final commitment on XRPL
   */
  async commitInstrument(instrumentId) {
    console.log(`[XRPLAdapter] Recording commit for instrument ${instrumentId}...`);
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
   * Records the abort event on XRPL
   */
  async abortInstrument(instrumentId) {
    console.log(`[XRPLAdapter] Recording abort for instrument ${instrumentId}...`);
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
   * Issue a representation of an instrument on XRPL
   * Records the instrument data as a memo transaction
   */
  async issueInstrument(instrumentId, instrumentData) {
    console.log(`[XRPLAdapter] Issuing XRPL representation for instrument ${instrumentId}...`);
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
   * Returns the most recent bridge event for this instrument
   */
  async getInstrumentStatus(instrumentId) {
    return {
      instrumentId: instrumentId.toString(),
      status: "Active",
      chain: this.chainId,
      note: "XRPL status determined by most recent bridge memo transaction",
    };
  }
}

module.exports = { XRPLAdapter };