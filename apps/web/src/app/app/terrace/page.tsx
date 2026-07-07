"use client";

/* Terrace index: the TERRACE tab. Lists the rooms this browser's identity has
   actually joined (via /api/me/rooms, service-role read past RLS), with the
   scripted BRA v ARG demo kept in its own clearly-marked SHOWCASE section so
   mock data only ever appears when explicitly chosen. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronRight, Clapperboard, Users } from "lucide-react";
import { Button, Card, LiveDot, Mono, Skeleton, Tag, sound } from "@kick/ui";
import { useHistoryIdentity } from "../../../lib/use-history";
import { teamCode } from "../../../lib/team-code";
import { formatKickoff } from "../../../lib/format-kickoff";

interface MemberRoom {
  roomId: string;
  code: string;
  name: string | null;
  status: string;
  members: number;
  fixture: {
    id: number;
    home_team: string;
    away_team: string;
    kickoff_at: string;
    status: string;
  };
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 360, damping: 28 } },
};

function TerraceCard({ room, onClick }: { room: MemberRoom; onClick: () => void }) {
  const live = room.fixture.status === "live";
  const { day, time } = formatKickoff(room.fixture.kickoff_at);
  return (
    <Card
      interactive
      onClick={onClick}
      className={"flex items-center gap-3 p-3 " + (live ? "border-pitch-700" : "")}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Mono className="text-xs font-bold tracking-widest text-text-dim">{room.code}</Mono>
          {live && <LiveDot />}
        </div>
        <div className="mt-1 truncate text-sm font-bold text-text">
          {room.name ?? `${teamCode(room.fixture.home_team)} v ${teamCode(room.fixture.away_team)}`}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-display text-[11px] text-text-dim">
            {teamCode(room.fixture.home_team)}
            <span className="mx-1 text-text-muted">v</span>
            {teamCode(room.fixture.away_team)}
          </span>
          <Mono className="text-[10px] text-text-muted">
            {live ? "LIVE" : time ? `${day} · ${time}` : "TBD"}
          </Mono>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Users size={12} />
          <Mono className="text-[10px]">{room.members} in</Mono>
        </span>
        <ChevronRight size={16} className="text-text-muted" />
      </div>
    </Card>
  );
}

export default function TerraceIndexPage() {
  const router = useRouter();
  const { userId, resolved } = useHistoryIdentity();
  const [rooms, setRooms] = React.useState<MemberRoom[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!resolved) return;
    if (!userId) {
      setRooms([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/me/rooms?userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : { rooms: [] }))
      .then((body: { rooms?: MemberRoom[] }) => {
        if (cancelled) return;
        setRooms(Array.isArray(body?.rooms) ? body.rooms : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRooms([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolved, userId]);

  const open = (code: string) => {
    sound.play("tap");
    router.push(`/app/terrace/${code}`);
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 px-4 pb-8 pt-5"
    >
      {/* your terraces: the rooms this identity actually joined */}
      <motion.section variants={item} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-sm text-text">YOUR TERRACES</span>
          {!loading && rooms.length > 0 && (
            <Mono className="text-xs text-text-muted">{rooms.length}</Mono>
          )}
        </div>

        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] w-full" />)
        ) : rooms.length > 0 ? (
          rooms.map((r) => <TerraceCard key={r.roomId} room={r} onClick={() => open(r.code)} />)
        ) : (
          <Card className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-text-dim">No terrace yet. Start one from the pitch.</p>
            <Button size="sm" onClick={() => router.push("/app")}>
              To the pitch
            </Button>
          </Card>
        )}
      </motion.section>

      {/* showcase: the scripted demo, explicitly labelled, never mixed in above */}
      <motion.section variants={item} className="flex flex-col gap-2">
        <span className="font-display text-sm text-text">SHOWCASE</span>
        <Card
          interactive
          onClick={() => open("QPR7")}
          className="border-dashed border-border-strong bg-transparent p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-[11px] tracking-widest text-text-dim">
              <Clapperboard size={12} /> DEMO TERRACE · BRA v ARG simulation
            </span>
            <Tag className="text-text-muted">SCRIPTED</Tag>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            A replayed match on demo data: the Oracle calls it, props fire, nothing here is live.
            Step in to see the full loop without waiting for kickoff.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <Mono className="text-xs font-bold tracking-widest text-text-dim">QPR7</Mono>
            <ChevronRight size={16} className="text-text-muted" />
          </div>
        </Card>
      </motion.section>
    </motion.div>
  );
}
