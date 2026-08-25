import { AbiCoder, concat, keccak256 } from "ethers";

/**
 * Cermin PERSIS dari sigap-api/src/blockchain/merkle.service.ts — bukan literally
 * memakai paket npm `@openzeppelin/merkle-tree` (walau docs/06-Smart-Contract-Design.md
 * §2 menyebut "mengikuti format" paket itu, implementasi backend sungguhan adalah
 * hand-rolled sort-pair + keccak256, lihat catatan di sigap-api). Test ini sengaja
 * meniru algoritma BACKEND YANG SUNGGUHAN JALAN, bukan paket referensinya — supaya
 * "test paritas root" (§6 butir terakhir) membuktikan apa yang benar-benar dikirim
 * production, bukan implementasi ideal yang tidak dipakai.
 */

const abiCoder = AbiCoder.defaultAbiCoder();

export function computeLeafHash(recipient: string, amount: bigint, periodeId: number, nikHash: string): string {
  const encoded = abiCoder.encode(["address", "uint256", "uint256", "bytes32"], [recipient, amount, periodeId, nikHash]);
  const innerHash = keccak256(encoded);
  return keccak256(concat([innerHash]));
}

export function buildRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) return "0x" + "0".repeat(64);
  if (leafHashes.length === 1) return leafHashes[0];

  let layer = [...leafHashes];
  while (layer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [a, b] = [layer[i], layer[i + 1]].sort();
        nextLayer.push(keccak256(concat([a, b])));
      } else {
        nextLayer.push(layer[i]);
      }
    }
    layer = nextLayer;
  }
  return layer[0];
}

export function generateProof(leafHashes: string[], targetIndex: number): string[] {
  if (leafHashes.length <= 1) return [];

  const proof: string[] = [];
  let layer = [...leafHashes];
  let idx = targetIndex;

  while (layer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [a, b] = [layer[i], layer[i + 1]].sort();
        nextLayer.push(keccak256(concat([a, b])));
        if (i === idx || i + 1 === idx) {
          proof.push(i === idx ? layer[i + 1] : layer[i]);
        }
      } else {
        nextLayer.push(layer[i]);
      }
    }
    idx = Math.floor(idx / 2);
    layer = nextLayer;
  }
  return proof;
}
