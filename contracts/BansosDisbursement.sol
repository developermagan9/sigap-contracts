// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // OZ v5: bukan lagi security/
import "./BansosRegistry.sol";

/// @title BansosDisbursement
/// @notice Menangani deposit dana & klaim oleh penerima menggunakan bukti Merkle.
/// Lihat docs/06-Smart-Contract-Design.md §3.2.
contract BansosDisbursement is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable danaToken;
    BansosRegistry public immutable registry;

    mapping(uint256 => mapping(address => bool)) public hasClaimed; // periodeId => penerima => sudah klaim?
    mapping(uint256 => uint256) public saldoPeriode;                // dana per periode, tidak boleh saling pinjam
    /// Batas waktu klaim per periode (unix detik). 0 = belum ditetapkan → klaim terbuka
    /// tanpa batas dan sisa dana tidak bisa ditarik. Tanpa ini dana penerima yang tidak
    /// pernah klaim (atau wallet-nya tidak bisa dipakai) terkunci selamanya di kontrak.
    mapping(uint256 => uint256) public batasKlaim;

    event FundDeposited(uint256 indexed periodeId, address indexed depositor, uint256 amount);
    event FundDisbursed(
        uint256 indexed periodeId,
        address indexed recipient,
        address indexed submitter,
        uint256 amount,
        bytes32 nikHash
    );
    event BatasKlaimDitetapkan(uint256 indexed periodeId, uint256 batasKlaim);
    event SisaDanaDitarik(uint256 indexed periodeId, address indexed tujuan, uint256 amount);

    /// Hak admin mengikuti ADMIN_ROLE di registry, supaya governance cukup mengelola
    /// satu daftar admin untuk kedua kontrak.
    modifier onlyAdmin() {
        require(registry.hasRole(registry.ADMIN_ROLE(), msg.sender), "Bukan admin");
        _;
    }

    constructor(address _token, address _registry) {
        require(_token != address(0) && _registry != address(0), "Alamat tidak valid");
        danaToken = IERC20(_token);
        registry = BansosRegistry(_registry);
    }

    function depositDana(uint256 periodeId, uint256 amount) external {
        require(amount > 0, "Nominal deposit nol");
        saldoPeriode[periodeId] += amount;
        // SafeERC20: menangani token non-standar yang tidak mengembalikan bool
        danaToken.safeTransferFrom(msg.sender, address(this), amount);
        emit FundDeposited(periodeId, msg.sender, amount);
    }

    /// @notice Menetapkan atau memperpanjang batas waktu klaim. Tidak bisa dimajukan:
    /// penerima yang sudah diberi tahu tenggat tertentu tidak boleh kehilangan haknya lebih awal.
    function setBatasKlaim(uint256 periodeId, uint256 batas) external onlyAdmin {
        require(batas > block.timestamp, "Batas klaim harus di masa depan");
        require(batas > batasKlaim[periodeId], "Batas klaim hanya boleh diperpanjang");
        batasKlaim[periodeId] = batas;
        emit BatasKlaimDitetapkan(periodeId, batas);
    }

    /// @notice Menarik seluruh sisa dana periode setelah masa klaim berakhir, mis. untuk
    /// dikembalikan ke kas daerah. Setelah ini klaim periode tersebut otomatis gagal.
    function tarikSisaDana(uint256 periodeId, address tujuan) external onlyAdmin nonReentrant {
        require(tujuan != address(0), "Alamat tidak valid");
        uint256 batas = batasKlaim[periodeId];
        require(batas != 0 && block.timestamp > batas, "Masa klaim belum berakhir");
        uint256 sisa = saldoPeriode[periodeId];
        require(sisa > 0, "Tidak ada sisa dana");
        saldoPeriode[periodeId] = 0;
        danaToken.safeTransfer(tujuan, sisa);
        emit SisaDanaDitarik(periodeId, tujuan, sisa);
    }

    /// @notice Mengklaim dana untuk `recipient` dengan membuktikan keanggotaan dalam Merkle
    /// tree yang sudah disahkan, tanpa membuka NIK asli on-chain.
    /// @dev Transaksi boleh disubmit oleh penerima sendiri ATAU oleh relayer/pendamping desa
    /// (gas ditanggung relayer). `recipient` dipisahkan dari `msg.sender` karena alamat yang
    /// terkunci di dalam leaf adalah alamat penerima — relayer tidak akan pernah lolos
    /// verifikasi Merkle bila mencoba mengarahkan dana ke wallet lain, dan transfer selalu
    /// menuju `recipient`, bukan `msg.sender`.
    function claim(
        uint256 periodeId,
        address recipient,
        uint256 amount,
        bytes32 nikHash,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        require(!hasClaimed[periodeId][recipient], "Dana sudah pernah diklaim");
        uint256 batas = batasKlaim[periodeId];
        require(batas == 0 || block.timestamp <= batas, "Masa klaim sudah berakhir");

        (bytes32 merkleRoot, , , bool locked) = registry.periodeData(periodeId);
        require(locked, "Periode belum disahkan");

        // Double-hash + abi.encode (standar OpenZeppelin StandardMerkleTree):
        // mencegah second-preimage attack antara leaf dan node internal.
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount, periodeId, nikHash))));
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Bukti Merkle tidak valid");

        // checks-effects-interactions
        hasClaimed[periodeId][recipient] = true;
        saldoPeriode[periodeId] -= amount; // revert otomatis (0.8.x) bila dana periode ini kurang
        danaToken.safeTransfer(recipient, amount);

        emit FundDisbursed(periodeId, recipient, msg.sender, amount, nikHash);
    }
}
