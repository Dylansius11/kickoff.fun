//! Create a Room + its PDA-owned pot vault.
//! WHO signs: config.authority (the service key). Players never sign here.
//! WHY safe: room PDA is unique per room_id; the vault's token authority is the
//! Room PDA itself, so only program logic can ever move pot funds.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::events::RoomInitialized;
use crate::state::{Config, Room, RoomStatus};

#[derive(Accounts)]
#[instruction(room_id: [u8; 16])]
pub struct InitRoom<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + Room::INIT_SPACE,
        seeds = [Room::ROOM_SEED, room_id.as_ref()],
        bump
    )]
    pub room: Account<'info, Room>,

    pub pot_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [Room::VAULT_SEED, room_id.as_ref()],
        bump,
        token::mint = pot_mint,
        token::authority = room
    )]
    pub pot_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn init_room(ctx: Context<InitRoom>, room_id: [u8; 16], fixture_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    room.room_id = room_id;
    room.fixture_id = fixture_id;
    room.authority = ctx.accounts.authority.key();
    room.status = RoomStatus::Open;
    room.results_hash = [0u8; 32];
    room.proof_digest = [0u8; 32];
    room.winner = None;
    room.pot_mint = ctx.accounts.pot_mint.key();
    room.pot_amount = 0;
    room.pot_claimed = false;
    room.settled_at = 0;
    room.bump = ctx.bumps.room;
    room.vault_bump = ctx.bumps.pot_vault;

    emit!(RoomInitialized {
        room_id,
        fixture_id,
        pot_mint: room.pot_mint,
    });
    Ok(())
}
