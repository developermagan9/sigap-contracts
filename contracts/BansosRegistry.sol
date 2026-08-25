// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BansosRegistry
/// @notice Menyimpan Merkle root daftar penerima per periode program — bukti
/// integritas tanpa membuka data mentah. Lihat docs/06-Smart-Contract-Design.md §3.1.
contract BansosRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Periode {
        bytes32 merkleRoot;
        uint256 totalAlokasi;
        uint256 timestamp;
        bool locked; // true setelah disahkan, tidak bisa diubah lagi
    }

    mapping(uint256 => Periode) public periodeData; // periodeId => data
    event PeriodeRegistered(uint256 indexed periodeId, bytes32 merkleRoot, uint256 totalAlokasi);

    /// @param governance Multisig (mis. Gnosis Safe 2-of-3) pemegang DEFAULT_ADMIN_ROLE,
    ///        yaitu satu-satunya pihak yang boleh menambah/mencabut ADMIN_ROLE di kemudian
    ///        hari. BUKAN wallet individu — agar tidak ada single point of control.
    /// @param initialAdmins Wallet/multisig operasional yang boleh memanggil registerPeriode().
    constructor(address governance, address[] memory initialAdmins) {
        require(governance != address(0), "Governance tidak boleh address(0)");
        _grantRole(DEFAULT_ADMIN_ROLE, governance);
        for (uint256 i = 0; i < initialAdmins.length; i++) {
            _grantRole(ADMIN_ROLE, initialAdmins[i]);
        }
    }

    function registerPeriode(uint256 periodeId, bytes32 merkleRoot, uint256 totalAlokasi)
        external onlyRole(ADMIN_ROLE)
    {
        require(!periodeData[periodeId].locked, "Periode sudah dikunci, tidak bisa diubah");
        require(merkleRoot != bytes32(0), "Merkle root kosong");
        require(totalAlokasi > 0, "Total alokasi nol");
        periodeData[periodeId] = Periode(merkleRoot, totalAlokasi, block.timestamp, true);
        emit PeriodeRegistered(periodeId, merkleRoot, totalAlokasi);
    }
}
