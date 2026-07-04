//! Admin instructions: one-time config init and verify-mode rotation.
//! WHO signs: the deploying authority. WHY safe: config is a singleton PDA;
//! rotation is gated by has_one = authority.

use anchor_lang::prelude::*;

use crate::errors::KickError;
use crate::state::{Config, VerifyMode};

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [Config::SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    /// Front-run guard (audit MEDIUM-1): only the program's upgrade authority
    /// may claim the singleton config.
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
    )]
    pub program: Program<'info, crate::program::KickSettlement>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key())
            @ KickError::NotUpgradeAuthority
    )]
    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

pub fn init_config(
    ctx: Context<InitConfig>,
    txoracle_program: Pubkey,
    verify_mode: VerifyMode,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.txoracle_program = txoracle_program;
    config.verify_mode = verify_mode;
    config.bump = ctx.bumps.config;
    Ok(())
}

#[derive(Accounts)]
pub struct SetVerifyMode<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
}

/// Flip proof-verification rungs (HashAnchor -> MerkleKeccak/Sha256) without redeploying.
pub fn set_verify_mode(ctx: Context<SetVerifyMode>, verify_mode: VerifyMode) -> Result<()> {
    ctx.accounts.config.verify_mode = verify_mode;
    Ok(())
}
