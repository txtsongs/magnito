const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/**
 * A fresh, unique journal file path per test — keeps bridge tests hermetic
 * (no shared state via data/bridge-journal.json) and keeps the repo's real
 * data/ directory clean of test residue.
 */
function makeTempJournalPath() {
  return path.join(os.tmpdir(), `magnito-journal-${crypto.randomUUID()}.json`);
}

function cleanupJournalPath(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    // already gone — fine
  }
}

module.exports = { makeTempJournalPath, cleanupJournalPath };
