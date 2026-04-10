/**
 * EVM Adapter
 * Works for any EVM-compatible chain — Ethereum, XDC, Polygon, Avalanche, etc.
 * Only the config changes between chains. The code is identical.
 * 
 * Implements the standard Magnito adapter interface:
 * - lockInstrument()
 * - commitInstrument()
 * - abortInstrument()
 * - issueInstrument()
 * - getInstrumentStatus()
 */

const { ethers } = require("ethers");

const INVOICE_ABI = [
  "function lockInvoice(uint256 _id) public",
  "function unlockInvoice(uint256 _id) public",
  "function getInvoice(uint256 _id) public view returns (tuple(uint256 id, address seller, address buyer, uint256 amount, string documentHash, uint8 status))",
];

class EVMAdapter {
  /**
   * @param {object} config - Chain configuration
   * @param {string} config.chainId - Human-readable chain ID (e.g. "ethereum", "xdc")
   * @param {string} config.rpcUrl - RPC endpoint URL
   * @param {string} config.privateKey - Wallet private key (from .env)
   * @param {string} config.invoiceAddress - Deployed Invoice contract address
   */
  constructor(config) {
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.invoiceContract = new ethers.Contract(
      config.invoiceAddress,
      INVOICE_ABI,
      this.wallet
    );
    console.log(`[EVMAdapter:${this.chainId}] Initialized`);
    console.log(`[EVMAdapter:${this.chainId}] Contract: ${config.invoiceAddress}`);
  }

  /**
   * Lock an instrument — Phase 1 of 2PC
   * Freezes the instrument on this chain so it cannot be transferred
   */
  async lockInstrument(instrumentId) {
    console.log(`[EVMAdapter:${this.chainId}] Locking instrument ${instrumentId}...`);
    const tx = await this.invoiceContract.lockInvoice(instrumentId);
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      chain: this.chainId,
      action: "lock",
      instrumentId,
    };
  }

  /**
   * Commit an instrument — Phase 2 of 2PC
   * On the source chain, this confirms the lock is permanent
   * On the target chain, this activates the representation
   * For EVM source chains, commit = unlock after successful bridge
   */
  async commitInstrument(instrumentId) {
    console.log(`[EVMAdapter:${this.chainId}] Committing instrument ${instrumentId}...`);
    const tx = await this.invoiceContract.unlockInvoice(instrumentId);
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      chain: this.chainId,
      action: "commit",
      instrumentId,
    };
  }

  /**
   * Abort an instrument — rollback on failure
   * Unlocks the instrument and returns it to its pre-bridge state
   */
  async abortInstrument(instrumentId) {
    console.log(`[EVMAdapter:${this.chainId}] Aborting — unlocking instrument ${instrumentId}...`);
    const tx = await this.invoiceContract.unlockInvoice(instrumentId);
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      chain: this.chainId,
      action: "abort",
      instrumentId,
    };
  }

  /**
   * Issue a representation of an instrument on this chain
   * Used when this chain is the TARGET of a bridge
   * For EVM target chains, this records the bridge event as a transaction
   */
  async issueInstrument(instrumentId, instrumentData) {
    console.log(`[EVMAdapter:${this.chainId}] Recording bridge receipt for instrument ${instrumentId}...`);
    // For EVM target chains we record the bridge as a zero-value transaction
    // with the instrument data encoded in the data field
    const data = ethers.hexlify(
      ethers.toUtf8Bytes(JSON.stringify({
        magnito: "bridge-receipt",
        instrumentId: instrumentId.toString(),
        fromChain: instrumentData.fromChain || "unknown",
        documentHash: instrumentData.documentHash || "",
        amount: instrumentData.amount || "0",
      }))
    );

    const tx = await this.wallet.sendTransaction({
      to: this.wallet.address,
      value: 0,
      data: data,
    });
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      chain: this.chainId,
      action: "issue",
      instrumentId,
    };
  }

  /**
   * Get the current status of an instrument
   */
  async getInstrumentStatus(instrumentId) {
    const invoice = await this.invoiceContract.getInvoice(instrumentId);
    const statusMap = ["Pending", "Paid", "Cancelled", "Locked"];
    return {
      instrumentId: invoice.id.toString(),
      status: statusMap[invoice.status] || "Unknown",
      statusCode: invoice.status,
      chain: this.chainId,
    };
  }
}

module.exports = { EVMAdapter };