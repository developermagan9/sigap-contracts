# sigap-contracts

Smart contract untuk **SIGAP** (Sistem Integrasi Gerakan Akuntabilitas Penyaluran). Kontrak di repo ini mengunci daftar penerima bantuan yang sudah disahkan dan mencairkan dana langsung ke wallet tiap penerima.

README ini menjelaskan cara menjalankan seluruh sistem di komputer sendiri. Kontrak tidak berjalan sendirian: ia dipakai oleh dua repo lainnya.

- [`sigap-api`](https://github.com/developermagan9/sigap-api): backend
- [`sigap-ui`](https://github.com/developermagan9/sigap-ui): tampilan web

## Yang dibutuhkan

- Node.js 20 atau lebih baru (CI memakai Node 22)
- Docker, untuk menjalankan PostgreSQL
- `openssl`, untuk membuat tiga nilai rahasia backend
- MetaMask atau dompet browser lain, untuk mencoba klaim sebagai penerima

## Susunan folder

Letakkan ketiga repo bersebelahan dalam satu folder. Skrip pemasangan kontrak mencari folder `sigap-api` di sebelahnya untuk menuliskan alamat kontrak.

```
sigap/
  sigap-contracts/
  sigap-api/
  sigap-ui/
```

```bash
mkdir sigap && cd sigap
git clone https://github.com/developermagan9/sigap-contracts.git
git clone https://github.com/developermagan9/sigap-api.git
git clone https://github.com/developermagan9/sigap-ui.git
```

Branch `feature/onchain-claim` di repo ini memuat versi terbaru kontrak, termasuk batas klaim dan penarikan sisa dana.

## Urutan menjalankan

Dibutuhkan empat terminal. Urutannya penting: jaringan blockchain dulu, lalu kontrak, lalu backend, baru tampilan.

| Terminal | Folder | Yang dijalankan | Alamat |
|---|---|---|---|
| 1 | `sigap-contracts` | Jaringan blockchain lokal | `http://127.0.0.1:8545` |
| 2 | `sigap-contracts` | Pemasangan kontrak (sekali jalan) | - |
| 3 | `sigap-api` | Backend | `http://localhost:3001` |
| 4 | `sigap-ui` | Tampilan web | `http://localhost:3000` |

Hanya ingin mencoba backend dan tampilan tanpa blockchain? Lewati langkah 1, 2, dan 5. Jalankan langkah 3 dengan `npm run dev` (bukan `start:localchain`) dan langkah 4 seperti biasa. Langkah on-chain berjalan sebagai simulasi, jadi klaim lewat wallet tidak bisa dicoba.

### Langkah 1: jalankan jaringan blockchain lokal

Di terminal 1:

```bash
cd sigap-contracts
npm install
npm run node
```

Biarkan terminal ini tetap terbuka. Hardhat menampilkan 20 akun uji beserta kunci privatnya. Akun nomor 0 dipakai sebagai admin, akun lainnya bisa dipakai sebagai wallet penerima.

### Langkah 2: pasang kontrak

Di terminal 2:

```bash
cd sigap-contracts
npm run deploy:local
```

Skrip ini melakukan tiga hal:

1. memasang `MockIDRXTest`, `BansosRegistry`, dan `BansosDisbursement` ke jaringan lokal;
2. memberi token uji ke akun admin sebagai dana bantuan;
3. menulis file `sigap-api/.env.localchain` berisi alamat kontrak dan pengaturan jaringan.

Peringatan `GOVERNANCE_ADDRESS belum diisi` yang muncul di terminal wajar untuk jaringan lokal. Di sini akun admin sekaligus menjadi pemegang peran tertinggi kontrak.

Isi `.env.localchain` yang dihasilkan:

| Nama | Isi |
|---|---|
| `RPC_URL` | `http://127.0.0.1:8545` |
| `CHAIN_ID` | `31337` |
| `ADMIN_PRIVATE_KEY` | Kunci akun nomor 0 bawaan Hardhat |
| `REGISTRY_CONTRACT_ADDRESS` | Alamat `BansosRegistry` |
| `DISBURSEMENT_CONTRACT_ADDRESS` | Alamat `BansosDisbursement` |
| `DANA_TOKEN_ADDRESS` | Alamat `MockIDRXTest` |
| `EXPLORER_BASE_URL` | Kosong, karena jaringan lokal tidak punya block explorer |
| `CLAIM_SYNC_INTERVAL_MS` | `5000` |
| `CORS_ORIGIN` | `http://localhost:3000,http://localhost:3100` |

File ini dibuat otomatis, jadi tidak perlu diisi dengan tangan.

### Langkah 3: jalankan backend

Jalankan PostgreSQL lebih dulu. Nilai di bawah sama dengan `DATABASE_URL` di `sigap-api/.env.example`.

```bash
docker run -d --name sigap-postgres \
  -e POSTGRES_USER=sigap -e POSTGRES_PASSWORD=sigap_secret -e POSTGRES_DB=sigap_bansos \
  -p 5432:5432 postgres:16-alpine
```

Lalu di terminal 3:

```bash
cd sigap-api
npm install
cp .env.example .env
```

Buka `.env` dan isi tiga nilai rahasia. Masing-masing dibuat dengan `openssl rand -hex 32`:

- `JWT_SECRET`
- `SYSTEM_PEPPER`
- `DB_ENCRYPTION_KEY`

Bagian blockchain di `.env` tidak perlu diubah, karena akan ditimpa oleh `.env.localchain`.

Siapkan database dan akun awal. Langkah ini cukup sekali, dan urutannya harus begini karena seed akun membutuhkan data wilayah:

```bash
npx prisma db push
npm run wilayah:seed
npm run prisma:seed
```

Jalankan backend dengan pengaturan jaringan lokal:

```bash
npm run start:localchain
```

Perintah ini berbeda dari `npm run dev`. Dengan `start:localchain`, backend membaca `.env.localchain` sehingga langkah on-chain memakai kontrak sungguhan. Dengan `npm run dev`, langkah on-chain berjalan sebagai simulasi.

Tanda berhasil: log backend saat mulai menampilkan `mode blockchain: on-chain nyata (kredensial lengkap)`, bukan `SIMULASI`.

### Langkah 4: jalankan tampilan web

Di terminal 4:

```bash
cd sigap-ui
npm install
```

Buat file `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/v1
NEXT_PUBLIC_CHAIN_NAME=Hardhat Lokal
```

Lalu jalankan:

```bash
npm run dev
```

Buka `http://localhost:3000`. Kalau port 3000 sudah dipakai aplikasi lain, jalankan dengan `npm run dev -- -p 3100`. Alamat `http://localhost:3100` sudah termasuk di `CORS_ORIGIN` yang ditulis langkah 2.

Dua pengaturan lain di `sigap-ui/.env.example` tidak perlu diisi untuk jaringan lokal:

- `NEXT_PUBLIC_HARDHAT_RPC`: bawaannya `http://127.0.0.1:8545`, yang sudah benar di komputer sendiri.
- `NEXT_PUBLIC_EXPLORER_BASE`: bawaannya menunjuk ke Polygon Amoy. Tautan "lihat di explorer" di tampilan tidak akan membuka transaksi lokal, karena jaringan lokal tidak punya explorer.

### Langkah 5: siapkan wallet penerima

Impor salah satu akun uji ke MetaMask dengan kunci privat yang ditampilkan di terminal 1, misalnya akun nomor 1. Alamat akun itulah yang diisi sebagai wallet penerima saat pendataan. Daftar alamat akun 0 sampai 19 ada di [`docs/wallet-testing.md`](docs/wallet-testing.md).

Jaringan Hardhat tidak perlu ditambahkan dengan tangan: saat penerima menekan klaim, tampilan meminta MetaMask berpindah ke jaringan `31337` atau menambahkannya. Kalau tetap ingin menambahkannya sendiri, isinya:

| Isian | Nilai |
|---|---|
| Nama jaringan | Hardhat Lokal |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Simbol mata uang | ETH |

## Akun untuk login

Dibuat oleh `npm run prisma:seed`. Semua untuk keperluan uji.

| Role | Username | Password | Halaman setelah login |
|---|---|---|---|
| Admin | `admin` | `password123` | `/admin/periode` |
| Petugas | `petugas` | `password123` | `/petugas/tugas` |
| Verifikator | `verifikator` | `password123` | `/admin/verifikasi` |
| Auditor | `auditor` | `password123` | `/admin/audit-log` |
| Super admin | `ITSUP` | lihat `sigap-api/prisma/seed.ts` | `/admin/periode` |

Petugas dan verifikator hanya bisa bekerja di wilayah kewenangannya. Akun seed memegang dua desa: Mekarsari, Ciparay (`32.04.29.2003`) dan Balecatur, Gamping, Sleman (`34.04.01.2001`). Pilih salah satunya saat mendata.

## Wallet untuk testing

Wallet penerima diisi saat pendataan dan dipakai untuk klaim. Semuanya akun uji bawaan Hardhat. Ada tiga cara melihat datanya:

| Cara | Perintah atau lokasi | Hasil |
|---|---|---|
| Baca daftarnya | [`docs/wallet-testing.md`](docs/wallet-testing.md) | Tabel alamat akun 0 sampai 19 beserta peruntukannya |
| Cetak di terminal | `npm run wallets` di folder `sigap-contracts` | 20 alamat, satu per baris. `npm run wallets -- 40` mencetak 40 alamat |
| Lihat bersama kunci privatnya | Terminal 1 (`npm run node`) | Tiap "Account #n" beserta kunci privatnya, untuk diimpor ke MetaMask |

Contoh keluaran `npm run wallets`:

```
  0  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  (admin dan deployer, bukan penerima)
  1  0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  2  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
```

Nomor di sini sama dengan "Account #n" di terminal 1. Aturan pakainya:

- Akun nomor 0 adalah admin dan deployer. Jangan dipakai sebagai penerima.
- Akun nomor 1 sampai 19 dipakai sebagai penerima. Masing-masing punya ETH untuk biaya gas klaim. Akun nomor 20 ke atas tidak punya saldo.
- Satu alamat untuk satu keluarga dalam satu periode.
- Kunci privat tidak disimpan di repo. Ambil dari output `npm run node`.

## Mencoba alurnya

Nama menu dan tombol di bawah sama dengan yang tampil di aplikasi.

1. Login sebagai `admin`, buat periode lewat menu **Periode Baru**. Lalu di **Dashboard Program**, klik **Jadikan aktif** pada periode itu. Semua halaman bekerja pada periode yang sedang aktif.
2. Login sebagai `petugas`, buka **Form Input**, lalu masukkan beberapa keluarga di desa Mekarsari atau Balecatur. Isi kolom wallet dengan alamat akun uji Hardhat dari [`docs/wallet-testing.md`](docs/wallet-testing.md), satu alamat untuk satu keluarga. NIK dan nomor KK harus 16 digit.
3. Login sebagai `verifikator`, buka **Verifikasi Data**, lalu setujui data tersebut.
4. Login sebagai `admin`, lalu berurutan:
   - **Analisis Clustering**: klik **Jalankan clustering**.
   - **Konfigurasi Bobot**: klik **Jalankan ranking dengan bobot ini**.
   - **Review & Approval**: klik **Sahkan daftar final**. Kalau tombolnya bertuliskan "Jalankan alokasi dulu", jalankan ranking dan alokasi lebih dulu.
5. Buka **Penyaluran On-chain**, lalu klik berurutan: **Bangun Merkle Root**, **Submit ke Chain**, **Danai Kontrak**. Setelah submit, daftar penerima tidak bisa diubah lagi.
6. Buka **Cek Status Bansos** (halaman publik), sambungkan MetaMask dengan akun penerima, lalu klaim.
7. Kembali sebagai `admin` di **Penyaluran On-chain**: klik **Sinkron Klaim** untuk menarik status klaim terbaru, lalu **Atur Batas Klaim**. Batas hanya bisa diperpanjang, tidak bisa dimajukan. Setelah batas itu lewat, klik **Tarik Sisa Dana**. Klaim ditutup dan sisa dana kembali ke alamat tujuan yang Anda isi.

## Kalau jaringan lokal dimatikan

Isi jaringan Hardhat hilang setiap kali terminal 1 ditutup. Setelah menyalakannya lagi:

1. Jalankan ulang `npm run deploy:local`.
2. Jalankan ulang backend dengan `npm run start:localchain`.
3. Di MetaMask, buka pengaturan akun lalu hapus data aktivitas. Tanpa ini, MetaMask memakai nomor urut transaksi lama dan transaksi ditolak.
4. Buat periode program baru. Periode yang sudah di-submit sebelumnya tidak lagi ada di jaringan, padahal database masih mencatatnya.

## Masalah yang sering muncul

| Gejala | Penyebab dan jalan keluar |
|---|---|
| `start:localchain` berhenti dengan pesan belum ada `.env.localchain` | Langkah 2 belum dijalankan, atau folder `sigap-api` tidak bersebelahan dengan `sigap-contracts` |
| `prisma:seed` berhenti dengan pesan referensi wilayah belum lengkap | `npm run wilayah:seed` belum dijalankan |
| Submit on-chain berhasil tetapi ditandai simulasi | Backend dijalankan dengan `npm run dev`, bukan `npm run start:localchain` |
| Danai Kontrak ditolak karena kontrak belum dikonfigurasi | Sama seperti di atas, atau jaringan lokal belum jalan |
| Petugas ditolak saat menyimpan data karena di luar wilayah | Pilih desa Mekarsari atau Balecatur, yaitu wilayah akun `petugas` |
| Klaim ditolak di MetaMask karena nonce | Jaringan lokal baru dinyalakan ulang. Hapus data aktivitas akun di MetaMask |
| Tampilan tidak bisa menghubungi backend | Periksa `NEXT_PUBLIC_API_URL`, dan pastikan alamat tampilan ada di `CORS_ORIGIN` |

## Menjalankan test

Test kontrak tidak butuh jaringan lokal, database, atau backend:

```bash
npm run compile   # kompilasi kontrak
npm test          # menjalankan 19 pengujian
```

Pengujian mencakup kontrol akses, penguncian periode, klaim sah dan klaim palsu, klaim ganda (termasuk lewat relayer berbeda), batas klaim dan penarikan sisa dana, serta kecocokan Merkle root dengan algoritma di `sigap-api/src/blockchain/merkle.service.ts`.

## Memasang ke Polygon Amoy (opsional)

Langkah 1 sampai 5 di atas memakai jaringan lokal. Untuk jaringan uji publik:

1. Buat wallet baru khusus deployer, lalu isi dengan POL testnet dari [faucet Polygon Amoy](https://faucet.polygon.technology/).
2. Salin `.env.example` menjadi `.env`, lalu isi `ADMIN_PRIVATE_KEY` dengan kunci privat wallet itu. Formatnya `0x` diikuti 64 karakter hex. Jangan pernah meng-commit file ini.
3. Isi `GOVERNANCE_ADDRESS` dengan alamat multisig (misalnya Gnosis Safe) yang akan memegang peran tertinggi. Kalau dikosongkan, wallet deployer yang memegangnya, dan itu tidak aman di luar demo.
4. Jalankan `npm run deploy:amoy`. Skrip mencetak tiga alamat kontrak.
5. Salin ketiga alamat itu ke `sigap-api/.env` (`REGISTRY_CONTRACT_ADDRESS`, `DISBURSEMENT_CONTRACT_ADDRESS`, `DANA_TOKEN_ADDRESS`), bersama `RPC_URL`, `CHAIN_ID`, dan `ADMIN_PRIVATE_KEY` yang sama.
6. Jalankan backend dengan `npm run dev`. Backend otomatis berpindah dari simulasi ke transaksi sungguhan begitu kelima nilai blockchain terisi.

Tanpa `DANA_TOKEN_ADDRESS` di `.env`, skrip memasang `MockIDRXTest` sebagai token uji. Token itu bukan rupiah digital sungguhan.

## Isi repo

| Kontrak | Fungsi |
|---|---|
| `BansosRegistry.sol` | Menyimpan Merkle root dan total alokasi tiap periode. Root yang sudah terdaftar tidak bisa diganti |
| `BansosDisbursement.sol` | Menampung dana tiap periode dan mencairkannya ke penerima yang menunjukkan bukti Merkle. Mengatur batas klaim dan penarikan sisa dana |
| `mocks/MockIDRXTest.sol` | Token ERC-20 uji sebagai pengganti rupiah digital. Bukan token sungguhan |

| Folder | Isi |
|---|---|
| `contracts/` | Kode Solidity |
| `scripts/deploy.ts` | Skrip pemasangan kontrak |
| `docs/wallet-testing.md` | Daftar alamat wallet uji (akun Hardhat 0 sampai 19) dan cara memakainya |
| `scripts/daftar-wallet.js` | Mencetak alamat wallet uji lewat `npm run wallets` |
| `test/` | Pengujian Hardhat |
| `.github/workflows/ci.yml` | CI: kompilasi dan test di setiap push ke `main` atau `develop` dan di setiap pull request |

Teknologi: Solidity 0.8.24, Hardhat 2.x, OpenZeppelin Contracts 5.x.

## Catatan keamanan

- Kunci privat di `scripts/deploy.ts` dan di `.env.localchain` adalah akun nomor 0 bawaan Hardhat. Kunci itu diketahui publik dan hanya untuk jaringan lokal.
- Akun dan password di tabel "Akun untuk login" hanya untuk uji lokal. Jangan dipakai di lingkungan yang bisa dijangkau orang lain.
- Jangan pernah meng-commit file `.env`.
- Kontrak belum dipasang di jaringan publik dan belum diaudit, jadi belum layak dipakai untuk dana sungguhan.
