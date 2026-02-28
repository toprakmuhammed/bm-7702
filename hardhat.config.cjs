require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
    solidity: {
        version: "0.8.27",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        monadTestnet: {
            url: "https://testnet-rpc.monad.xyz",
            chainId: 10143,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
};

module.exports = config;
