//! CPI surface for TxODDS txoracle `validate_stat`.
//!
//! Types + layout mirror the official IDL (github.com/txodds/tx-on-chain,
//! idl/txoracle.json; identical discriminator on devnet and mainnet).
//! The oracle hashes the raw ScoreStat leaf itself, so no hash-algorithm
//! assumption leaks into this program: their code verifies their tree.
//!
//! Instruction: validate_stat
//!   discriminator: [107, 197, 232, 90, 191, 136, 105, 185]
//!   accounts:      [daily_scores_merkle_roots (readonly)]
//!   returns:       bool via set_return_data
//!   roots PDA:     ["daily_scores_roots", epoch_day as u16 le] on txoracle,
//!                  epoch_day = floor(unix_ms / 86_400_000)

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{get_return_data, invoke};

use crate::errors::KickError;
use crate::merkle::ProofNode;

pub const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

/// Full arg set for validate_stat, in exact IDL order.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StatValidation {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
}

/// CPI into txoracle validate_stat and require a `true` verdict.
///
/// `txoracle_program` and `daily_scores_roots` come from remaining_accounts;
/// the caller MUST have checked `txoracle_program.key == config.txoracle_program`
/// (we re-check here for defense in depth) and we require the roots account to
/// be owned by that program, so a forged roots account cannot pass.
pub fn cpi_validate_stat<'info>(
    expected_program: Pubkey,
    txoracle_program: &AccountInfo<'info>,
    daily_scores_roots: &AccountInfo<'info>,
    args: &StatValidation,
) -> Result<()> {
    require_keys_eq!(
        *txoracle_program.key,
        expected_program,
        KickError::OracleProgramMismatch
    );
    require_keys_eq!(
        *daily_scores_roots.owner,
        expected_program,
        KickError::OracleAccountNotOwned
    );

    let mut data = Vec::with_capacity(512);
    data.extend_from_slice(&VALIDATE_STAT_DISCRIMINATOR);
    args.serialize(&mut data)?;

    let ix = Instruction {
        program_id: expected_program,
        accounts: vec![AccountMeta::new_readonly(*daily_scores_roots.key, false)],
        data,
    };

    invoke(
        &ix,
        &[daily_scores_roots.clone(), txoracle_program.clone()],
    )?;

    let (returner, ret) = get_return_data().ok_or(KickError::OracleNoReturn)?;
    require_keys_eq!(returner, expected_program, KickError::OracleProgramMismatch);
    require!(
        ret.first().copied() == Some(1),
        KickError::OracleValidationFailed
    );
    Ok(())
}
