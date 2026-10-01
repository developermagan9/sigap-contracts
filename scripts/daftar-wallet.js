// Mencetak alamat wallet uji Hardhat (frasa standar "test ... junk"), tanpa
// jaringan lokal dan tanpa kunci privat. Nomornya sama dengan "Account #n" di
// output `npm run node`.
//
//   npm run wallets          -> nomor 0 sampai 19
//   npm run wallets -- 40    -> nomor 0 sampai 39
const { HDNodeWallet } = require("ethers");

const FRASA = "test test test test test test test test test test test junk";
const BERSALDO = 20; // `hardhat node` hanya memberi ETH ke 20 akun pertama

const jumlah = Number(process.argv[2] || BERSALDO);
if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 1000) {
  console.error("Jumlah harus bilangan bulat 1 sampai 1000. Contoh: npm run wallets -- 40");
  process.exit(1);
}

for (let i = 0; i < jumlah; i++) {
  const { address } = HDNodeWallet.fromPhrase(FRASA, undefined, `m/44'/60'/0'/0/${i}`);
  const catatan =
    i === 0 ? "admin dan deployer, bukan penerima" : i >= BERSALDO ? "tanpa saldo ETH di jaringan lokal" : "";
  console.log(`${String(i).padStart(3)}  ${address}${catatan ? `  (${catatan})` : ""}`);
}
