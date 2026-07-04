/**
 * One-time setup: init_config on kick-settlement.
 * Run: pnpm tsx scripts/init-config.ts
 *
 * Must be signed by the program's UPGRADE AUTHORITY (the wallet that deployed
 * it) — this is the front-run guard from the audit. Uses your default CLI
 * keypair (~/.config/solana/id.json) via ANCHOR_WALLET / solana config.
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../target/idl/kick_settlement.json" with { type: "json" };

const PROGRAM_ID = new PublicKey("6dcNE27gXWVbnuVuGRgZVoRswKEJny1CemJtb8jxHhX2");
const TXORACLE_DEVNET = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

async function main() {
  const provider = anchor.AnchorProvider.env(); // reads ANCHOR_PROVIDER_URL + ANCHOR_WALLET
  anchor.setProvider(provider);
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID,
  );
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [PROGRAM_ID.toBuffer()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
  );

  console.log("authority:", provider.wallet.publicKey.toBase58());
  console.log("config PDA:", configPda.toBase58());
  console.log("programData:", programDataAddress.toBase58());

  const sig = await program.methods
    .initConfig(TXORACLE_DEVNET, { hashAnchor: {} }) // VerifyMode::HashAnchor (rung C, safe default)
    .accounts({
      authority: provider.wallet.publicKey,
      config: configPda,
      program: PROGRAM_ID,
      programData: programDataAddress,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("init_config tx:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
