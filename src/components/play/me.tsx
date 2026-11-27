"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import type { GameBest } from "@/db/play";
import { CATALOG, catalogGame, hueStyle, isLive, playerHue } from "@/lib/games/catalog";
import { gameBySlug } from "@/lib/games/registry";
import { deleteMe, type PlayerState, renameOwner, signOutPlayer } from "@/lib/play/actions";

import { ordinal, PLAY_ICONS, PlayerName, PlayIcon } from "./bits";
import { announcePlayer, usePlay } from "./player";
import { useBoard } from "./use-board";

const INITIAL: PlayerState = {};

const SINCE = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * A player's own page (P_Me): their colour and name, how much they've played, their best in each
 * game with this week's place, the games still to try, sign out, and delete everything. Harshal
 * sees his name on the boards here, with a way to change it.
 */
export function MyPage() {
  const { player, summary, loading, openSheet } = usePlay();
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading" className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5">
        <span className="h-[260px] rounded-game bg-surface2" />
        <span className="h-[180px] rounded-game bg-surface2" />
      </div>
    );
  }
  if (!player) {
    return (
      <section className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-game bg-surface p-6 text-center shadow-card">
        <h1 className="m-0 text-[26px] font-black">You’re playing without a name</h1>
        <p className="m-0 text-sm leading-normal text-ink2">Your games are kept on this device. Pick a name to keep your scores and get on the leaderboards.</p>
        <button type="button" onClick={() => openSheet({ kind: "new" })} className="min-h-14 rounded-btn bg-accent px-7 text-[17px] font-black text-on-accent">
          Pick a name
        </button>
        <button type="button" onClick={() => openSheet({ kind: "have" })} className="min-h-11 text-sm font-bold text-accent">
          I have a name
        </button>
      </section>
    );
  }
  const bests = summary?.bests.filter((b) => isLive(b.game)) ?? [];
  const tried = new Set(bests.map((b) => b.game));
  const todo = CATALOG.filter((g) => isLive(g.slug) && !tried.has(g.slug));
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5">
      <section style={hueStyle(playerHue(player.name))} className="flex flex-col items-center gap-1.5 rounded-game bg-hue-tint px-5 pt-6 pb-5 text-center">
        <span aria-hidden="true" className="inline-flex size-[88px] -rotate-6 items-center justify-center rounded-full bg-hue text-[40px] font-black text-hue-tint">
          <PlayerName name={[...player.name][0]?.toUpperCase() ?? ""} />
        </span>
        <h1 className="mt-1.5 mb-0 text-[30px] leading-[1.1] font-black">
          <PlayerName name={player.name} />
        </h1>
        {summary && <p className="m-0 text-[13.5px] text-ink2">Playing since {SINCE(summary.since)}</p>}
        {player.hidden && <p className="m-0 text-[13px] font-bold text-ink2">Your name is hidden from the leaderboards.</p>}
        {summary && (
          <div className="mt-2 grid w-full grid-cols-3 gap-2">
            <Stat value={String(summary.runs)} label={summary.runs === 1 ? "game" : "games"} />
            <Stat value={String(bests.length)} label={bests.length === 1 ? "game tried" : "games tried"} />
            <Stat value={String(todo.length + CATALOG.filter((g) => !isLive(g.slug)).length)} label="still to try" />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2.5 rounded-game bg-surface p-4 shadow-card">
        <h2 className="m-0 text-lg font-black">Your bests</h2>
        {bests.length === 0 ? (
          <p className="m-0 rounded-2xl border-2 border-dashed border-line px-3.5 py-3 text-[13.5px]">No games saved yet. Your best in each game shows here.</p>
        ) : (
          bests.map((b) => <BestRow key={b.game} best={b} />)
        )}
        {todo.length > 0 && (
          <>
            <p className="mt-1 mb-0 text-[13px] font-bold">Not played yet</p>
            <div className="flex flex-wrap gap-2">
              {todo.map((g) => (
                <Link
                  key={g.slug}
                  href={`/play/${g.slug}`}
                  aria-label={`Play ${g.name}`}
                  lang="ja"
                  style={hueStyle(g.slug)}
                  className="inline-flex size-12 items-center justify-center rounded-[14px] bg-hue-tint font-card text-2xl font-black text-hue no-underline"
                >
                  {g.glyph}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {player.isOwner ? <OwnerName name={player.name} /> : <GuestRows name={player.name} runs={summary?.runs ?? 0} />}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-px rounded-2xl bg-surface px-1 py-2.5">
      <span className="text-xl font-black">{value}</span>
      <span className="text-xs text-ink2">{label}</span>
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
    <Link href={`/play/${g.slug}`} style={hueStyle(g.slug)} className="flex min-h-16 items-center gap-3 rounded-[18px] bg-hue-tint p-2 text-ink no-underline">
      <span lang="ja" aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-surface font-card text-[26px] font-black text-hue">
        {g.glyph}
      </span>
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="text-[15.5px] font-black">{g.name}</span>
        <span className="text-[12.5px] text-ink2">{setup?.label ?? "Your own mix"}</span>
      </span>
      <span className="flex flex-col items-end gap-0.5 pr-1.5">
        <span className="text-[22px] leading-none font-black">{best.score}</span>
        {mine && <span className="text-xs font-bold whitespace-nowrap text-hue">{ordinal(mine.place)} this week</span>}
      </span>
    </Link>
  );
}

function GuestRows({ name, runs }: { name: string; runs: number }) {
  const [confirm, setConfirm] = useState(false);
  const [deleteState, deleteAction, deleting] = useActionState<PlayerState, FormData>(() => deleteMe(), INITIAL);
  const sheet = useRef<HTMLDialogElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (confirm && !d.open) d.showModal();
    else if (!confirm && d.open) d.close();
  }, [confirm]);

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

  return (
    <>
      <section className="flex flex-col rounded-game bg-surface p-1.5 shadow-card">
        <button type="button" onClick={signOut} disabled={signingOut} className="flex min-h-16 items-center gap-3 rounded-[18px] px-3 text-left">
          <PlayIcon d={PLAY_ICONS.signOut} size={22} />
          <span className="flex flex-auto flex-col">
            <span className="text-[15px] font-black">{signingOut ? "Signing out…" : "Sign out on this device"}</span>
            <span className="text-[12.5px] text-ink2">Your name and scores stay. Come back with your PIN.</span>
          </span>
        </button>
        <span aria-hidden="true" className="mx-3 h-px bg-line" />
        <button type="button" onClick={() => setConfirm(true)} className="flex min-h-16 items-center gap-3 rounded-[18px] px-3 text-left text-again">
          <PlayIcon d={PLAY_ICONS.bin} size={22} />
          <span className="flex flex-auto flex-col">
            <span className="text-[15px] font-black">Delete my name and scores</span>
            <span className="text-[12.5px] text-ink2">Frees the name for anyone. Asks once more.</span>
          </span>
        </button>
      </section>
      <dialog
        ref={sheet}
        onClose={() => setConfirm(false)}
        onClick={(e) => e.target === e.currentTarget && setConfirm(false)}
        aria-label={`Delete ${name}`}
        className="m-auto mb-0 w-full max-w-none rounded-t-[30px] border-0 bg-surface p-0 text-ink shadow-[0_-1px_0_var(--line),0_-16px_40px_var(--shadow)] backdrop:bg-[color-mix(in_srgb,var(--page)_78%,transparent)] laptop:mb-auto laptop:w-[460px] laptop:max-w-[460px] laptop:rounded-[30px] laptop:shadow-[0_0_0_2px_var(--again),var(--lift)]"
      >
        <form action={deleteAction} className="flex flex-col gap-3 px-5 pt-2.5 pb-[max(28px,env(safe-area-inset-bottom))] laptop:p-7">
          <span aria-hidden="true" className="h-[5px] w-11 self-center rounded-full bg-track laptop:hidden" />
          <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-full bg-surface2 text-again">
            <PlayIcon d={PLAY_ICONS.bin} size={26} />
          </span>
          <h2 className="m-0 text-[22px] font-black">
            Delete <PlayerName name={name} /> for good?
          </h2>
          <p className="m-0 text-sm leading-normal text-ink2">
            Your name, your PIN and {runs === 1 ? "your 1 score" : `all ${runs} scores`} go now, from every device and every board. This can’t be undone.
          </p>
          {deleteState.error && <p className="m-0 text-[13px] font-bold text-again">{deleteState.error}</p>}
          <button type="submit" disabled={deleting} className="min-h-[54px] rounded-btn bg-again text-base font-black text-page disabled:opacity-60">
            {deleting ? "Deleting…" : "Delete for good"}
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="min-h-[50px] rounded-btn border-2 border-line bg-surface text-[15px] font-bold">
            Keep my name
          </button>
        </form>
      </dialog>
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
    <section className="flex flex-col gap-3 rounded-game bg-surface p-4 shadow-card">
      <form action={action} className="flex flex-col gap-2">
        <label htmlFor="owner-name" className="text-[15px] font-black">
          Your name on the leaderboards
        </label>
        <div className="flex gap-2">
          <input
            id="owner-name"
            name="name"
            defaultValue={name}
            required
            autoComplete="off"
            className="box-border min-h-12 min-w-0 flex-auto rounded-2xl border-2 border-line bg-page px-4 text-[17px] font-bold"
          />
          <button type="submit" disabled={pending} className="min-h-12 rounded-btn border-2 border-ink px-4 text-sm font-black disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        <p aria-live="polite" className={`m-0 text-[13px] ${state.error ? "font-bold text-again" : "text-ink2"}`}>
          {state.error ?? (state.name ? "Saved. The boards show it within a few minutes." : "Guests see this name next to your scores.")}
        </p>
      </form>
      <Link href="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-btn bg-ink text-[15px] font-black text-page no-underline">
        <PlayIcon d={PLAY_ICONS.home} size={18} />
        Back to my Michi
      </Link>
    </section>
  );
}
