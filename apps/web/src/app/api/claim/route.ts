/* POST /api/claim — build the unsigned claim_pot transaction for the winner.
   The server never signs anything: it verifies the room is Settled and that
   the caller is the recorded winner, then returns a base64 VersionedTransaction
   (fee payer = winner) for the client to sign with their Privy embedded wallet.

   This route is the ONLY importer of @coral-xyz/anchor + @solana/web3.js in
   apps/web; keep it that way so the heavy Solana deps stay out of client bundles. */

import { NextResponse } from "next/server";
import { Program, type Idl, type Provider } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "../../../../../../target/idl/kick_settlement.json";

export const runtime = "nodejs";

const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

type ClaimBody = { roomPda?: unknown; winner?: unknown };

function pubkeyOrNull(v: unknown): PublicKey | null {
  if (typeof v !== "string") return null;
  try {
    return new PublicKey(v);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: ClaimBody;
  try {
    body = (await req.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const roomPda = pubkeyOrNull(body.roomPda);
  const winner = pubkeyOrNull(body.winner);
  if (!roomPda || !winner) {
    return NextResponse.json(
      { error: "bad_request", reason: "roomPda and winner must be base58 pubkeys" },
      { status: 400 },
    );
  }

  const rpc = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpc) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const connection = new Connection(rpc, "confirmed");
  // Read-only provider: account fetch + ix building need no wallet.
  const program = new Program(idl as Idl, { connection } as Provider);

  let room;
  try {
    room = await (program.account as { room: { fetch(pk: PublicKey): Promise<Record<string, unknown>> } }).room.fetch(
      roomPda,
    );
  } catch {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  const status = room.status as Record<string, unknown>;
  if (!("settled" in status)) {
    return NextResponse.json(
      { error: "not_claimable", reason: "not_settled" },
      { status: 409 },
    );
  }
  if (room.potClaimed as boolean) {
    return NextResponse.json(
      { error: "not_claimable", reason: "already_claimed" },
      { status: 409 },
    );
  }
  const recordedWinner = room.winner as PublicKey | null;
  if (!recordedWinner || !recordedWinner.equals(winner)) {
    return NextResponse.json(
      { error: "not_claimable", reason: "not_winner" },
      { status: 409 },
    );
  }

  const roomId = Buffer.from(room.roomId as number[]);
  const [potVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), roomId],
    PROGRAM_ID,
  );
  const potMint = room.potMint as PublicKey;
  const winnerToken = getAssociatedTokenAddressSync(potMint, winner);

  // Idempotent ATA create first: winner may never have held the pot mint.
  const ataIx = createAssociatedTokenAccountIdempotentInstruction(
    winner, // payer (fee payer = winner)
    winnerToken,
    winner,
    potMint,
  );

  const claimIx = await program.methods
    .claimPot()
    .accountsPartial({
      winner,
      room: roomPda,
      potVault,
      winnerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const [{ blockhash }, mintInfo] = await Promise.all([
    connection.getLatestBlockhash("confirmed"),
    getMint(connection, potMint),
  ]);

  const message = new TransactionMessage({
    payerKey: winner,
    recentBlockhash: blockhash,
    instructions: [ataIx, claimIx],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);

  return NextResponse.json({
    tx: Buffer.from(tx.serialize()).toString("base64"),
    potAmount: (room.potAmount as { toString(): string }).toString(),
    decimals: mintInfo.decimals,
    mint: potMint.toBase58(),
  });
}
