// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Token uji ERC-20 yang mensimulasikan "IDRX-Test" (docs/06-Smart-Contract-Design.md
/// §2) untuk testnet/test suite. Siapa pun bisa `mint()` — TIDAK untuk produksi, cuma
/// menggantikan stablecoin Rupiah asli / relasi on-off-ramp yang belum ada.
contract MockIDRXTest is ERC20 {
    constructor() ERC20("IDRX Test", "IDRXT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
