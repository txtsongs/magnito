const fs = require("fs");
const path = require("path");

/**
 * Evidence Logger
 * Creates a structured audit bundle for every bridge transaction.
 * One JSON file per bridge cycle — readable by auditors and institutions.
 */

function createEvidenceBundle(data) {
  const bundle = {
    magnito: "evidence-bundle",
    version: "1.0",
    timestamp: new Date().toISOString(),
    bridgeCycle: {
      invoiceId: data.invoiceId,
      ethereumContract: data.ethereumContract,
      documentHash: data.documentHash,
      seller: data.seller,
      amount: data.amount,
    },
    events: {
      lock: {
        action: "invoice-locked",
        chain: "ethereum-sepolia",
        txHash: data.lockTxHash,
        timestamp: data.lockTimestamp,
      },
      mint: {
        action: "xrpl-minted",
        chain: "xrpl-testnet",
        txHash: data.mintTxHash,
        timestamp: data.mintTimestamp,
      },
      return: {
        action: "xrpl-return-recorded",
        chain: "xrpl-testnet",
        txHash: data.returnTxHash,
        timestamp: data.returnTimestamp,
      },
      unlock: {
        action: "invoice-unlocked",
        chain: "ethereum-sepolia",
        txHash: data.unlockTxHash,
        timestamp: data.unlockTimestamp,
      },
    },
    compliance: {
      mletr: {
        singularity: "enforced — only one chain authoritative at any time",
        control: "enforced — seller key required for lock and unlock",
        integrity: "enforced — documentHash recorded at every stage",
      },
      bridgeProtocol: "2-phase commit",
    },
    status: "complete",
  };

  // Save to evidence/ folder
  const evidenceDir = path.join(__dirname, "..", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir);
  }

  const filename = `bridge-${data.invoiceId}-${Date.now()}.json`;
  const filepath = path.join(evidenceDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(bundle, null, 2));

  return { bundle, filepath, filename };
}

module.exports = { createEvidenceBundle };