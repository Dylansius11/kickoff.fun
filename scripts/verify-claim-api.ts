/**
 * Verify the /api/claim route end to end on devnet WITHOUT Privy UI:
 * a throwaway keypair plays the winner (external signer, exactly what the
 * Privy embedded wallet will do in the browser).
 *
 *   1. fund a throwaway keypair with a little SOL for fees (airdrop is flaky)
 *   2. e2e flow via anchor: createMint -> init_room -> fund_pot -> settle_room
 *      with winner = throwaway pubkey
 *   3. POST localhost:3000/api/claim { roomPda, winner } -> unsigned tx (base64)
 *   4. deserialize, sign with the throwaway keypair, send raw, confirm
 *   5. assert the winner ATA balance increased by the pot
 *
 * Run (dev server must be up on :3000):
 *   ANCHOR_PROVIDER_URL=$SOLANA_RPC_URL ANCHOR_WALLET=~/.config/solana/id.json \
 *   pnpm tsx scripts/verify-claim-api.ts
 */
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash, randomBytes } from "node:crypto";
import idl from "../target/idl/kick_settlement.json" with { type: "json" };

const PROGRAM_ID = new PublicKey("6dcNE27gXWVbnuVuGRgZVoRswKEJny1CemJtb8jxHhX2");
const FIXTURE_ID = new anchor.BN(17588229); // real TxLINE fixture: Paraguay v Australia
const POT = 1_000_000_000n; // 1,000 tokens @ 6 decimals
const API = process.env.CLAIM_API_URL ?? "http://localhost:3000/api/claim";

const sha256 = (s: string | Buffer) => Array.from(createHash("sha256").update(s).digest());

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const wallet = provider.wallet.publicKey;
  const payer = (provider.wallet as anchor.Wallet).payer as Keypair;
  const log: string[] = [];

  // 0a. throwaway winner keypair, funded from the service wallet (no airdrop)
  const winner = Keypair.generate();
  const fundSig = await provider.sendAndConfirm(
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet,
        toPubkey: winner.publicKey,
        lamports: 20_000_000, // 0.02 SOL: fees + ATA rent
      }),
    ),
  );
  log.push(`winner (throwaway): ${winner.publicKey.toBase58()}`);
  log.push(`0 fund winner SOL:  ${fundSig}`);

  // 0b. test mint + sponsor ATA funded
  const mint = await createMint(provider.connection, payer, wallet, null, 6);
  const sponsorAta = await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, wallet);
  await mintTo(provider.connection, payer, mint, sponsorAta.address, payer, POT);
  log.push(`mint (test USDC):   ${mint.toBase58()}`);

  // PDAs
  const roomId = Array.from(randomBytes(16));
  const roomIdBuf = Buffer.from(roomId);
  const [roomPda] = PublicKey.findProgramAddressSync([Buffer.from("room"), roomIdBuf], PROGRAM_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), roomIdBuf], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  log.push(`room PDA:           ${roomPda.toBase58()}`);

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
  log.push(`1 init_room:        ${tx1}`);

  // 2. fund_pot
  const tx2 = await program.methods
    .fundPot(new anchor.BN(POT.toString()))
    .accounts({
      sponsor: wallet,
      room: roomPda,
      sponsorToken: sponsorAta.address,
      potVault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  log.push(`2 fund_pot:         ${tx2}`);

  // 3. settle_room with winner = the THROWAWAY pubkey
  const resultsHash = sha256("kickfun-claim-api-verify-v1");
  const proof = {
    fixtureId: FIXTURE_ID,
    leaf: sha256("leaf"),
    path: [] as never[],
    expectedRoot: sha256("root"),
    rawDigest: sha256("raw TxLINE proof response placeholder"),
    cpi: null,
  };
  const tx3 = await program.methods
    .settleRoom(resultsHash, winner.publicKey, proof)
    .accounts({ authority: wallet, config: configPda, room: roomPda })
    .rpc();
  log.push(`3 settle_room:      ${tx3}`);

  // 4. the API builds the unsigned claim tx (this is what the browser calls)
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomPda: roomPda.toBase58(), winner: winner.publicKey.toBase58() }),
  });
  const body = (await res.json()) as { tx: string; potAmount: string; decimals: number; mint: string };
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
  log.push(`API potAmount:      ${body.potAmount} (decimals ${body.decimals}, mint ${body.mint})`);

  // 5. sign with the throwaway key (the Privy embedded wallet's role) and send
  const claimTx = VersionedTransaction.deserialize(Buffer.from(body.tx, "base64"));
  claimTx.sign([winner]);
  const winnerAta = getAssociatedTokenAddressSync(mint, winner.publicKey);
  const before = await getAccount(provider.connection, winnerAta).then((a) => a.amount).catch(() => 0n);
  const tx4 = await provider.connection.sendRawTransaction(claimTx.serialize());
  const bh = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({ signature: tx4, ...bh }, "confirmed");
  const after = (await getAccount(provider.connection, winnerAta)).amount;
  log.push(`4 claim_pot (API):  ${tx4}`);
  log.push(`winner ATA balance: ${before} -> ${after} (received ${after - before})`);
  if (after - before !== POT) throw new Error("balance delta mismatch");

  console.log("\n=== CLAIM API PATH VERIFIED (server builds, external key signs) ===");
  for (const l of log) console.log(l);
  console.log(`explorer: https://explorer.solana.com/tx/${tx4}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
