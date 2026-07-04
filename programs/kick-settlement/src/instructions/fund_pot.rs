//! Sponsor deposits devnet USDC into a room's pot. One-directional by design:
//! sponsor -> vault -> winner. Players never deposit (no wagering, no custody of
//! player funds; PRD golden rule).
//! WHO signs: any sponsor wallet. WHY safe: transfer is from the sponsor's own
//! token account into the PDA vault; amounts use checked arithmetic; funding is
//! only possible while the room is Open.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::KickError;
use crate::events::PotFunded;
use crate::state::{Room, RoomStatus};

#[derive(Accounts)]
pub struct FundPot<'info> {
    pub sponsor: Signer<'info>,

    #[account(
        mut,
        seeds = [Room::ROOM_SEED, room.room_id.as_ref()],
        bump = room.bump
    )]
    pub room: Account<'info, Room>,

    #[account(
        mut,
        constraint = sponsor_token.owner == sponsor.key() @ KickError::OwnerMismatch,
        constraint = sponsor_token.mint == room.pot_mint @ KickError::MintMismatch
    )]
    pub sponsor_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [Room::VAULT_SEED, room.room_id.as_ref()],
        bump = room.vault_bump,
        constraint = pot_vault.mint == room.pot_mint @ KickError::MintMismatch
    )]
    pub pot_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn fund_pot(ctx: Context<FundPot>, amount: u64) -> Result<()> {
    require!(amount > 0, KickError::ZeroAmount);
    let room = &mut ctx.accounts.room;
    require!(room.status == RoomStatus::Open, KickError::RoomNotOpen);

    // Single sponsor per room keeps the refund path trivial (audit MEDIUM-2).
    match room.sponsor {
        None => room.sponsor = Some(ctx.accounts.sponsor.key()),
        Some(existing) => require_keys_eq!(
            existing,
            ctx.accounts.sponsor.key(),
            KickError::SponsorMismatch
        ),
    }

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.sponsor_token.to_account_info(),
                to: ctx.accounts.pot_vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        amount,
    )?;

    room.pot_amount = room
        .pot_amount
        .checked_add(amount)
        .ok_or(KickError::Overflow)?;

    emit!(PotFunded {
        room_id: room.room_id,
        sponsor: ctx.accounts.sponsor.key(),
        amount,
        total: room.pot_amount,
    });
    Ok(())
}
