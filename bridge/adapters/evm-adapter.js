/**
 * EVM Adapter
 * Works for any EVM-compatible chain — Ethereum, XDC, Polygon, Avalanche, etc.
 * Only the config changes between chains. The code is identical.
 *
 * Works against ANY instrument contract that implements IInstrument
 * (Invoice, BillOfLading, LetterOfCredit, BillOfExchange, or any future
 * instrument) — the adapter only ever calls IInstrument's five methods.
 * It has no idea what instrument type it's holding, and never branches on
 * one: that is the whole point of the interface. Adding a new instrument
 * type requires zero changes here, exactly like adding a new EVM chain
 * requires zero changes here.
 *
 * Implements the standard Magnito adapter interface:
 * - lockInstrument()
 * - commitInstrument()
 * - abortInstrument()
 * - issueInstrument()
 * - getInstrumentStatus()
 */

const { ethers } = require("ethers");

const IINSTRUMENT_ABI = [
  "function lock(uint256 id) external",
  "function unlock(uint256 id) external",
  "function markBridged(uint256 id) external",
  "function isBridged(uint256 id) external view returns (bool)",
  "function bridgeState(uint256 id) external view returns (uint8)",
];

// Order must match IInstrument.sol's `enum BridgeState { Live, Locked, Bridged }` exactly.
const BRIDGE_STATE_NAMES = ["Live", "Locked", "Bridged"];

class EVMAdapter {
  /**
   * @param {object} config - Chain configuration
   * @param {string} config.chainId - Human-readable chain ID (e.g. "ethereum", "xdc")
   * @param {string} config.rpcUrl - RPC endpoint URL
   * @param {string} config.privateKey - Wallet private key (from .env)
   * @param {string} config.instrumentAddress - Deployed instrument contract address (any IInstrument implementer)
   */
  constructor(config) {
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.instrumentContract = new ethers.Contract(
      config.instrumentAddress,
      IINSTRUMENT_ABI,
      this.wallet
    );
    console.log(`[EVMAdapter:${this.chainId}] Initialized`);
    console.log(`[EVMAdapter:${this.chainId}] Contract: ${config.instrumentAddress}`);
  }

  /**
   * Lock an instrument — Phase 1 of 2PC
   * Freezes the instrument on this chain so it cannot be transferred
   */
  async lockInstrument(instrumentId) {
    console.log(`[EVMAdapter:${this.chainId}] Locking instrument ${instrumentId}...`);
    const tx = await this.instrumentContract.lock(instrumentId);
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
   * Finalizes the bridge on the source chain. This is terminal and
   * irreversible: markBridged() moves the instrument into its terminal
   * Bridged state, so it can never be paid, transferred, pledged, accepted,
   * discounted, settled, or cancelled again on this chain. Commit must
   * never call unlock — unlock is reserved for abort only, or the source
   * instrument would come back to life while a representation also exists
   * on the target chain (MLETR singularity violation).
   */
  async commitInstrument(instrumentId) {
    console.log(`[EVMAdapter:${this.chainId}] Committing instrument ${instrumentId}...`);
    const tx = await this.instrumentContract.markBridged(instrumentId);
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
    const tx = await this.instrumentContract.unlock(instrumentId);
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
   * For EVM target chains, this records the bridge event as a transaction.
   * This never touches instrumentContract at all — it doesn't need to
   * know the instrument's type to record a bridge receipt about it.
   */
  async issueInstrument(instrumentId, instrumentData) {
    console.log(`[EVMAdapter:${this.chainId}] Recording bridge receipt for instrument ${instrumentId}...`);
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
   * Get the current status of an instrument.
   *
   * bridgeState() is IInstrument's own three-value read (Live/Locked/
   * Bridged) — each contract maps its own domain enum (Invoice's
   * Pending/Paid/Cancelled/Locked/Bridged, eBL's Active/Pledged/
   * Surrendered/Locked/Bridged, LC's and BoE's own) down to those three
   * values itself. That per-instrument mapping knowledge lives inside
   * each contract, where it belongs — this adapter just reads the shared
   * three-value result and never learns what any instrument's own enum
   * is called.
   */
  async getInstrumentStatus(instrumentId) {
    const state = await this.instrumentContract.bridgeState(instrumentId);
    return {
      instrumentId: instrumentId.toString(),
      status: BRIDGE_STATE_NAMES[state] || "Unknown",
      chain: this.chainId,
    };
  }
}

module.exports = { EVMAdapter };
