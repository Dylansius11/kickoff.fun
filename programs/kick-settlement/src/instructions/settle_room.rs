//! Settle a room against a TxLINE proof and anchor the final standings hash.
//! WHO signs: config.authority (the service key, after the finality gate passes
//! off-chain). WHY safe: settlement is idempotent (Open -> Settled only), the
//! proof must bind to the room's fixture, and the active VerifyMode decides how
//! much verification happens in-program (see state::VerifyMode for the rungs).

use anchor_lang::prelude::*;

use crate::errors::KickError;
use crate::events::RoomSettled;
use crate::merkle::{verify_path, HashAlgo, ProofNode};
use crate::state::{Config, Room, RoomStatus, VerifyMode};

/// TxLINE proof material, shaped after the documented REST payload
/// (summary + proof node arrays; see .claude/skills/kick-contract/SKILL.md).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxProof {
    /// Fixture this proof attests. MUST equal room.fixture_id.
    pub fixture_id: u64,
    /// The 32-byte leaf being proven (canonical hash of the stat/score record).
    pub leaf: [u8; 32],
    /// Sibling path from leaf to the expected root.
    pub path: Vec<ProofNode>,
    /// Root the path must resolve to. With rung B active this is checked
    /// in-program; the value is echoed in the event so anyone can compare it
    /// against the root txoracle published on-chain for the same window.
    pub expected_root: [u8; 32],
    /// sha256 digest of the full raw TxLINE proof response (rung C anchor;
    /// stored on-chain for tamper-evidence in every mode).
    pub raw_digest: [u8; 32],
}

#[derive(Accounts)]
pub struct SettleRoom<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [Room::ROOM_SEED, room.room_id.as_ref()],
        bump = room.bump,
        constraint = room.authority == authority.key() @ KickError::OwnerMismatch
    )]
    pub room: Account<'info, Room>,
}

pub fn settle_room(
    ctx: Context<SettleRoom>,
    results_hash: [u8; 32],
    winner: Pubkey,
    proof: TxProof,
) -> Result<()> {
    let room = &mut ctx.accounts.room;
    require!(room.status == RoomStatus::Open, KickError::RoomNotOpen);
    require!(proof.fixture_id == room.fixture_id, KickError::FixtureMismatch);
    // Defense-in-depth (audit LOW-1): bound the path in every mode, including
    // HashAnchor where the walk is skipped.
    require!(
        proof.path.len() <= crate::merkle::MAX_PROOF_NODES,
        KickError::ProofTooLong
    );

    match ctx.accounts.config.verify_mode {
        // Rung C: digest anchored, verification performed off-chain by the
        // ingest service. Demo-safe default; honest about its trust model.
        VerifyMode::HashAnchor => {}
        // Rung B: verify the Merkle path in-program.
        VerifyMode::MerkleKeccak => {
            verify_path(HashAlgo::Keccak, proof.leaf, &proof.path, &proof.expected_root)?;
        }
        VerifyMode::MerkleSha256 => {
            verify_path(HashAlgo::Sha256, proof.leaf, &proof.path, &proof.expected_root)?;
        }
        // Rung A: CPI into txoracle validate_stat. Reserved until CU headroom
        // and the txoracle account set are proven out (their ix runs ~1.4M CU).
        VerifyMode::CpiValidateStat => return err!(KickError::VerifyModeNotEnabled),
    }

    room.status = RoomStatus::Settled;
    room.results_hash = results_hash;
    room.proof_digest = proof.raw_digest;
    room.winner = Some(winner);
    room.settled_at = Clock::get()?.unix_timestamp;

    emit!(RoomSettled {
        room_id: room.room_id,
        fixture_id: room.fixture_id,
        results_hash,
        proof_digest: proof.raw_digest,
        winner,
        verify_mode: ctx.accounts.config.verify_mode as u8,
    });
    Ok(())
}
