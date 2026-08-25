# sigap-contracts

Smart contracts SIGAP-Bansos — implementasi `docs/06-Smart-Contract-Design.md`.

## Status

- ✅ `BansosRegistry.sol`, `BansosDisbursement.sol` — implementasi persis sesuai spesifikasi dokumen (OpenZeppelin Contracts v5: `AccessControl`, `MerkleProof`, `SafeERC20`, `ReentrancyGuard`).
- ✅ `MockIDRXTest.sol` — token ERC-20 uji (siapa pun bisa `mint()`) yang mensimulasikan "IDRX-Test" untuk testnet/test suite, sesuai §2. **Bukan token produksi.**
- ✅ 16 test Hardhat (`npm test`), mencakup seluruh skenario di §6: akses kontrol `registerPeriode`, revoke `ADMIN_ROLE`, penolakan root/alokasi kosong, penguncian periode, klaim sukses/gagal, klaim ganda (termasuk lintas relayer), relayer sah vs. relayer jahat, klaim pada periode belum terkunci, klaim melebihi saldo periode, event `FundDisbursed`, dan **test paritas root** — proof yang dihasilkan algoritma yang sama persis dengan `sigap-api/src/blockchain/merkle.service.ts` lolos `MerkleProof.verify` on-chain.
- ✅ `scripts/deploy.ts` — sudah diverifikasi jalan (dites terhadap Hardhat network lokal, deploy sukses, alamat kontrak tercetak siap-tempel ke `sigap-api/.env`).
- ✅ `sigap-api/src/blockchain/blockchain.service.ts submitOnchain()` sekarang punya jalur ethers.js sungguhan (`registerPeriode()` on-chain) — **diverifikasi terhadap Hardhat node lokal** (bukan cuma dibaca kodenya): transaksi terkirim, root benar-benar terkunci on-chain, dibaca ulang lewat `periodeData()` dan cocok persis dengan yang dikirim. Otomatis jatuh ke simulasi lama (perilaku sebelum perubahan ini, ditandai `simulated: true` di response & audit log) selama `RPC_URL`/`ADMIN_PRIVATE_KEY`/`REGISTRY_CONTRACT_ADDRESS` di `sigap-api/.env` belum diisi kredensial testnet sungguhan.
- ❌ **Belum pernah dideploy ke Polygon Amoy (atau testnet publik mana pun).** `sigap-api/.env` — `ADMIN_PRIVATE_KEY` masih placeholder (`0x_your_deployer_private_key`), jadi tidak ada wallet deployer terdanai. Ini bukan keterbatasan teknis, murni belum ada kredensial.
- ❌ `claim()` belum pernah benar-benar dipanggil dari UI warga/relayer di dunia nyata (cuma di test).

## Cara lanjut ke testnet sungguhan

1. Buat wallet baru khusus deployer, isi dengan MATIC testnet dari [faucet Polygon Amoy](https://faucet.polygon.technology/).
2. Salin `.env.example` → `.env`, isi `ADMIN_PRIVATE_KEY` dengan private key wallet itu (**jangan pernah commit**).
3. `npm run deploy:amoy` — mencetak tiga alamat kontrak.
4. Salin tiga alamat itu ke `sigap-api/.env` (`REGISTRY_CONTRACT_ADDRESS`, `DISBURSEMENT_CONTRACT_ADDRESS`, `DANA_TOKEN_ADDRESS`), plus `ADMIN_PRIVATE_KEY`/`RPC_URL` yang sama.
5. Restart `sigap-api` — `submitOnchain()` otomatis pindah dari simulasi ke transaksi sungguhan (lihat `getChainConfig()` di `blockchain.service.ts`), tidak perlu ubah kode lagi.
6. Sebelum periode nyata dikunci: pindahkan `DEFAULT_ADMIN_ROLE` dari wallet deployer ke multisig (Gnosis Safe) sesuai §3.1 — `scripts/deploy.ts` mencetak peringatan eksplisit kalau `GOVERNANCE_ADDRESS` belum diisi.

## Yang sengaja belum digarap

- Test suite Hardhat untuk `MockIDRXTest.sol` sendiri — trivial (wrapper `ERC20.mint`), tidak masuk skenario keamanan §6.
- Integrasi `claim()` dari sisi `sigap-ui` (halaman warga men-submit klaim dari wallet sendiri via WalletConnect, atau relayer/pendamping desa) — di luar scope kontrak, task frontend terpisah.
