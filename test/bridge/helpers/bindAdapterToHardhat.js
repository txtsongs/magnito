const { EVMAdapter } = require("../../../bridge/adapters/evm-adapter");

/**
 * EVMAdapter's constructor hardcodes `new ethers.JsonRpcProvider(config.rpcUrl)`
 * and `new ethers.Wallet(config.privateKey, provider)` — it has no way to accept
 * an already-connected Hardhat signer. To exercise the REAL adapter class (not a
 * reimplementation of it) against Hardhat's in-process network, we let it
 * construct with throwaway values, then replace the resulting provider/wallet/
 * contract with Hardhat-connected equivalents before any method is called.
 *
 * This changes only the network transport, never the adapter's logic — every
 * lockInstrument/commitInstrument/abortInstrument/issueInstrument call below
 * runs the literal method bodies from bridge/adapters/evm-adapter.js.
 */
function bindAdapterToHardhat({ chainId, contractAddress, hardhatContract, signer }) {
  const adapter = new EVMAdapter({
    chainId,
    rpcUrl: "http://127.0.0.1:59999", // never dialed for real — replaced below
    privateKey: "0x" + "11".repeat(32), // well-formed dummy key — never used for signing
    instrumentAddress: contractAddress,
  });

  adapter.provider = signer.provider;
  adapter.wallet = signer;
  // hardhatContract carries its own full ABI (whatever instrument this is),
  // which already includes lock/unlock/markBridged/isBridged as real
  // functions on the deployed bytecode — the adapter's own narrow
  // IInstrument-only ABI is what production code talks to over a live RPC
  // endpoint; this substitution only replaces the network transport.
  adapter.instrumentContract = hardhatContract.connect(signer);

  return adapter;
}

module.exports = { bindAdapterToHardhat };
