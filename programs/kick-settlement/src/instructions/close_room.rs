//! Housekeeping: reclaim rent after a room's lifecycle completes.
//! WHO signs: config.authority. WHY safe: closing requires the room to be
//! Settled AND the pot to be claimed or never funded, so funds can never be
//! stranded or swept by rent reclamation.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount};

use crate::errors::KickError;
use crate::events::RoomClosed;
use crate::state::{Config, Room, RoomStatus};

#[derive(Accounts)]
pub struct CloseRoom<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        close = authority,
        seeds = [Room::ROOM_SEED, room.room_id.as_ref()],
        bump = room.bump
    )]
    pub room: Account<'info, Room>,

    #[account(
        mut,
        seeds = [Room::VAULT_SEED, room.room_id.as_ref()],
        bump = room.vault_bump
    )]
    pub pot_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn close_room(ctx: Context<CloseRoom>) -> Result<()> {
    let room = &ctx.accounts.room;
    require!(
        room.status == RoomStatus::Settled || room.status == RoomStatus::Cancelled,
        KickError::RoomNotSettled
    );
    require!(
        room.pot_claimed || room.pot_amount == 0,
        KickError::PotOutstanding
    );
    require!(ctx.accounts.pot_vault.amount == 0, KickError::PotOutstanding);

    let room_id = room.room_id;
    let bump = [room.bump];
    let signer_seeds: &[&[u8]] = &[Room::ROOM_SEED, room_id.as_ref(), &bump];

    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.pot_vault.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: ctx.accounts.room.to_account_info(),
        },
        &[signer_seeds],
    ))?;

    emit!(RoomClosed { room_id });
    Ok(())
}
