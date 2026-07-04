//! Void a room (match cancelled/postponed) and let the sponsor recover funds.
//! Added after audit finding MEDIUM-2: without this, an unsettleable room
//! stranded sponsor funds forever.
//!
//! cancel_room  WHO signs: config.authority. Open -> Cancelled only.
//! refund_pot   WHO signs: the recorded sponsor. Requires Cancelled; returns
//!              the full pot to the sponsor's token account; reuses pot_claimed
//!              as the "vault emptied" latch so close_room stays consistent.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::KickError;
use crate::events::{PotRefunded, RoomCancelled};
use crate::state::{Config, Room, RoomStatus};

#[derive(Accounts)]
pub struct CancelRoom<'info> {
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
        bump = room.bump
    )]
    pub room: Account<'info, Room>,
}

pub fn cancel_room(ctx: Context<CancelRoom>) -> Result<()> {
    let room = &mut ctx.accounts.room;
    require!(room.status == RoomStatus::Open, KickError::RoomNotOpen);
    room.status = RoomStatus::Cancelled;
    emit!(RoomCancelled { room_id: room.room_id });
    Ok(())
}

#[derive(Accounts)]
pub struct RefundPot<'info> {
    pub sponsor: Signer<'info>,

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
        constraint = sponsor_token.owner == sponsor.key() @ KickError::OwnerMismatch,
        constraint = sponsor_token.mint == room.pot_mint @ KickError::MintMismatch
    )]
    pub sponsor_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn refund_pot(ctx: Context<RefundPot>) -> Result<()> {
    let room = &mut ctx.accounts.room;
    require!(room.status == RoomStatus::Cancelled, KickError::RoomNotCancelled);
    require!(!room.pot_claimed, KickError::PotAlreadyClaimed);
    require!(room.pot_amount > 0, KickError::PotEmpty);
    let recorded = room.sponsor.ok_or(KickError::NoSponsor)?;
    require_keys_eq!(recorded, ctx.accounts.sponsor.key(), KickError::SponsorMismatch);

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
                to: ctx.accounts.sponsor_token.to_account_info(),
                authority: room.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    emit!(PotRefunded {
        room_id,
        sponsor: ctx.accounts.sponsor.key(),
        amount,
    });
    Ok(())
}
