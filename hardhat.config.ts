import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const CHAIN_ID = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 80002;
// Placeholder key ("0x_your_deployer_private_key" di .env.example) sengaja TIDAK dipakai
// langsung sebagai account — Hardhat akan menolaknya (bukan hex 32-byte valid) kalau
// benar-benar dipakai untuk deploy. Network `amoy` hanya terisi account nyata saat
// ADMIN_PRIVATE_KEY sudah diisi private key testnet sungguhan oleh operator.
const DEPLOYER_KEY = process.env.ADMIN_PRIVATE_KEY;
const hasValidDeployerKey = !!DEPLOYER_KEY && /^0x[0-9a-fA-F]{64}$/.test(DEPLOYER_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    amoy: {
      url: RPC_URL,
      chainId: CHAIN_ID,
      accounts: hasValidDeployerKey ? [DEPLOYER_KEY!] : [],
    },
  },
};

export default config;
