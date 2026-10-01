# Wallet untuk testing

Daftar alamat wallet yang dipakai untuk menguji sistem di jaringan lokal: mengisi kolom wallet saat pendataan, lalu mengklaim bantuan dari halaman Cek Status Bansos.

Semua alamat adalah akun bawaan Hardhat, diturunkan dari frasa uji standar:

```
test test test test test test test test test test test junk
```

Jalur derivasinya `m/44'/60'/0'/0/<nomor>`. Frasa dan kunci privatnya diketahui publik, jadi **hanya untuk jaringan lokal dan uji. Jangan pernah dipakai untuk dana sungguhan.**

## Daftar alamat

| No | Alamat wallet | Peruntukan |
|---|---|---|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Admin dan deployer. Pemegang token dana dan peran admin kontrak. **Jangan dipakai sebagai penerima** |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Penerima |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Penerima |
| 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Penerima |
| 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | Penerima |
| 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | Penerima |
| 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | Penerima |
| 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | Penerima |
| 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | Penerima |
| 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | Penerima |
| 10 | `0xBcd4042DE499D14e55001CcbB24a551F3b954096` | Penerima |
| 11 | `0x71bE63f3384f5fb98995898A86B02Fb2426c5788` | Penerima |
| 12 | `0xFABB0ac9d68B0B445fB7357272Ff202C5651694a` | Penerima |
| 13 | `0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec` | Penerima |
| 14 | `0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097` | Penerima |
| 15 | `0xcd3B766CCDd6AE721141F452C550Ca635964ce71` | Penerima |
| 16 | `0x2546BcD3c84621e976D8185a91A922aE77ECEc30` | Penerima |
| 17 | `0xbDA5747bFD65F08deb54cb465eB87D40e51B197E` | Penerima |
| 18 | `0xdD2FD4581271e230360230F9337D5c0430Bf44C0` | Penerima |
| 19 | `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` | Penerima |

Saat `npm run node` dinyalakan, akun nomor 0 sampai 19 masing-masing mendapat 10.000 ETH, jadi semuanya bisa membayar biaya gas klaim. Akun nomor 20 ke atas tidak punya saldo.

## Cara memakainya

1. **Ambil kunci privatnya.** Kunci tidak disimpan di repo. `npm run node` mencetak ke-20 akun beserta kunci privatnya di terminal. Nomor di daftar ini sama dengan nomor akun di terminal itu.
2. **Pakai alamatnya saat pendataan.** Tempel satu alamat (nomor 1 sampai 19) di kolom wallet form pendataan, `/petugas/pendataan`.
3. **Satu alamat untuk satu keluarga.** Daftar final tidak boleh memuat wallet yang sama dua kali dalam satu periode.
4. **Impor ke MetaMask sebelum mengklaim.** Impor akun yang sama dengan kunci privat dari langkah 1, supaya MetaMask bisa menandatangani klaim dari alamat itu.
5. **Cek hasilnya.** Setelah periode disahkan dan didanai, buka Cek Status Bansos (`/cek-status`), masukkan alamat yang sama, lalu klaim.

## Melihat atau menambah alamat

Cetak daftar di terminal, dari folder repo ini setelah `npm install`:

```bash
npm run wallets          # nomor 0 sampai 19
npm run wallets -- 40    # nomor 0 sampai 39
```

Alamat nomor 20 ke atas diturunkan dari frasa yang sama. Mereka tidak punya saldo ETH di jaringan lokal. Untuk pendataan itu tidak masalah. Supaya bisa mengklaim, kirimi dulu sedikit ETH dari akun nomor 0.
