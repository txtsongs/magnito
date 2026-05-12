/**
 * Canton Adapter
 * Legal authority layer (Phase 2).
 *
 * Canton uses DAML smart contracts. This adapter does NOT write DAML —
 * it talks to a deployed DAML model via the Canton participant node's
 * HTTP JSON API.
 *
 * Implements the standard Magnito adapter interface:
 *   - lockInstrument(instrumentId)
 *   - commitInstrument(instrumentId)
 *   - abortInstrument(instrumentId)
 *   - issueInstrument(instrumentId, instrumentData)
 *   - getInstrumentStatus(instrumentId)
 *
 * Wire protocol — DAML JSON API:
 *   POST /v1/create     → issue
 *   POST /v1/exercise   → lock / commit / abort
 *   POST /v1/query      → status lookups
 *   POST /v1/fetch      → contract-id lookups
 *
 * Authentication: JWT bearer token (Authorization: Bearer <token>).
 *
 * Template identifier is constructed as "<packageId>:<moduleName>:<templateName>"
 * and the choice names default to "Lock", "Commit", "Abort". All are
 * configurable so the adapter slots into whatever DAML model is deployed
 * (sandbox, devnet, or production participant).
 *
 * Maintains data/canton_contracts.json mapping instrumentId → contractId
 * as a performance cache. The DAML JSON API query is the source of
 * truth; the cache is just a fast path that falls back on miss/stale.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_JSON_API_URL = "http://localhost:7575";

class CantonAdapter {
  /**
   * @param {object} config
   * @param {string} [config.jsonApiUrl]         - DAML JSON API base URL (default http://localhost:7575)
   * @param {string} config.jwt                  - JWT bearer token
   * @param {string} config.actAs                - Party submitting commands (e.g. "Magnito::1220abc...")
   * @param {string[]} [config.readAs]           - Additional read-as parties
   * @param {string} config.packageId            - DAML package ID for the instrument template
   * @param {string} [config.moduleName]         - Module name (default "Magnito.Instrument")
   * @param {string} [config.templateName]       - Template name (default "Instrument")
   * @param {object} [config.choices]            - Choice name overrides
   * @param {string} [config.choices.lock]       - default "Lock"
   * @param {string} [config.choices.commit]     - default "Commit"
   * @param {string} [config.choices.abort]      - default "Abort"
   * @param {string} [config.instrumentIdField]  - Field on the template holding the instrument id (default "instrumentId")
   * @param {string} [config.indexPath]          - Local contract cache path
   * @param {Function} [config.fetch]            - fetch override (for tests)
   */
  constructor(config = {}) {
    this.chainId = "canton";
    this.jsonApiUrl = (config.jsonApiUrl || DEFAULT_JSON_API_URL).replace(/\/+$/, "");

    if (!config.jwt) {
      throw new Error("CantonAdapter: jwt is required");
    }
    if (!config.actAs) {
      throw new Error("CantonAdapter: actAs party is required");
    }
    if (!config.packageId) {
      throw new Error("CantonAdapter: packageId is required");
    }

    this.jwt = config.jwt;
    this.actAs = config.actAs;
    this.readAs = config.readAs || [];
    this.packageId = config.packageId;
    this.moduleName = config.moduleName || "Magnito.Instrument";
    this.templateName = config.templateName || "Instrument";
    this.choices = {
      lock: (config.choices && config.choices.lock) || "Lock",
      commit: (config.choices && config.choices.commit) || "Commit",
      abort: (config.choices && config.choices.abort) || "Abort",
    };
    this.instrumentIdField = config.instrumentIdField || "instrumentId";

    this.indexPath =
      config.indexPath ||
      path.join(__dirname, "..", "..", "data", "canton_contracts.json");
    this._ensureIndexDir();

    this.fetch = config.fetch || (typeof fetch !== "undefined" ? fetch : null);
    if (!this.fetch) {
      throw new Error(
        "CantonAdapter: global fetch not available — pass config.fetch (Node ≥18 required)"
      );
    }

    console.log(
      `[CantonAdapter] Initialized (api=${this.jsonApiUrl}, party=${this.actAs}, template=${this.moduleName}:${this.templateName})`
    );
  }

  // ── standard interface ─────────────────────────────────────────────

  async issueInstrument(instrumentId, instrumentData = {}) {
    this._requireInstrumentId(instrumentId);

    const payload = {
      ...instrumentData,
      [this.instrumentIdField]: String(instrumentId),
    };

    const body = {
      templateId: this._templateId(),
      payload,
    };

    const result = await this._post("/v1/create", body);
    const contractId =
      result.contractId || (result.created && result.created.contractId);
    if (!contractId) {
      throw new Error(
        `CantonAdapter: create returned no contractId (result=${JSON.stringify(result)})`
      );
    }

    this._cacheContractId(instrumentId, contractId);

    return {
      success: true,
      txHash: contractId,
      chain: this.chainId,
      action: "issue",
      instrumentId,
      contractId,
      templateId: body.templateId,
    };
  }

  async lockInstrument(instrumentId) {
    return this._exerciseAndRecache(instrumentId, this.choices.lock, "lock");
  }

  async commitInstrument(instrumentId) {
    return this._exerciseAndRecache(instrumentId, this.choices.commit, "commit");
  }

  async abortInstrument(instrumentId) {
    return this._exerciseAndRecache(instrumentId, this.choices.abort, "abort");
  }

  async getInstrumentStatus(instrumentId) {
    this._requireInstrumentId(instrumentId);

    const body = {
      templateIds: [this._templateId()],
      query: { [this.instrumentIdField]: String(instrumentId) },
    };

    const result = await this._post("/v1/query", body);
    const matches = Array.isArray(result) ? result : [];

    if (matches.length === 0) {
      const cached = this._lookupCachedContractId(instrumentId);
      return {
        instrumentId: String(instrumentId),
        status: "Archived",
        chain: this.chainId,
        contractId: cached || null,
        note: "no active contract matched query — instrument archived, committed, or never issued",
      };
    }

    // Newest contract = highest contractId or last item; DAML JSON API
    // returns active contracts only, so any match is by definition "active".
    const latest = matches[matches.length - 1];
    this._cacheContractId(instrumentId, latest.contractId);

    return {
      instrumentId: String(instrumentId),
      status: latest.payload && latest.payload.status ? latest.payload.status : "Active",
      chain: this.chainId,
      contractId: latest.contractId,
      payload: latest.payload,
    };
  }

  // ── internals ──────────────────────────────────────────────────────

  async _exerciseAndRecache(instrumentId, choice, action) {
    this._requireInstrumentId(instrumentId);

    const contractId = await this._resolveContractId(instrumentId);
    if (!contractId) {
      throw new Error(
        `CantonAdapter: no active contract found for instrumentId=${instrumentId}`
      );
    }

    const body = {
      templateId: this._templateId(),
      contractId,
      choice,
      argument: {},
    };

    const result = await this._post("/v1/exercise", body);

    // The exercise may archive the input contract and produce a new one
    // (typical DAML pattern). Pick up the new contractId if present so
    // subsequent exercises target the right contract.
    const newContractId = this._extractCreatedContractId(result);
    if (newContractId) {
      this._cacheContractId(instrumentId, newContractId);
    } else {
      // Contract was archived without replacement — drop from cache
      this._invalidateCache(instrumentId);
    }

    return {
      success: true,
      txHash: contractId,
      chain: this.chainId,
      action,
      instrumentId,
      contractId,
      newContractId: newContractId || null,
      exerciseResult:
        result && result.exerciseResult !== undefined ? result.exerciseResult : null,
    };
  }

  async _resolveContractId(instrumentId) {
    const cached = this._lookupCachedContractId(instrumentId);
    if (cached) {
      // Verify the cached contractId is still active. /v1/fetch returns
      // `null` for archived contracts.
      try {
        const fetched = await this._post("/v1/fetch", { contractId: cached });
        if (fetched && fetched.contractId === cached) return cached;
      } catch (_) {
        // fall through to query
      }
      this._invalidateCache(instrumentId);
    }

    const body = {
      templateIds: [this._templateId()],
      query: { [this.instrumentIdField]: String(instrumentId) },
    };
    const result = await this._post("/v1/query", body);
    const matches = Array.isArray(result) ? result : [];
    if (matches.length === 0) return null;

    const latest = matches[matches.length - 1];
    this._cacheContractId(instrumentId, latest.contractId);
    return latest.contractId;
  }

  _extractCreatedContractId(result) {
    if (!result) return null;
    if (Array.isArray(result.events)) {
      for (const ev of result.events) {
        if (ev && ev.created && ev.created.contractId) {
          return ev.created.contractId;
        }
      }
    }
    if (result.contractId) return result.contractId;
    return null;
  }

  _templateId() {
    return `${this.packageId}:${this.moduleName}:${this.templateName}`;
  }

  async _post(endpoint, body) {
    const url = `${this.jsonApiUrl}${endpoint}`;
    const res = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.jwt}`,
      },
      body: JSON.stringify(body),
    });

    let parsed;
    try {
      parsed = await res.json();
    } catch (err) {
      throw new Error(
        `CantonAdapter: ${endpoint} returned non-JSON response (status=${res.status})`
      );
    }

    if (!res.ok || parsed.status >= 400 || parsed.errors) {
      const errs = parsed.errors || [parsed.error || `HTTP ${res.status}`];
      throw new Error(
        `CantonAdapter: ${endpoint} failed — ${
          Array.isArray(errs) ? errs.join("; ") : String(errs)
        }`
      );
    }

    return parsed.result;
  }

  _requireInstrumentId(instrumentId) {
    if (instrumentId === undefined || instrumentId === null || instrumentId === "") {
      throw new Error("CantonAdapter: instrumentId is required");
    }
  }

  // ── local cache ────────────────────────────────────────────────────

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
        `[CantonAdapter] Index read failed (${err.message}). Starting fresh.`
      );
      return {};
    }
  }

  _writeIndex(index) {
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }

  _cacheContractId(instrumentId, contractId) {
    if (!contractId) return;
    const index = this._readIndex();
    index[String(instrumentId)] = contractId;
    this._writeIndex(index);
  }

  _lookupCachedContractId(instrumentId) {
    const index = this._readIndex();
    return index[String(instrumentId)] || null;
  }

  _invalidateCache(instrumentId) {
    const index = this._readIndex();
    if (index[String(instrumentId)]) {
      delete index[String(instrumentId)];
      this._writeIndex(index);
    }
  }
}

module.exports = { CantonAdapter };
