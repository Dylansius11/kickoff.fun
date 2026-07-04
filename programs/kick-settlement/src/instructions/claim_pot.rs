//! Winner claims the sponsor pot after settlement.
//! WHO signs: the winner recorded at settlement. WHY safe: claim requires
//! Settled status, exact winner signer match, unclaimed flag, matching mint,
//! and the destination token account must be owned by the winner. The claimed
//! flag flips before the transfer; the Room PDA signs the vault transfer.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::KickError;
use crate::events::PotClaimed;
use crate::state::{Room, RoomStatus};

#[derive(Accounts)]
pub struct ClaimPot<'info> {
    pub winner: Signer<'info>,

    #[account(
        mut,
        seeds = [Room::ROOM_SEED, room.room_id.as_ref()],
        bump = room.bump
    )]
    pub room: Account<'info, Room>,

    #[account(
        mut,
        seeds = [Room::VAULT_SEED, room.room_id.as_ref()],
        bump = room.vault_bump,
        constraint = pot_vault.mint == room.pot_mint @ KickError::MintMismatch
    )]
    pub pot_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = winner_token.owner == winner.key() @ KickError::OwnerMismatch,
        constraint = winner_token.mint == room.pot_mint @ KickError::MintMismatch
    )]
    pub winner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn claim_pot(ctx: Context<ClaimPot>) -> Result<()> {
    let room = &mut ctx.accounts.room;
    require!(room.status == RoomStatus::Settled, KickError::RoomNotSettled);
    require!(!room.pot_claimed, KickError::PotAlreadyClaimed);
    require!(room.pot_amount > 0, KickError::PotEmpty);
    let recorded = room.winner.ok_or(KickError::NoWinner)?;
    require_keys_eq!(recorded, ctx.accounts.winner.key(), KickError::NotWinner);

    // Flip the flag before moving funds.
    room.pot_claimed = true;
    let amount = room.pot_amount;

    let room_id = room.room_id;
    let bump = [room.bump];
    let signer_seeds: &[&[u8]] = &[Room::ROOM_SEED, room_id.as_ref(), &bump];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.pot_vault.to_account_info(),
                to: ctx.accounts.winner_token.to_account_info(),
                authority: room.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    emit!(PotClaimed {
        room_id,
        winner: ctx.accounts.winner.key(),
        amount,
    });
    Ok(())
}
