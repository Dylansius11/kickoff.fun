//! kick-settlement: the on-chain notary + sponsor-pot vault for KICK.FUN.
//!
//! Scope (docs/technical/SMART-CONTRACT.md): prove the match outcome via TxLINE
//! proof material, anchor the room's final standings hash, and custody a
//! one-directional sponsor -> winner prize pot in devnet USDC. Points, props,
//! and the leaderboard live off-chain by design.
//!
//! Trust model is stated, not hidden: with VerifyMode::HashAnchor the proof is
//! verified off-chain and its digest anchored here; with MerkleKeccak/Sha256 the
//! path is verified in-program. CPI into txoracle validate_stat is reserved as
//! the final rung. See state::VerifyMode.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod merkle;
pub mod state;

use instructions::*;
use state::VerifyMode;

declare_id!("6dcNE27gXWVbnuVuGRgZVoRswKEJny1CemJtb8jxHhX2");

#[program]
pub mod kick_settlement {
    use super::*;

    pub fn init_config(
        ctx: Context<InitConfig>,
        txoracle_program: Pubkey,
        verify_mode: VerifyMode,
    ) -> Result<()> {
        instructions::init_config(ctx, txoracle_program, verify_mode)
    }

    pub fn set_verify_mode(ctx: Context<SetVerifyMode>, verify_mode: VerifyMode) -> Result<()> {
        instructions::set_verify_mode(ctx, verify_mode)
    }

    pub fn init_room(ctx: Context<InitRoom>, room_id: [u8; 16], fixture_id: u64) -> Result<()> {
        instructions::init_room(ctx, room_id, fixture_id)
    }

    pub fn fund_pot(ctx: Context<FundPot>, amount: u64) -> Result<()> {
        instructions::fund_pot(ctx, amount)
    }

    pub fn settle_room(
        ctx: Context<SettleRoom>,
        results_hash: [u8; 32],
        winner: Pubkey,
        proof: TxProof,
    ) -> Result<()> {
        instructions::settle_room(ctx, results_hash, winner, proof)
    }

    pub fn claim_pot(ctx: Context<ClaimPot>) -> Result<()> {
        instructions::claim_pot(ctx)
    }

    pub fn cancel_room(ctx: Context<CancelRoom>) -> Result<()> {
        instructions::cancel_room(ctx)
    }

    pub fn refund_pot(ctx: Context<RefundPot>) -> Result<()> {
        instructions::refund_pot(ctx)
    }

    pub fn close_room(ctx: Context<CloseRoom>) -> Result<()> {
        instructions::close_room(ctx)
    }
}
