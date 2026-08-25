import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, toUtf8Bytes, ZeroHash } from "ethers";

describe("BansosRegistry", () => {
  async function deploy() {
    const [governance, admin1, admin2, stranger] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("BansosRegistry");
    const registry = await Registry.deploy(governance.address, [admin1.address]);
    return { registry, governance, admin1, admin2, stranger };
  }

  const ADMIN_ROLE = keccak256(toUtf8Bytes("ADMIN_ROLE"));

  it("registerPeriode hanya bisa dipanggil ADMIN_ROLE; non-admin ditolak", async () => {
    const { registry, admin1, stranger } = await deploy();
    await expect(registry.connect(admin1).registerPeriode(1, keccak256(toUtf8Bytes("root")), 1000)).to.not.be.reverted;

    await expect(
      registry.connect(stranger).registerPeriode(2, keccak256(toUtf8Bytes("root2")), 1000),
    ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("DEFAULT_ADMIN_ROLE dipegang governance dan bisa mencabut ADMIN_ROLE", async () => {
    const { registry, governance, admin1 } = await deploy();
    expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), governance.address)).to.equal(true);
    expect(await registry.hasRole(ADMIN_ROLE, admin1.address)).to.equal(true);

    await registry.connect(governance).revokeRole(ADMIN_ROLE, admin1.address);
    expect(await registry.hasRole(ADMIN_ROLE, admin1.address)).to.equal(false);

    // Admin yang sudah dicabut tidak bisa lagi registerPeriode
    await expect(
      registry.connect(admin1).registerPeriode(3, keccak256(toUtf8Bytes("root3")), 1000),
    ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("menolak merkleRoot == 0", async () => {
    const { registry, admin1 } = await deploy();
    await expect(registry.connect(admin1).registerPeriode(1, ZeroHash, 1000)).to.be.revertedWith("Merkle root kosong");
  });

  it("menolak totalAlokasi == 0", async () => {
    const { registry, admin1 } = await deploy();
    await expect(
      registry.connect(admin1).registerPeriode(1, keccak256(toUtf8Bytes("root")), 0),
    ).to.be.revertedWith("Total alokasi nol");
  });

  it("root tidak bisa didaftarkan ulang setelah locked = true", async () => {
    const { registry, admin1 } = await deploy();
    await registry.connect(admin1).registerPeriode(1, keccak256(toUtf8Bytes("root")), 1000);
    await expect(
      registry.connect(admin1).registerPeriode(1, keccak256(toUtf8Bytes("root-baru")), 2000),
    ).to.be.revertedWith("Periode sudah dikunci, tidak bisa diubah");
  });

  it("emit PeriodeRegistered dengan data yang benar", async () => {
    const { registry, admin1 } = await deploy();
    const root = keccak256(toUtf8Bytes("root"));
    await expect(registry.connect(admin1).registerPeriode(42, root, 5000))
      .to.emit(registry, "PeriodeRegistered")
      .withArgs(42, root, 5000);
  });
});
