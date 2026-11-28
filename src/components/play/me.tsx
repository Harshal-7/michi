"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import type { GameBest } from "@/db/play";
import { CATALOG, catalogGame, hueStyle, isLive, playerHue } from "@/lib/games/catalog";
import { gameBySlug } from "@/lib/games/registry";
import { deleteMe, type PlayerState, renameOwner, signOutPlayer } from "@/lib/play/actions";

import { Avatar, GameGlyph, ordinal, PlayerName } from "./bits";
import { announcePlayer, usePlay } from "./player";
import { useBoard } from "./use-board";

const INITIAL: PlayerState = {};

const SINCE = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * A player's own page (no board of its own: built from RF_PlayHub's tiles and rows): their colour and name, how much they've played, their best in each
 * game with this week's place, the games still to try, sign out, and delete everything. Harshal
 * sees his name on the boards here, with a way to change it.
 */
export function MyPage() {
  const { player, summary, loading, openSheet } = usePlay();
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading" className="mx-auto flex w-full max-w-140 flex-col gap-3.5">
        <Skeleton shape="block" className="h-64" />
        <Skeleton shape="block" className="h-44" />
      </div>
    );
  }
  if (!player) {
    return (
      <div className="mx-auto w-full max-w-140">
        <h1 className="sr-only">Your name</h1>
        <EmptyState
          art={<Rabbit pose="waving" size={160} />}
          title="You’re playing without a name"
          action={
            <>
              <Button size="lg" onClick={() => openSheet({ kind: "new" })}>
                Pick a name
              </Button>
              <Button variant="quiet" iconEnd={null} onClick={() => openSheet({ kind: "have" })}>
                I have a name
              </Button>
            </>
          }
        >
          Your games are kept on this device. Pick a name to keep your scores and get on the leaderboards.
        </EmptyState>
      </div>
    );
  }
  const bests = summary?.bests.filter((b) => isLive(b.game)) ?? [];
  const tried = new Set(bests.map((b) => b.game));
  const todo = CATALOG.filter((g) => isLive(g.slug) && !tried.has(g.slug));
  return (
    <div className="mx-auto flex w-full max-w-140 flex-col gap-3.5">
      <section style={hueStyle(playerHue(player.name))} className="flex flex-col items-center gap-1.5 rounded-l-box rounded-r-card bg-hue-tint px-5 pt-6 pb-5 text-center">
        <Avatar name={player.name} size="lg" className="-rotate-6" />
        <h1 className="m-0 mt-1.5 text-headline font-black">
          <PlayerName name={player.name} />
        </h1>
        {summary && <p className="m-0 text-meta text-ink2">Playing since {SINCE(summary.since)}</p>}
        {player.hidden && <p className="m-0 text-meta font-bold text-ink2">Your name is hidden from the leaderboards.</p>}
        {summary && (
          <dl className="m-0 mt-2 grid w-full grid-cols-3 gap-2">
            <Stat value={String(summary.runs)} label={summary.runs === 1 ? "game" : "games"} />
            <Stat value={String(bests.length)} label={bests.length === 1 ? "game tried" : "games tried"} />
            <Stat value={String(todo.length + CATALOG.filter((g) => !isLive(g.slug)).length)} label="still to try" />
          </dl>
        )}
      </section>

      <Card aria-labelledby="bests" className="flex flex-col gap-2.5">
        <SectionTitle id="bests">Your bests</SectionTitle>
        {bests.length === 0 ? <EmptyState>No games saved yet. Your best in each game shows here.</EmptyState> : bests.map((b) => <BestRow key={b.game} best={b} />)}
        {todo.length > 0 && (
          <>
            <p className="m-0 mt-1 text-meta font-bold">Not played yet</p>
            <div className="flex flex-wrap gap-2">
              {todo.map((g) => (
                <Link
                  key={g.slug}
                  href={`/play/${g.slug}`}
                  aria-label={`Play ${g.name}`}
                  style={hueStyle(g.slug)}
                  className="grid size-12 place-items-center rounded-btn bg-hue-tint text-hue no-underline"
                >
                  <GameGlyph glyph={g.glyph} size={30} />
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>

      {player.isOwner ? <OwnerName name={player.name} /> : <GuestRows name={player.name} runs={summary?.runs ?? 0} />}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col rounded-btn bg-surface px-1 py-2.5">
      <dd className="order-1 m-0 text-title font-black tabular-nums">{value}</dd>
      <dt className="order-2 text-caption text-ink2">{label}</dt>
    </div>
  );
}

function BestRow({ best }: { best: GameBest }) {
  const g = catalogGame(best.game)!;
  const entry = gameBySlug(best.game);
  const setup = entry?.setups.find((s) => s.key === best.setup);
  const { view } = useBoard(best.game, setup ? best.setup : null, "week");
  const mine = view ? (view.me ?? view.top.find((p) => p.you) ?? null) : null;
  return (
    <Link href={`/play/${g.slug}`} style={hueStyle(g.slug)} className="flex min-h-16 items-center gap-3 rounded-btn-lg bg-hue-tint p-2 text-ink no-underline">
      <span className="grid size-12 shrink-0 place-items-center rounded-btn bg-surface text-hue">
        <GameGlyph glyph={g.glyph} size={34} />
      </span>
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="text-body font-black">{g.name}</span>
        <span className="text-meta text-ink2">{setup?.label ?? "Your own mix"}</span>
      </span>
      <span className="flex flex-col items-end gap-0.5 pr-1.5">
        <span className="text-title leading-none font-black tabular-nums">{best.score}</span>
        {mine && <span className="text-caption font-bold whitespace-nowrap text-hue">{ordinal(mine.place)} this week</span>}
      </span>
    </Link>
  );
}

function GuestRows({ name, runs }: { name: string; runs: number }) {
  const [confirm, setConfirm] = useState(false);
  const [deleteState, deleteAction, deleting] = useActionState<PlayerState, FormData>(() => deleteMe(), INITIAL);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  // An answer without an error means the name and scores are gone.
  useEffect(() => {
    if (deleteState !== INITIAL && !deleteState.error) {
      announcePlayer();
      router.replace("/play");
    }
  }, [deleteState, router]);

  const signOut = async () => {
    setSigningOut(true);
    await signOutPlayer();
    announcePlayer();
    router.replace("/play");
  };

  const row = "flex min-h-16 w-full items-center gap-3 rounded-btn-lg px-3 text-left hover:bg-surface2 disabled:text-ink3";
  return (
    <>
      <Card padding="none" className="flex flex-col p-1.5">
        <button type="button" onClick={signOut} disabled={signingOut} className={row}>
          <Icon name="logout" size={22} />
          <span className="flex flex-auto flex-col">
            <span className="text-body font-black">{signingOut ? "Signing out…" : "Sign out on this device"}</span>
            <span className="text-meta text-ink2">Your name and scores stay. Come back with your PIN.</span>
          </span>
        </button>
        <span aria-hidden="true" className="mx-3 h-px bg-line" />
        <button type="button" onClick={() => setConfirm(true)} className={`${row} text-again`}>
          <Icon name="trash" size={22} />
          <span className="flex flex-auto flex-col">
            <span className="text-body font-black">Delete my name and scores</span>
            <span className="text-meta text-ink2">Frees the name for anyone. Asks once more.</span>
          </span>
        </button>
      </Card>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={
          <>
            Delete <PlayerName name={name} /> for good?
          </>
        }
        lead={`Your name, your PIN and ${runs === 1 ? "your 1 score" : `all ${runs} scores`} go now, from every device and every board. This can’t be undone.`}
        actions={
          <>
            <Button type="submit" form="delete-me" variant="danger" size="lg" full loading={deleting} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete for good"}
            </Button>
            <Button variant="text" onClick={() => setConfirm(false)}>
              Keep my name
            </Button>
          </>
        }
      >
        <form id="delete-me" action={deleteAction}>
          {deleteState.error && <p className="m-0 text-meta font-bold text-again">{deleteState.error}</p>}
        </form>
      </Sheet>
    </>
  );
}

/** Harshal's name on the boards (decision D), and the way back to his Michi. */
function OwnerName({ name }: { name: string }) {
  const [state, action, pending] = useActionState<PlayerState, FormData>(renameOwner, INITIAL);
  useEffect(() => {
    if (state.name) announcePlayer();
  }, [state]);
  return (
    <Card className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-1.5">
        <label htmlFor="owner-name" className="text-meta font-bold">
          Your name on the leaderboards
        </label>
        <div className="flex gap-2">
          <input
            id="owner-name"
            name="name"
            defaultValue={name}
            required
            autoComplete="off"
            aria-invalid={state.error ? true : undefined}
            aria-describedby="owner-name-note"
            className="block h-12 min-w-0 flex-auto rounded-btn border-[1.5px] border-line-strong bg-surface px-4 text-body font-bold text-ink outline-none focus:border-accent focus:shadow-field aria-invalid:border-again"
          />
          <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        <p id="owner-name-note" aria-live="polite" className={`m-0 text-meta ${state.error ? "font-bold text-again" : "text-ink2"}`}>
          {state.error ?? (state.name ? "Saved. The boards show it within a few minutes." : "Guests see this name next to your scores.")}
        </p>
      </form>
      <Button variant="secondary" icon="home" href="/" full>
        Back to my Michi
      </Button>
    </Card>
  );
}
