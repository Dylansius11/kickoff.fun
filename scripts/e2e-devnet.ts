/**
 * E2E on-chain money path on devnet, the judge-facing receipt:
 *   create test mint -> init_room -> fund_pot -> settle_room -> claim_pot
 *
 * Run:
 *   ANCHOR_PROVIDER_URL=<helius devnet url> ANCHOR_WALLET=~/.config/solana/id.json \
 *   pnpm tsx scripts/e2e-devnet.ts
 *
 * Uses a fresh SPL test mint as the pot currency (stands in for devnet USDC;
 * the program only requires mint consistency). Our wallet plays every role:
 * authority (service), sponsor, and winner. Fixture id = a REAL World Cup
 * fixture from TxLINE (Paraguay v Australia).
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash, randomBytes } from "node:crypto";
import idl from "../target/idl/kick_settlement.json" with { type: "json" };

const PROGRAM_ID = new PublicKey("6dcNE27gXWVbnuVuGRgZVoRswKEJny1CemJtb8jxHhX2");
const FIXTURE_ID = new anchor.BN(17588229); // real TxLINE fixture: Paraguay v Australia
const POT = 1_000_000_000n; // 1,000 tokens @ 6 decimals

const sha256 = (s: string | Buffer) => Array.from(createHash("sha256").update(s).digest());

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const wallet = provider.wallet.publicKey;
  const payer = (provider.wallet as anchor.Wallet).payer as Keypair;
  const log: string[] = [];

  // 0. test mint (stand-in for devnet USDC) + our ATA funded
  const mint = await createMint(provider.connection, payer, wallet, null, 6);
  const ata = await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, wallet);
  await mintTo(provider.connection, payer, mint, ata.address, payer, POT);
  log.push(`mint (test USDC): ${mint.toBase58()}`);
  log.push(`sponsor/winner ATA: ${ata.address.toBase58()}`);

  // PDAs
  const roomId = Array.from(randomBytes(16));
  const roomIdBuf = Buffer.from(roomId);
  const [roomPda] = PublicKey.findProgramAddressSync([Buffer.from("room"), roomIdBuf], PROGRAM_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), roomIdBuf], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  log.push(`room PDA: ${roomPda.toBase58()}`);
  log.push(`vault PDA: ${vaultPda.toBase58()}`);

  // 1. init_room
  const tx1 = await program.methods
    .initRoom(roomId, FIXTURE_ID)
    .accounts({
      authority: wallet,
      config: configPda,
      room: roomPda,
      potMint: mint,
      potVault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  log.push(`1 init_room:    ${tx1}`);

  // 2. fund_pot (sponsor deposits 1,000)
  const tx2 = await program.methods
    .fundPot(new anchor.BN(POT.toString()))
    .accounts({
      sponsor: wallet,
      room: roomPda,
      sponsorToken: ata.address,
      potVault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  log.push(`2 fund_pot:     ${tx2}`);

  // 3. settle_room (HashAnchor mode: anchor results hash + proof digest)
  const resultsHash = sha256("kickfun-e2e-standings-v1");
  const proof = {
    fixtureId: FIXTURE_ID,
    leaf: sha256("leaf"),
    path: [] as never[],
    expectedRoot: sha256("root"),
    rawDigest: sha256("raw TxLINE proof response placeholder"),
    cpi: null,
  };
  const tx3 = await program.methods
    .settleRoom(resultsHash, wallet, proof)
    .accounts({ authority: wallet, config: configPda, room: roomPda })
    .rpc();
  log.push(`3 settle_room:  ${tx3}`);

  // 4. claim_pot (winner pulls the pot)
  const before = (await getAccount(provider.connection, ata.address)).amount;
  const tx4 = await program.methods
    .claimPot()
    .accounts({
      winner: wallet,
      room: roomPda,
      potVault: vaultPda,
      winnerToken: ata.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  const after = (await getAccount(provider.connection, ata.address)).amount;
  log.push(`4 claim_pot:    ${tx4}`);
  log.push(`winner balance: ${before} -> ${after} (received ${after - before})`);

  console.log("\n=== E2E MONEY PATH COMPLETE ===");
  for (const l of log) console.log(l);
  console.log(`explorer: https://explorer.solana.com/address/${roomPda.toBase58()}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
