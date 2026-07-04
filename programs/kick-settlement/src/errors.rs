use anchor_lang::prelude::*;

#[error_code]
pub enum KickError {
    #[msg("room is not open")]
    RoomNotOpen,
    #[msg("room is not settled")]
    RoomNotSettled,
    #[msg("pot already claimed")]
    PotAlreadyClaimed,
    #[msg("pot is empty")]
    PotEmpty,
    #[msg("signer is not the winner")]
    NotWinner,
    #[msg("no winner recorded for this room")]
    NoWinner,
    #[msg("mint does not match the room pot mint")]
    MintMismatch,
    #[msg("token account owner mismatch")]
    OwnerMismatch,
    #[msg("proof does not bind to this room's fixture")]
    FixtureMismatch,
    #[msg("merkle proof verification failed")]
    MerkleVerificationFailed,
    #[msg("proof path too long")]
    ProofTooLong,
    #[msg("empty proof")]
    ProofEmpty,
    #[msg("verify mode not enabled")]
    VerifyModeNotEnabled,
    #[msg("arithmetic overflow")]
    Overflow,
    #[msg("pot must be claimed or empty before close")]
    PotOutstanding,
    #[msg("amount must be greater than zero")]
    ZeroAmount,
    #[msg("room already has a different sponsor")]
    SponsorMismatch,
    #[msg("room is not cancelled")]
    RoomNotCancelled,
    #[msg("no sponsor recorded")]
    NoSponsor,
    #[msg("signer is not the program upgrade authority")]
    NotUpgradeAuthority,
}
