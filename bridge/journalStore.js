const fs = require("fs");
const path = require("path");

const DEFAULT_JOURNAL_PATH = path.join(__dirname, "..", "data", "bridge-journal.json");

/**
 * Durable on-disk record of in-flight bridge operations.
 *
 * The orchestrator writes to this after every 2PC step so that a crash
 * between any two steps — e.g. between lock and mint — can be reconciled
 * on restart: recover() reads whatever was last durably written and
 * reconciles it against real on-chain state, rather than losing track of
 * the bridge entirely.
 *
 * Same read/write/index pattern already used by the VeChain and Canton
 * adapters' local caches (data/vechain_attestations.json,
 * data/canton_contracts.json) — one journal entry per key, keyed by
 * whatever the orchestrator considers a unique in-flight bridge.
 */
class JournalStore {
  constructor(filePath) {
    this.filePath = filePath || DEFAULT_JOURNAL_PATH;
    this._ensureDir();
  }

  _ensureDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _readAll() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const raw = fs.readFileSync(this.filePath, "utf8");
      if (!raw.trim()) return {};
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[JournalStore] Read failed (${err.message}). Treating journal as empty.`);
      return {};
    }
  }

  _writeAll(all) {
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2));
  }

  /** Every entry currently in the journal, keyed by bridge key. */
  all() {
    return this._readAll();
  }

  /** A single entry, or null if not present. */
  get(key) {
    const all = this._readAll();
    return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null;
  }

  /** Durably persist (or overwrite) one entry. */
  write(key, entry) {
    const all = this._readAll();
    all[key] = entry;
    this._writeAll(all);
  }

  /** Remove one entry — called once a bridge is fully resolved (complete or cleanly aborted). */
  remove(key) {
    const all = this._readAll();
    if (Object.prototype.hasOwnProperty.call(all, key)) {
      delete all[key];
      this._writeAll(all);
    }
  }
}

module.exports = { JournalStore, DEFAULT_JOURNAL_PATH };
