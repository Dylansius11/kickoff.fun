use anchor_lang::prelude::*;

/// How settle_room verifies the TxLINE proof.
///
/// Ship order (see .claude/skills/kick-contract/SKILL.md):
///   HashAnchor  -> rung C: proof digest anchored on-chain, full verification off-chain. Demo-safe default.
///   MerkleKeccak / MerkleSha256 -> rung B: walk the {hash, is_right_sibling} path in-program.
///       TxLINE docs do not state the hash algorithm; admin flips to the confirmed variant
///       after testing against a captured real proof. Never accept both at once.
///   CpiValidateStat -> rung A: CPI into txoracle validate_stat (their ix runs ~1.4M CU via
///       .view(); CU headroom for a CPI is unproven). Reserved, not yet wired.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum VerifyMode {
    HashAnchor,
    MerkleKeccak,
    MerkleSha256,
    CpiValidateStat,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum RoomStatus {
    Open,
    Settled,
    /// Match void (cancelled/postponed). Sponsor may refund; nobody can claim.
    Cancelled,
}

/// Singleton program configuration. seeds = ["config"]
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Admin: may rotate settings; the only key allowed to init rooms and settle them.
    pub authority: Pubkey,
    /// TxLINE oracle program (pinned so passed-in oracle accounts can be owner-checked).
    pub txoracle_program: Pubkey,
    /// Active proof-verification rung.
    pub verify_mode: VerifyMode,
    pub bump: u8,
}

/// One terrace (match room). seeds = ["room", room_id]
#[account]
#[derive(InitSpace)]
pub struct Room {
    /// Mirrors the off-chain uuid (16 raw bytes) so web/worker/program agree.
    pub room_id: [u8; 16],
    /// TxLINE fixture this room is bound to. Proofs MUST bind to this id.
    pub fixture_id: u64,
    /// Config.authority at init time; the settle signer.
    pub authority: Pubkey,
    pub status: RoomStatus,
    /// Hash of the room's final standings snapshot (the anchored receipt).
    pub results_hash: [u8; 32],
    /// Digest of the TxLINE proof used to settle (rung C evidence, rung B echo).
    pub proof_digest: [u8; 32],
    /// Winner wallet, set at settlement. None until settled.
    pub winner: Option<Pubkey>,
    /// Single sponsor allowed per room (keeps the refund path trivial).
    /// Set on first fund; later funds must come from the same wallet.
    pub sponsor: Option<Pubkey>,
    /// Sponsor pot mint (devnet USDC). Fixed at init; fund/claim must match.
    pub pot_mint: Pubkey,
    /// Total funded amount (base units).
    pub pot_amount: u64,
    pub pot_claimed: bool,
    pub settled_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Room {
    pub const ROOM_SEED: &'static [u8] = b"room";
    pub const VAULT_SEED: &'static [u8] = b"vault";
}

impl Config {
    pub const SEED: &'static [u8] = b"config";
}
