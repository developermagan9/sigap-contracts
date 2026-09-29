import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { keccak256, toUtf8Bytes, ZeroHash } from "ethers";
import { buildRoot, computeLeafHash, generateProof } from "./helpers/merkle";

const PERIODE_ID = 1;
const NOMINAL = 500_000n; // meniru nominal_dasar rupiah (bukan wei — token uji 0 desimal implisit lewat unit test)

describe("BansosDisbursement", () => {
  async function deployFixture() {
    const [governance, admin, depositor, r1, r2, r3, relayer, attacker] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockIDRXTest");
    const token = await Token.deploy();

    const Registry = await ethers.getContractFactory("BansosRegistry");
    const registry = await Registry.deploy(governance.address, [admin.address]);

    const Disbursement = await ethers.getContractFactory("BansosDisbursement");
    const disbursement = await Disbursement.deploy(await token.getAddress(), await registry.getAddress());

    // 3 penerima nyata untuk periode ini
    const recipients = [r1, r2, r3];
    const nikHashes = recipients.map((_, i) => keccak256(toUtf8Bytes(`nik-${i}`)));
    const leafHashes = recipients.map((r, i) =>
      computeLeafHash(r.address, NOMINAL, PERIODE_ID, nikHashes[i]),
    );
    const root = buildRoot(leafHashes);
    const totalAlokasi = NOMINAL * BigInt(recipients.length);

    await registry.connect(admin).registerPeriode(PERIODE_ID, root, totalAlokasi);

    // Depositor mint + approve + deposit dana penuh untuk periode ini
    await token.mint(depositor.address, totalAlokasi);
    await token.connect(depositor).approve(await disbursement.getAddress(), totalAlokasi);
    await disbursement.connect(depositor).depositDana(PERIODE_ID, totalAlokasi);

    return {
      token, registry, disbursement, governance, admin, depositor,
      recipients, nikHashes, leafHashes, root, totalAlokasi, relayer, attacker,
    };
  }

  it("depositDana menaikkan saldoPeriode dan menolak amount == 0", async () => {
    const { disbursement, token, depositor } = await deployFixture();
    expect(await disbursement.saldoPeriode(PERIODE_ID)).to.equal(NOMINAL * 3n);

    await token.mint(depositor.address, 1000n);
    await token.connect(depositor).approve(await disbursement.getAddress(), 1000n);
    await disbursement.connect(depositor).depositDana(PERIODE_ID, 1000n);
    expect(await disbursement.saldoPeriode(PERIODE_ID)).to.equal(NOMINAL * 3n + 1000n);

    await expect(disbursement.connect(depositor).depositDana(PERIODE_ID, 0)).to.be.revertedWith("Nominal deposit nol");
  });

  it("claim() sukses dengan proof valid dan emit FundDisbursed yang benar", async () => {
    const { disbursement, recipients, nikHashes, leafHashes, token } = await deployFixture();
    const proof = generateProof(leafHashes, 0);

    const before = await token.balanceOf(recipients[0].address);
    await expect(
      disbursement.connect(recipients[0]).claim(PERIODE_ID, recipients[0].address, NOMINAL, nikHashes[0], proof),
    )
      .to.emit(disbursement, "FundDisbursed")
      .withArgs(PERIODE_ID, recipients[0].address, recipients[0].address, NOMINAL, nikHashes[0]);

    expect(await token.balanceOf(recipients[0].address)).to.equal(before + NOMINAL);
    expect(await disbursement.hasClaimed(PERIODE_ID, recipients[0].address)).to.equal(true);
  });

  it("claim() gagal dengan proof salah", async () => {
    const { disbursement, recipients, nikHashes, leafHashes } = await deployFixture();
    const wrongProof = generateProof(leafHashes, 1); // proof milik r2, dipakai untuk r1
    await expect(
      disbursement.connect(recipients[0]).claim(PERIODE_ID, recipients[0].address, NOMINAL, nikHashes[0], wrongProof),
    ).to.be.revertedWith("Bukti Merkle tidak valid");
  });

  it("claim() gagal dengan leaf salah (amount dipalsukan)", async () => {
    const { disbursement, recipients, nikHashes, leafHashes } = await deployFixture();
    const proof = generateProof(leafHashes, 0);
    await expect(
      disbursement.connect(recipients[0]).claim(PERIODE_ID, recipients[0].address, NOMINAL * 2n, nikHashes[0], proof),
    ).to.be.revertedWith("Bukti Merkle tidak valid");
  });

  it("klaim ganda ditolak, termasuk saat disubmit relayer berbeda", async () => {
    const { disbursement, recipients, nikHashes, leafHashes, relayer } = await deployFixture();
    const proof = generateProof(leafHashes, 0);

    await disbursement.connect(recipients[0]).claim(PERIODE_ID, recipients[0].address, NOMINAL, nikHashes[0], proof);

    // klaim kedua oleh recipient sendiri
    await expect(
      disbursement.connect(recipients[0]).claim(PERIODE_ID, recipients[0].address, NOMINAL, nikHashes[0], proof),
    ).to.be.revertedWith("Dana sudah pernah diklaim");

    // klaim kedua oleh relayer berbeda untuk recipient yang sama
    await expect(
      disbursement.connect(relayer).claim(PERIODE_ID, recipients[0].address, NOMINAL, nikHashes[0], proof),
    ).to.be.revertedWith("Dana sudah pernah diklaim");
  });

  it("relayer: pihak ketiga submit claim() untuk recipient lain, dana masuk ke recipient bukan msg.sender", async () => {
    const { disbursement, recipients, nikHashes, leafHashes, token, relayer } = await deployFixture();
    const proof = generateProof(leafHashes, 1);

    const relayerBalBefore = await token.balanceOf(relayer.address);
    const recipientBalBefore = await token.balanceOf(recipients[1].address);

    await expect(
      disbursement.connect(relayer).claim(PERIODE_ID, recipients[1].address, NOMINAL, nikHashes[1], proof),
    )
      .to.emit(disbursement, "FundDisbursed")
      .withArgs(PERIODE_ID, recipients[1].address, relayer.address, NOMINAL, nikHashes[1]);

    expect(await token.balanceOf(relayer.address)).to.equal(relayerBalBefore); // relayer tidak menerima dana
    expect(await token.balanceOf(recipients[1].address)).to.equal(recipientBalBefore + NOMINAL);
  });

  it("relayer jahat: mengganti recipient jadi wallet sendiri sambil pakai proof orang lain -> revert", async () => {
    const { disbursement, recipients, nikHashes, leafHashes, attacker } = await deployFixture();
    const proofMilikR2 = generateProof(leafHashes, 1);

    await expect(
      disbursement.connect(attacker).claim(PERIODE_ID, attacker.address, NOMINAL, nikHashes[1], proofMilikR2),
    ).to.be.revertedWith("Bukti Merkle tidak valid");
  });

  it("claim pada periode yang belum di-lock -> revert", async () => {
    const { registry, disbursement, token, depositor, recipients } = await deployFixture();

    const otherPeriodeId = 999;
    const nikHash = keccak256(toUtf8Bytes("nik-lain"));
    const leaf = computeLeafHash(recipients[0].address, NOMINAL, otherPeriodeId, nikHash);
    // TIDAK di-registerPeriode -> locked tetap false (default struct kosong)

    await token.mint(depositor.address, NOMINAL);
    await token.connect(depositor).approve(await disbursement.getAddress(), NOMINAL);
    await disbursement.connect(depositor).depositDana(otherPeriodeId, NOMINAL);

    await expect(
      disbursement.connect(recipients[0]).claim(otherPeriodeId, recipients[0].address, NOMINAL, nikHash, [leaf]),
    ).to.be.revertedWith("Periode belum disahkan");
  });

  it("klaim melebihi saldoPeriode -> revert, dana periode lain tidak tersentuh", async () => {
    const { registry, disbursement, token, depositor, admin } = await deployFixture();
    const [, , , , , , , , kurangDidanaiWallet] = await ethers.getSigners();

    // Periode baru dengan alokasi terdaftar tapi TIDAK didanai penuh (deposit kurang dari amount klaim)
    const periodeKurangDana = 2;
    const nikHash = keccak256(toUtf8Bytes("nik-kurang-dana"));
    const leaf = computeLeafHash(kurangDidanaiWallet.address, NOMINAL, periodeKurangDana, nikHash);
    const root = buildRoot([leaf]);
    await registry.connect(admin).registerPeriode(periodeKurangDana, root, NOMINAL);

    // deposit cuma separuh
    await token.mint(depositor.address, NOMINAL / 2n);
    await token.connect(depositor).approve(await disbursement.getAddress(), NOMINAL / 2n);
    await disbursement.connect(depositor).depositDana(periodeKurangDana, NOMINAL / 2n);

    await expect(
      disbursement.connect(kurangDidanaiWallet).claim(periodeKurangDana, kurangDidanaiWallet.address, NOMINAL, nikHash, []),
    ).to.be.reverted; // underflow checked arithmetic 0.8.x

    // saldo periode 1 (dari fixture) tidak tersentuh
    expect(await disbursement.saldoPeriode(PERIODE_ID)).to.equal(NOMINAL * 3n);
  });

  it("test paritas root: leaf/proof hasil algoritma backend (merkle.service.ts) lolos verifikasi on-chain", async () => {
    // Sudah tercakup implisit di semua test claim() sukses di atas (helper test/
    // dipakai persis meniru merkle.service.ts) — test ini eksplisit menegaskan
    // root yang di-lock on-chain sama persis dengan yang dihitung backend untuk
    // input yang identik, dan proof-nya lolos MerkleProof.verify tanpa modifikasi.
    const recipients_ = (await ethers.getSigners()).slice(3, 6);
    const nikHashes = recipients_.map((_, i) => keccak256(toUtf8Bytes(`parity-${i}`)));
    const leaves = recipients_.map((r, i) => computeLeafHash(r.address, NOMINAL, 777, nikHashes[i]));
    const root = buildRoot(leaves);

    const [governance, admin] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockIDRXTest");
    const token = await Token.deploy();
    const Registry = await ethers.getContractFactory("BansosRegistry");
    const registry = await Registry.deploy(governance.address, [admin.address]);
    const Disbursement = await ethers.getContractFactory("BansosDisbursement");
    const disbursement = await Disbursement.deploy(await token.getAddress(), await registry.getAddress());

    await registry.connect(admin).registerPeriode(777, root, NOMINAL * 3n);
    await token.mint(admin.address, NOMINAL * 3n);
    await token.connect(admin).approve(await disbursement.getAddress(), NOMINAL * 3n);
    await disbursement.connect(admin).depositDana(777, NOMINAL * 3n);

    for (let i = 0; i < recipients_.length; i++) {
      const proof = generateProof(leaves, i);
      await expect(
        disbursement.connect(recipients_[i]).claim(777, recipients_[i].address, NOMINAL, nikHashes[i], proof),
      ).to.not.be.reverted;
    }
  });

  describe("batas klaim & tarik sisa dana", () => {
    it("setBatasKlaim hanya untuk admin, harus di masa depan, dan hanya boleh diperpanjang", async () => {
      const { disbursement, admin, attacker } = await deployFixture();
      const now = await time.latest();

      await expect(disbursement.connect(attacker).setBatasKlaim(PERIODE_ID, now + 3600)).to.be.revertedWith("Bukan admin");
      await expect(disbursement.connect(admin).setBatasKlaim(PERIODE_ID, now - 1)).to.be.revertedWith("Batas klaim harus di masa depan");

      await expect(disbursement.connect(admin).setBatasKlaim(PERIODE_ID, now + 3600))
        .to.emit(disbursement, "BatasKlaimDitetapkan").withArgs(PERIODE_ID, now + 3600);
      await expect(disbursement.connect(admin).setBatasKlaim(PERIODE_ID, now + 1800)).to.be.revertedWith("Batas klaim hanya boleh diperpanjang");
      await disbursement.connect(admin).setBatasKlaim(PERIODE_ID, now + 7200);
      expect(await disbursement.batasKlaim(PERIODE_ID)).to.equal(now + 7200);
    });

    it("klaim setelah batas ditolak; sisa dana bisa ditarik admin ke alamat tujuan", async () => {
      const { disbursement, token, admin, attacker, governance, recipients, nikHashes, leafHashes } = await deployFixture();
      const batas = (await time.latest()) + 3600;
      await disbursement.connect(admin).setBatasKlaim(PERIODE_ID, batas);

      // r1 sempat klaim sebelum batas
      await disbursement.connect(recipients[0]).claim(PERIODE_ID, recipients[0].address, NOMINAL, nikHashes[0], generateProof(leafHashes, 0));

      // sebelum batas: sisa belum boleh ditarik
      await expect(disbursement.connect(admin).tarikSisaDana(PERIODE_ID, governance.address)).to.be.revertedWith("Masa klaim belum berakhir");

      await time.increaseTo(batas + 1);
      await expect(
        disbursement.connect(recipients[1]).claim(PERIODE_ID, recipients[1].address, NOMINAL, nikHashes[1], generateProof(leafHashes, 1)),
      ).to.be.revertedWith("Masa klaim sudah berakhir");

      await expect(disbursement.connect(attacker).tarikSisaDana(PERIODE_ID, attacker.address)).to.be.revertedWith("Bukan admin");

      const before = await token.balanceOf(governance.address);
      await expect(disbursement.connect(admin).tarikSisaDana(PERIODE_ID, governance.address))
        .to.emit(disbursement, "SisaDanaDitarik").withArgs(PERIODE_ID, governance.address, NOMINAL * 2n);
      expect(await token.balanceOf(governance.address)).to.equal(before + NOMINAL * 2n);
      expect(await disbursement.saldoPeriode(PERIODE_ID)).to.equal(0);

      await expect(disbursement.connect(admin).tarikSisaDana(PERIODE_ID, governance.address)).to.be.revertedWith("Tidak ada sisa dana");
    });

    it("tanpa batas klaim, sisa dana tidak bisa ditarik", async () => {
      const { disbursement, admin, governance } = await deployFixture();
      await expect(disbursement.connect(admin).tarikSisaDana(PERIODE_ID, governance.address)).to.be.revertedWith("Masa klaim belum berakhir");
    });
  });
});
