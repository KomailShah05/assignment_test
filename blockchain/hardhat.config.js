require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // Default target. `npm run node` starts this at 127.0.0.1:8545.
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545"
    }
  }
};
