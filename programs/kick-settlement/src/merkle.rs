//! Merkle path verification against TxLINE proof nodes.
//!
//! TxLINE proof node format (verified from official docs, July 2026):
//!   { hash: [u8; 32], is_right_sibling: bool }
//! REST payload chain: statProof[] -> eventStatRoot, subTreeProof[] / mainTreeProof[] -> main root.
//!
//! TxLINE does NOT document the hash algorithm. Both keccak and sha256 walkers are
//! provided; Config.verify_mode selects exactly one. Confirm the real algorithm against
//! a captured proof (tests/fixtures) before enabling rung B in production.

use anchor_lang::prelude::*;
use solana_keccak_hasher::hashv as keccakv;
use solana_sha256_hasher::hashv as sha256v;

use crate::errors::KickError;

/// Hard cap keeps compute bounded (2^64 leaves is unreachable; real trees are far smaller).
pub const MAX_PROOF_NODES: usize = 64;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(Clone, Copy)]
pub enum HashAlgo {
    Keccak,
    Sha256,
}

fn parent(algo: HashAlgo, left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    match algo {
        HashAlgo::Keccak => keccakv(&[left, right]).to_bytes(),
        HashAlgo::Sha256 => sha256v(&[left, right]).to_bytes(),
    }
}

/// Walk `leaf` up the `path`; return the computed root.
pub fn compute_root(algo: HashAlgo, leaf: [u8; 32], path: &[ProofNode]) -> Result<[u8; 32]> {
    require!(!path.is_empty(), KickError::ProofEmpty);
    require!(path.len() <= MAX_PROOF_NODES, KickError::ProofTooLong);
    let mut acc = leaf;
    for node in path {
        acc = if node.is_right_sibling {
            parent(algo, &acc, &node.hash)
        } else {
            parent(algo, &node.hash, &acc)
        };
    }
    Ok(acc)
}

/// Verify `leaf` belongs to `expected_root` via `path`.
pub fn verify_path(
    algo: HashAlgo,
    leaf: [u8; 32],
    path: &[ProofNode],
    expected_root: &[u8; 32],
) -> Result<()> {
    let computed = compute_root(algo, leaf, path)?;
    require!(&computed == expected_root, KickError::MerkleVerificationFailed);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h2(algo: HashAlgo, a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
        parent(algo, a, b)
    }

    #[test]
    fn verifies_two_level_tree_both_algos() {
        for algo in [HashAlgo::Keccak, HashAlgo::Sha256] {
            let leaf_a = [1u8; 32];
            let leaf_b = [2u8; 32];
            let leaf_c = [3u8; 32];
            let leaf_d = [4u8; 32];
            let ab = h2(algo, &leaf_a, &leaf_b);
            let cd = h2(algo, &leaf_c, &leaf_d);
            let root = h2(algo, &ab, &cd);

            // prove leaf_c: sibling d (right), then ab (left)
            let path = vec![
                ProofNode { hash: leaf_d, is_right_sibling: true },
                ProofNode { hash: ab, is_right_sibling: false },
            ];
            verify_path(algo, leaf_c, &path, &root).unwrap();

            // wrong root fails
            assert!(verify_path(algo, leaf_c, &path, &[9u8; 32]).is_err());
            // tampered sibling fails
            let bad = vec![
                ProofNode { hash: [8u8; 32], is_right_sibling: true },
                ProofNode { hash: ab, is_right_sibling: false },
            ];
            assert!(verify_path(algo, leaf_c, &bad, &root).is_err());
        }
    }

    #[test]
    fn rejects_empty_and_oversized_paths() {
        let leaf = [1u8; 32];
        assert!(verify_path(HashAlgo::Keccak, leaf, &[], &leaf).is_err());
        let long = vec![ProofNode { hash: [0u8; 32], is_right_sibling: true }; MAX_PROOF_NODES + 1];
        assert!(compute_root(HashAlgo::Keccak, leaf, &long).is_err());
    }
}
