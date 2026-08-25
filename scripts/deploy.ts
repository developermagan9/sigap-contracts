import { ethers } from "hardhat";

/**
 * Deploy BansosRegistry + BansosDisbursement (+ MockIDRXTest kalau belum ada
 * DANA_TOKEN_ADDRESS di env) ke network yang dipilih lewat --network.
 *
 * BELUM PERNAH DIJALANKAN terhadap testnet sungguhan — sigap-api/.env masih berisi
 * ADMIN_PRIVATE_KEY placeholder ("0x_your_deployer_private_key"), jadi tidak ada
 * wallet deployer terdanai untuk benar-benar mengeksekusi ini di Polygon Amoy.
 * Jalankan manual setelah private key testnet asli terisi:
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
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
