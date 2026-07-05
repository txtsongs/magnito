require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Hardhat validates every network's config eagerly at startup, even for
// tasks that never touch these networks (e.g. `npx hardhat test`, which
// only runs against the in-process Hardhat network). Without a fallback,
// a fresh clone with no .env fails config validation before a single test
// runs. `accounts` only gets populated when a real key is present.
const sepoliaAccounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
const xdcAccounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_API_URL || "",
      accounts: sepoliaAccounts,
    },
    xdc: {
      url: "https://rpc.apothem.network",
      accounts: xdcAccounts,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    scripts: "./scripts",
  },
};