import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy BansosRegistry + BansosDisbursement (+ MockIDRXTest kalau belum ada
 * DANA_TOKEN_ADDRESS di env) ke network yang dipilih lewat --network.
 *
 * Chain lokal (tanpa saldo sungguhan):  npm run node  lalu  npm run deploy:local
 * Polygon Amoy (butuh POL testnet dari faucet di wallet ADMIN_PRIVATE_KEY):
 *   npm run deploy:amoy
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "native token");

  const governance = process.env.GOVERNANCE_ADDRESS && process.env.GOVERNANCE_ADDRESS !== "0x..."
    ? process.env.GOVERNANCE_ADDRESS
    : deployer.address;

  if (governance === deployer.address) {
    console.warn(
      "\n⚠️  GOVERNANCE_ADDRESS belum diisi — memakai wallet deployer sebagai pemegang " +
      "DEFAULT_ADMIN_ROLE sementara. Ini BUKAN aman untuk apa pun di luar testnet/demo " +
      "internal: pindahkan ke multisig (mis. Gnosis Safe) sebelum periode nyata dikunci. " +
      "Lihat docs/06-Smart-Contract-Design.md §3.1.\n",
    );
  }

  let tokenAddress = process.env.DANA_TOKEN_ADDRESS;
  if (!tokenAddress || tokenAddress === "0x...") {
    console.log("\nDeploying MockIDRXTest (tidak ada DANA_TOKEN_ADDRESS di env)...");
    const Token = await ethers.getContractFactory("MockIDRXTest");
    const token = await Token.deploy();
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    console.log("MockIDRXTest:", tokenAddress);

    // Bekal token uji untuk wallet admin, supaya `POST /periode-program/:id/danai-kontrak`
    // di sigap-api langsung bisa dipakai. Hanya untuk token mock — token asli tidak di-mint.
    const BEKAL = 1_000_000_000_000n; // Rp1 triliun dalam unit token (1 unit = Rp1)
    await (await token.mint(deployer.address, BEKAL)).wait();
    console.log("Mint bekal ke deployer:", BEKAL.toString());
  } else {
    console.log("\nMemakai DANA_TOKEN_ADDRESS dari env:", tokenAddress);
  }

  console.log("\nDeploying BansosRegistry...");
  const Registry = await ethers.getContractFactory("BansosRegistry");
  const registry = await Registry.deploy(governance, [deployer.address]);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("BansosRegistry:", registryAddress);

  console.log("\nDeploying BansosDisbursement...");
  const Disbursement = await ethers.getContractFactory("BansosDisbursement");
  const disbursement = await Disbursement.deploy(tokenAddress, registryAddress);
  await disbursement.waitForDeployment();
  const disbursementAddress = await disbursement.getAddress();
  console.log("BansosDisbursement:", disbursementAddress);

  console.log("\n=== Salin ke sigap-api/.env ===");
  console.log(`REGISTRY_CONTRACT_ADDRESS="${registryAddress}"`);
  console.log(`DISBURSEMENT_CONTRACT_ADDRESS="${disbursementAddress}"`);
  console.log(`DANA_TOKEN_ADDRESS="${tokenAddress}"`);

  if (network.name === "localhost") tulisEnvLocalchain(registryAddress, disbursementAddress, tokenAddress!);
}

/**
 * Chain lokal di-reset setiap `npx hardhat node` dinyalakan ulang, jadi alamat
 * kontrak ditulis langsung ke sigap-api/.env.localchain (dibaca `npm run
 * start:localchain`) — tidak perlu salin-tempel setiap kali. Hanya untuk
 * `--network localhost`; alamat testnet tetap disalin manual ke .env.
 */
function tulisEnvLocalchain(registry: string, disbursement: string, token: string) {
  const apiDir = path.resolve(__dirname, "../../sigap-api");
  if (!fs.existsSync(apiDir)) {
    console.log(`\n(sigap-api tidak ditemukan di ${apiDir} — .env.localchain tidak ditulis)`);
    return;
  }
  const isi = [
    "# DIBUAT OTOMATIS oleh sigap-contracts/scripts/deploy.ts --network localhost — jangan diedit manual.",
    "# Menimpa sigap-api/.env saat API dijalankan dengan `npm run start:localchain`.",
    "# Private key = akun #0 bawaan Hardhat (dipublikasikan Hardhat, HANYA untuk chain lokal 31337).",
    "RPC_URL=http://127.0.0.1:8545",
    "CHAIN_ID=31337",
    "ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    `REGISTRY_CONTRACT_ADDRESS=${registry}`,
    `DISBURSEMENT_CONTRACT_ADDRESS=${disbursement}`,
    `DANA_TOKEN_ADDRESS=${token}`,
    "EXPLORER_BASE_URL=",
    "CLAIM_SYNC_INTERVAL_MS=5000",
    "# UI dev boleh di :3000 atau :3100 (port 3000 sering dipakai aplikasi lain — docs/10 §7).",
    "CORS_ORIGIN=http://localhost:3000,http://localhost:3100",
    "",
  ].join("\n");
  const tujuan = path.join(apiDir, ".env.localchain");
  fs.writeFileSync(tujuan, isi);
  console.log(`\n✓ Alamat kontrak ditulis ke ${tujuan}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
