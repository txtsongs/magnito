/**
 * VeChain Adapter
 * Evidence and attestation layer.
 *
 * VeChain does NOT move instruments. It records that real-world events
 * happened: GOODS_PACKED, INSPECTION_PASSED, CARRIER_ACCEPTANCE,
 * VESSEL_DEPARTED, PORT_ARRIVAL, CUSTOMS_CLEARED, DELIVERY_CONFIRMED.
 *
 * Because VeChain is not an instrument-moving chain, this adapter
 * intentionally does NOT implement the orchestrator's standard
 * 5-method interface (lock/commit/abort/issue/getStatus). It is
 * consumed directly by code that needs to attest or read evidence,
 * not registered via BridgeOrchestrator.registerAdapter().
 *
 * Public interface:
 *   - attestEvent(instrumentId, eventType, metadata, signerWallet)
 *   - getEvidenceBundle(instrumentId)
 *   - verifyAttestation(instrumentId, eventType)
 *
 * Transactions use VIP-191 fee delegation: the participant (signerWallet)
 * signs intent, a configured sponsor wallet pays gas. Non-crypto
 * participants therefore never need to hold VTHO.
 *
 * Attestations are submitted as zero-VET self-transactions whose clause
 * data carries a signed JSON envelope. A local JSON index at
 * data/vechain_attestations.json is maintained as a discovery aid;
 * the on-chain transaction is the authoritative record.
 */

const fs = require("fs");
const path = require("path");

const {
  ThorClient,
  TESTNET_URL,
  MAINNET_URL,
} = require("@vechain/sdk-network");

const {
  Address,
  Hex,
  HexUInt,
  Keccak256,
  Secp256k1,
  Transaction,
  Txt,
} = require("@vechain/sdk-core");

const EVENT_TYPES = Object.freeze({
  GOODS_PACKED: "GOODS_PACKED",
  INSPECTION_PASSED: "INSPECTION_PASSED",
  CARRIER_ACCEPTANCE: "CARRIER_ACCEPTANCE",
  VESSEL_DEPARTED: "VESSEL_DEPARTED",
  PORT_ARRIVAL: "PORT_ARRIVAL",
  CUSTOMS_CLEARED: "CUSTOMS_CLEARED",
  DELIVERY_CONFIRMED: "DELIVERY_CONFIRMED",
});

const ALLOWED_EVENTS = new Set(Object.values(EVENT_TYPES));

class VeChainAdapter {
  /**
   * @param {object} config
   * @param {string} [config.network="test"]            - "test" or "main"
   * @param {string} [config.rpcUrl]                    - Override Thor REST endpoint
   * @param {string} config.sponsorPrivateKey           - Fee-delegator key (VIP-191 gas-payer)
   * @param {string} [config.attestationTo]             - Target address for attestation clauses
   *                                                       (default: sponsor address — self-tx)
   * @param {string} [config.indexPath]                 - Local attestation index file path
   */
  constructor(config = {}) {
    this.chainId = "vechain";
    this.network = config.network || "test";
    this.rpcUrl =
      config.rpcUrl ||
      (this.network === "main" ? MAINNET_URL : TESTNET_URL);

    if (!config.sponsorPrivateKey) {
      throw new Error(
        "VeChainAdapter: sponsorPrivateKey is required for VIP-191 fee delegation"
      );
    }
    this.sponsorPrivateKey = this._toPrivateKeyBytes(config.sponsorPrivateKey);
    if (!Secp256k1.isValidPrivateKey(this.sponsorPrivateKey)) {
      throw new Error("VeChainAdapter: invalid sponsor private key");
    }
    this.sponsorAddress = Address.ofPublicKey(
      Secp256k1.derivePublicKey(this.sponsorPrivateKey)
    ).toString();

    this.attestationTo = config.attestationTo || this.sponsorAddress;

    this.indexPath =
      config.indexPath ||
      path.join(__dirname, "..", "..", "data", "vechain_attestations.json");
    this._ensureIndexDir();

    this.thor = ThorClient.at(this.rpcUrl);

    console.log(
      `[VeChainAdapter] Initialized (network=${this.network}, sponsor=${this.sponsorAddress})`
    );
  }

  static get EVENT_TYPES() {
    return EVENT_TYPES;
  }

  // ── attestation: write ─────────────────────────────────────────────

  /**
   * Record an attestation that a real-world event occurred.
   *
   * @param {string|number} instrumentId
   * @param {string} eventType              - Must be one of EVENT_TYPES
   * @param {object} metadata               - Arbitrary structured payload
   * @param {string|Uint8Array} signerWallet - Participant private key (hex string or bytes)
   * @returns {Promise<object>} Structured attestation record incl. txHash
   */
  async attestEvent(instrumentId, eventType, metadata, signerWallet) {
    if (!ALLOWED_EVENTS.has(eventType)) {
      throw new Error(
        `VeChainAdapter: unknown eventType '${eventType}'. Allowed: ${[
          ...ALLOWED_EVENTS,
        ].join(", ")}`
      );
    }
    if (
      instrumentId === undefined ||
      instrumentId === null ||
      instrumentId === ""
    ) {
      throw new Error("VeChainAdapter: instrumentId is required");
    }
    if (!signerWallet) {
      throw new Error("VeChainAdapter: signerWallet is required");
    }

    const signerPrivKey = this._toPrivateKeyBytes(signerWallet);
    if (!Secp256k1.isValidPrivateKey(signerPrivKey)) {
      throw new Error("VeChainAdapter: invalid signer private key");
    }
    const signerAddress = Address.ofPublicKey(
      Secp256k1.derivePublicKey(signerPrivKey)
    ).toString();

    const timestamp = new Date().toISOString();
    const canonical = this._canonicalPayload({
      instrumentId,
      eventType,
      metadata,
      signer: signerAddress,
      timestamp,
    });
    const payloadHashBytes = Keccak256.of(Txt.of(canonical).bytes).bytes;
    const payloadHash = Hex.of(payloadHashBytes).toString();
    const sigBytes = Secp256k1.sign(payloadHashBytes, signerPrivKey);
    const signature = Hex.of(sigBytes).toString();

    const envelope = {
      magnito: "attestation",
      version: "1.0",
      chain: "vechain",
      network: this.network,
      instrumentId: String(instrumentId),
      eventType,
      metadata: metadata ?? {},
      signer: signerAddress,
      timestamp,
      payloadHash,
      signature,
    };

    const dataHex =
      "0x" + Buffer.from(JSON.stringify(envelope), "utf8").toString("hex");
    const clauses = [
      {
        to: this.attestationTo,
        value: "0x0",
        data: dataHex,
      },
    ];

    const gasResult = await this.thor.transactions.estimateGas(
      clauses,
      signerAddress
    );
    if (gasResult.reverted) {
      throw new Error(
        `VeChainAdapter: gas estimation reverted (${gasResult.revertReasons.join(", ")})`
      );
    }

    const body = await this.thor.transactions.buildTransactionBody(
      clauses,
      gasResult.totalGas,
      { isDelegated: true }
    );

    const tx = Transaction.of(body);
    const signedTx = tx.signAsSenderAndGasPayer(
      signerPrivKey,
      this.sponsorPrivateKey
    );

    const sendResult = await this.thor.transactions.sendTransaction(signedTx);
    const txId = sendResult.id;

    const receipt = await this.thor.transactions.waitForTransaction(txId);
    if (!receipt) {
      throw new Error(
        `VeChainAdapter: no receipt returned for txId=${txId}`
      );
    }
    if (receipt.reverted) {
      throw new Error(`VeChainAdapter: transaction reverted (txId=${txId})`);
    }

    const indexEntry = {
      eventType,
      instrumentId: String(instrumentId),
      signer: signerAddress,
      signature,
      payloadHash,
      metadata: metadata ?? {},
      timestamp,
      txHash: txId,
      blockNumber: receipt.meta && receipt.meta.blockNumber,
      blockId: receipt.meta && receipt.meta.blockID,
    };
    this._appendIndex(instrumentId, indexEntry);

    return {
      success: true,
      txHash: txId,
      blockNumber: indexEntry.blockNumber,
      chain: this.chainId,
      action: "attest",
      attestation: envelope,
      signature,
      signer: signerAddress,
    };
  }

  // ── attestation: read ──────────────────────────────────────────────

  /**
   * Return every attestation seen for an instrumentId, in chronological
   * order, each entry re-verified against the chain and the signature.
   */
  async getEvidenceBundle(instrumentId) {
    if (
      instrumentId === undefined ||
      instrumentId === null ||
      instrumentId === ""
    ) {
      throw new Error("VeChainAdapter: instrumentId is required");
    }

    const index = this._readIndex();
    const entries = index[String(instrumentId)] || [];
    const events = [];

    for (const entry of entries) {
      let onChain = false;
      let verified = false;

      try {
        const tx = await this.thor.transactions.getTransaction(entry.txHash);
        onChain = Boolean(tx);
      } catch (_) {
        onChain = false;
      }

      try {
        const recoveredPub = Secp256k1.recover(
          HexUInt.of(entry.payloadHash.slice(2)).bytes,
          HexUInt.of(entry.signature.slice(2)).bytes
        );
        const recoveredAddr = Address.ofPublicKey(recoveredPub).toString();
        verified =
          recoveredAddr.toLowerCase() === String(entry.signer).toLowerCase();
      } catch (_) {
        verified = false;
      }

      events.push({
        eventType: entry.eventType,
        signer: entry.signer,
        signature: entry.signature,
        payloadHash: entry.payloadHash,
        metadata: entry.metadata,
        timestamp: entry.timestamp,
        txHash: entry.txHash,
        blockNumber: entry.blockNumber,
        verified: verified && onChain,
        signatureValid: verified,
        onChain,
      });
    }

    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return {
      magnito: "evidence-bundle",
      version: "1.0",
      chain: "vechain",
      network: this.network,
      instrumentId: String(instrumentId),
      eventCount: events.length,
      generatedAt: new Date().toISOString(),
      events,
    };
  }

  /**
   * Verify the most recent attestation for an (instrumentId, eventType) pair.
   * verified = true only when both the signature recovers to the claimed
   * signer AND the transaction is found on-chain.
   */
  async verifyAttestation(instrumentId, eventType) {
    if (!ALLOWED_EVENTS.has(eventType)) {
      throw new Error(
        `VeChainAdapter: unknown eventType '${eventType}'. Allowed: ${[
          ...ALLOWED_EVENTS,
        ].join(", ")}`
      );
    }

    const bundle = await this.getEvidenceBundle(instrumentId);
    const matches = bundle.events.filter((e) => e.eventType === eventType);

    if (matches.length === 0) {
      return {
        found: false,
        verified: false,
        instrumentId: String(instrumentId),
        eventType,
        reasons: [
          "no attestation found for this instrumentId and eventType",
        ],
      };
    }

    const latest = matches[matches.length - 1];
    const reasons = [];
    if (!latest.onChain) reasons.push("attestation tx not found on-chain");
    if (!latest.signatureValid)
      reasons.push("signature does not recover to claimed signer");

    return {
      found: true,
      verified: latest.verified,
      instrumentId: String(instrumentId),
      eventType,
      attestation: latest,
      txHash: latest.txHash,
      reasons,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────

  _toPrivateKeyBytes(input) {
    if (input instanceof Uint8Array) return input;
    const s = String(input).trim();
    const stripped = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
    return HexUInt.of(stripped).bytes;
  }

  _canonicalPayload({ instrumentId, eventType, metadata, signer, timestamp }) {
    // Field order is deliberate — keep stable so payloadHash is reproducible.
    return JSON.stringify({
      magnito: "attestation",
      version: "1.0",
      chain: "vechain",
      network: this.network,
      instrumentId: String(instrumentId),
      eventType,
      metadata: metadata ?? {},
      signer,
      timestamp,
    });
  }

  _ensureIndexDir() {
    const dir = path.dirname(this.indexPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _readIndex() {
    try {
      if (!fs.existsSync(this.indexPath)) return {};
      const raw = fs.readFileSync(this.indexPath, "utf8");
      if (!raw.trim()) return {};
      return JSON.parse(raw);
    } catch (err) {
      console.warn(
        `[VeChainAdapter] Index read failed (${err.message}). Starting fresh.`
      );
      return {};
    }
  }

  _writeIndex(index) {
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }

  _appendIndex(instrumentId, entry) {
    const index = this._readIndex();
    const key = String(instrumentId);
    if (!index[key]) index[key] = [];
    index[key].push(entry);
    this._writeIndex(index);
  }
}

module.exports = { VeChainAdapter, EVENT_TYPES };
