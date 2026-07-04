use anchor_lang::prelude::*;

#[event]
pub struct RoomInitialized {
    pub room_id: [u8; 16],
    pub fixture_id: u64,
    pub pot_mint: Pubkey,
}

#[event]
pub struct PotFunded {
    pub room_id: [u8; 16],
    pub sponsor: Pubkey,
    pub amount: u64,
    pub total: u64,
}

#[event]
pub struct RoomSettled {
    pub room_id: [u8; 16],
    pub fixture_id: u64,
    pub results_hash: [u8; 32],
    pub proof_digest: [u8; 32],
    pub winner: Pubkey,
    pub verify_mode: u8,
}

#[event]
pub struct PotClaimed {
    pub room_id: [u8; 16],
    pub winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RoomClosed {
    pub room_id: [u8; 16],
}

#[event]
pub struct RoomCancelled {
    pub room_id: [u8; 16],
}

#[event]
pub struct PotRefunded {
    pub room_id: [u8; 16],
    pub sponsor: Pubkey,
    pub amount: u64,
}
