"use client";

import { type ReactNode, useState } from "react";

import { Rabbit, RABBIT_POSES } from "@/components/ui/art/rabbit";
import { Hanamaru, Sticker, STICKER_KINDS, Tick, WashiTape } from "@/components/ui/art/rewards";
import { Scene, type Season } from "@/components/ui/art/scene";
import { Spot, SPOT_KINDS } from "@/components/ui/art/spots";
import { BackLink } from "@/components/ui/back-link";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, HeroCard } from "@/components/ui/card";
import { Chip, ChoiceChips } from "@/components/ui/chip";
import { DoneScreen } from "@/components/ui/done-screen";
import { EmptyState } from "@/components/ui/empty-state";
import { AnswerInput, Field } from "@/components/ui/field";
import { GradeButtons } from "@/components/ui/grade-buttons";
import { Icon, ICON_NAMES } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { ProgressBar, TimerBar } from "@/components/ui/progress";
import { Ruby } from "@/components/ui/ruby";
import { Segmented } from "@/components/ui/segmented";
import { SessionHeader } from "@/components/ui/session-header";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { SpeakButton } from "@/components/ui/speak-button";
import { StatGrid, StatTile } from "@/components/ui/stat";
import { StickerSheet } from "@/components/ui/sticker-sheet";
import { StreakBadge } from "@/components/ui/streak-badge";
import { Switch } from "@/components/ui/switch";
import { VoiceProvider } from "@/components/ui/voice";

const SWATCHES: [string, string[]][] = [
  ["Grounds", ["bg-page", "bg-surface", "bg-surface2", "bg-raised"]],
  ["Text", ["bg-ink", "bg-ink2", "bg-ink3"]],
  ["Lines", ["bg-line", "bg-line-strong", "bg-track"]],
  ["Action", ["bg-accent", "bg-accent-hover", "bg-accent-press", "bg-accent-soft", "bg-focus"]],
  ["States", ["bg-good", "bg-warn", "bg-again", "bg-easy"]],
  ["Soft", ["bg-good-soft", "bg-warn-soft", "bg-again-soft", "bg-easy-soft"]],
  ["Covers", ["bg-cover-blue", "bg-cover-mint", "bg-cover-butter", "bg-cover-pink", "bg-cover-lilac", "bg-cover-aqua", "bg-cover-peri", "bg-cover-cobalt"]],
  ["Tones", ["bg-tone-cobalt", "bg-tone-blue", "bg-tone-peri", "bg-tone-mint", "bg-tone-lilac", "bg-tone-butter", "bg-tone-aqua", "bg-tone-pink"]],
  ["Rewards and art", ["bg-hanamaru", "bg-lit", "bg-scene-night", "bg-usagi", "bg-usagi-shade", "bg-paper-rule", "bg-snow"]],
];

const TYPE: [string, string, string][] = [
  ["text-kana", "72", "あ"],
  ["text-display", "40", "Today"],
  ["text-headline", "28", "Screen title"],
  ["text-title", "22", "Section title"],
  ["text-lead", "18", "Large buttons, sub-heads"],
  ["text-body", "16", "Body text on the phone, inputs"],
  ["text-meta", "14", "Meta: 18 cards · about 6 min"],
  ["text-caption", "12", "must-do, tab labels"],
];

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-title font-bold">{title}</h2>
        {note && <p className="m-0 text-meta text-ink2">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Every part in its states, in whichever theme the surrounding [data-theme] block sets. */
export function Showcase({ theme }: { theme: "light" | "dark" }) {
  const [seg, setSeg] = useState<"system" | "light" | "dark">("system");
  const [level, setLevel] = useState("N5");
  const [rows, setRows] = useState<string[]>(["a", "ka"]);
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [lit, setLit] = useState(3);
  const [started] = useState(() => Date.now());
  const seasons: Season[] = ["winter", "spring", "summer", "autumn"];
  return (
    <VoiceProvider prefs={{ name: null, rate: 1 }}>
      <div className="flex flex-col gap-10">
        <p className="m-0 text-meta font-bold text-ink2 uppercase">{theme}</p>

        <Block title="Colour" note="Tokens in globals.css; Tailwind names below each swatch.">
          {SWATCHES.map(([group, list]) => (
            <div key={group} className="flex flex-col gap-1.5">
              <h3 className="m-0 text-meta font-bold">{group}</h3>
              <div className="grid grid-cols-4 gap-2">
                {list.map((c) => (
                  <div key={c} className="flex flex-col gap-1">
                    <span className={`block h-10 rounded-pill border-[1.5px] border-line ${c}`} />
                    <code className="text-caption break-all text-ink2">{c.slice(3)}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Block>

        <Block title="Type" note="Zen Maru Gothic 500 / 700 / 900; Klee One 600 for Japanese lines.">
          {TYPE.map(([cls, px, sample]) => (
            <div key={cls} className="flex items-baseline gap-3">
              <code className="w-12 shrink-0 text-caption text-ink2">{px}</code>
              <span lang={cls === "text-kana" ? "ja" : undefined} className={`${cls} ${cls === "text-kana" ? "font-ja" : "font-bold"}`}>
                {sample}
              </span>
            </div>
          ))}
          <p lang="ja" className="m-0 font-ja text-title leading-ja">
            <Ruby text="{毎日|まいにち}{日本語|にほんご}を{勉強|べんきょう}します。" />
          </p>
          <p className="m-0 text-body">
            Body 500, <strong className="font-bold">labels 700</strong>, <span className="font-black">titles and numbers 900</span>.
          </p>
        </Block>

        <Block title="Shape" note="Chips 7·7·7·2, buttons 14 / 16, cards 22, sheets 28; card and raised shadows.">
          <div className="flex flex-wrap items-end gap-3">
            {["rounded-chip", "rounded-box", "rounded-pill", "rounded-btn", "rounded-btn-lg", "rounded-grade", "rounded-card", "rounded-sheet"].map((r) => (
              <div key={r} className="flex flex-col items-center gap-1">
                <span className={`block size-14 border-[1.5px] border-line-strong bg-surface2 ${r}`} />
                <code className="text-caption text-ink2">{r.slice(8)}</code>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card bg-surface p-4 text-meta shadow-card">shadow-card</div>
            <div className="rounded-card bg-raised p-4 text-meta shadow-raised">shadow-raised</div>
          </div>
        </Block>

        <Block title="Buttons" note="One primary per screen. 56 large / 48 medium / 44 small.">
          <div className="flex flex-wrap gap-2">
            <Button size="lg" icon="play">
              Start reviews
            </Button>
            <Button icon="play">Start</Button>
            <Button size="sm">Reload</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="play" disabled>
              Start
            </Button>
            <Button icon="play" loading>
              Start
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="plus">
              Add a word
            </Button>
            <Button variant="secondary" icon="plus" disabled>
              Add a word
            </Button>
            <Button variant="secondary" icon="plus" loading>
              Add a word
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="quiet">See all</Button>
            <Button variant="text" icon="logout">
              Sign out
            </Button>
            <Button variant="danger" icon="trash">
              Delete
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton icon="close" label="Close" />
            <IconButton icon="flag" label="Flag this card" />
            <IconButton icon="flag" label="Flag this card (on)" pressed />
            <SpeakButton text="あたたかい" label="Play the word" />
            <SpeakButton variant="round-sm" text="あたたかい" label="Play the word" />
            <SpeakButton variant="icon" text="あたたかい" label="Play the example" />
            <SpeakButton variant="pill" text="あたたかい">
              Word
            </SpeakButton>
          </div>
        </Block>

        <Block title="Choices" note="Chips, filter chips, segmented, switch.">
          <div className="flex flex-wrap gap-2">
            <Chip cover="butter">must-do</Chip>
            <Chip cover="blue">Word · N5</Chip>
            <Chip cover="mint">i-adjective</Chip>
            <Chip cover="lilac">Particle</Chip>
            <Chip kind="count">18</Chip>
            <Chip kind="soon">Soon</Chip>
            <Chip cover="pink" size="lg">
              Verb
            </Chip>
          </div>
          <ChoiceChips label="Level" options={["N5", "N4", "N3"].map((v) => ({ value: v, label: v }))} value={level} onChange={setLevel} />
          <ChoiceChips
            label="Rows"
            multiple
            options={[
              { value: "a", label: "あ", ja: true },
              { value: "ka", label: "か", ja: true },
              { value: "sa", label: "さ", ja: true },
            ]}
            value={rows}
            onChange={setRows}
          />
          <Segmented
            label="Theme"
            name={`theme-demo-${theme}`}
            value={seg}
            onChange={setSeg}
            options={[
              { value: "system", label: "System", icon: "monitor" },
              { value: "light", label: "Light", icon: "sun" },
              { value: "dark", label: "Dark", icon: "moon" },
            ]}
          />
          <Segmented label="Status (disabled)" name={`status-demo-${theme}`} defaultValue="learning" disabled options={[{ value: "new", label: "Not started" }, { value: "learning", label: "Learning" }, { value: "sure", label: "Confident" }]} />
          <div className="flex items-center gap-4">
            <Switch label="Speech recognition" checked={on} onChange={setOn} />
            <Switch label="Off" checked={false} />
            <Switch label="Disabled" checked disabled />
          </div>
        </Block>

        <Block title="Rows" note="Plan rows with cover checkboxes; More rows with icon tiles.">
          <List aria-label="Plan">
            <ListRow href="#" lead={{ check: "mint" }} title="Daily quiz" chip={<Chip cover="butter">must-do</Chip>} meta="10 questions · about 6 min" />
            <ListRow href="#" lead={{ check: "lilac" }} title="Read N5 grammar" meta="2 lessons · about 10 min" current />
            <ListRow href="#" lead={{ check: "blue", state: "done" }} title="Reviews" meta="18 cards · done" />
            <ListRow lead={{ check: "butter", state: "locked" }} title="Work Japanese" meta="Locked · opens 1 Jan" />
          </List>
          <List aria-label="More">
            <ListRow href="#" lead={{ icon: "progress", cover: "blue" }} title="Progress" meta="a year of reviews, day by day" />
            <ListRow lead={{ icon: "resources", waiting: true }} title="Resources" meta="links by skill and level" trailing={<Chip kind="soon">Soon</Chip>} disabled />
          </List>
        </Block>

        <Block title="Headings and links">
          <PageHeader title="More" sub="Thursday 3 December" back={{ href: "#", label: "Back" }} />
          <SectionTitle meta="0 of 6 done">Today’s plan</SectionTitle>
          <SectionTitle link={{ href: "#", label: "See all" }}>This week</SectionTitle>
          <BackLink href="#">More</BackLink>
          <LinkTabs
            label="Script"
            tabs={[
              { href: "#", label: "Hiragana", current: true },
              { href: "#katakana", label: "Katakana", note: "46 + 25", current: false },
            ]}
          />
        </Block>

        <Block title="Progress, numbers">
          <ProgressBar value={7} max={18} label="Card 7 of 18" />
          <ProgressBar value={1} max={6} label="1 of 6 tasks done" />
          <ProgressBar value={3} max={30} label="3 of 30 days" size="strip" ticks={false} />
          <TimerBar startedAt={started} durationMs={8000} running label="Time to answer" />
          <div className="flex items-center justify-between gap-4">
            <StreakBadge count={6} sub="best yet" />
            <StreakBadge count={12} size="sm" />
          </div>
          <Card>
            <StatGrid cols={3}>
              <StatTile value="3 h 40 min" label="studied" />
              <StatTile value="142" label="reviews" />
              <StatTile value="96%" label="remembered" tone="good" />
            </StatGrid>
          </Card>
        </Block>

        <Block title="Fields">
          <Field label="Word" name="demo-word" ja defaultValue="暖かい" />
          <Field label="Meaning" name="demo-meaning" placeholder="e.g. warm" hint="A few words is enough." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reading" name="demo-reading" defaultValue="atatakai" error="Use kana" />
            <Field label="Deck" name="demo-deck" defaultValue="N5 words" disabled />
          </div>
          <Field as="select" label="Level" name="demo-level" defaultValue="N5">
            <option>N5</option>
            <option>N4</option>
          </Field>
          <AnswerInput aria-label="Answer" placeholder="Type how it sounds" />
          <AnswerInput aria-label="Answer, right" defaultValue="ka" state="right" />
          <AnswerInput aria-label="Answer, wrong" defaultValue="ga" state="wrong" />
        </Block>

        <Block title="States" note="Banners, empty, loading.">
          <Banner kind="offline" title="You’re offline">
            Reviews still work. Grades save here first.
          </Banner>
          <Banner kind="waiting" title="3 grades waiting to save">
            They’ll sync when you’re back online.
          </Banner>
          <Banner kind="version" title="A new version is ready" action={<Button size="sm">Reload</Button>} />
          <EmptyState art={<Spot kind="notebook" />} title="Nothing to review right now" action={<Button variant="quiet" href="#">Back to Today</Button>}>
            The next 14 cards come back tomorrow morning. Today’s other tasks are still open.
          </EmptyState>
          <EmptyState>No mistakes saved yet.</EmptyState>
          <Card className="flex flex-col gap-3">
            <Skeleton shape="block" className="h-24" />
            <SkeletonText lines={2} />
            <Skeleton shape="circle" className="size-11" />
          </Card>
        </Block>

        <Block title="Sessions" note="Header (close, title, count, ticked bar), grade buttons, done.">
          <SessionHeader
            title="Reviews"
            count="7 / 18"
            close={{ href: "#", label: "Close reviews" }}
            progress={{ value: 7, max: 18, label: "Card 7 of 18" }}
            trailing={<IconButton icon="flag" label="Flag this card" />}
            focusOnOpen={false}
            session={false}
          />
          <GradeButtons intervals={["1 min", "8 min", "3 days", "9 days"]} onGrade={() => {}} />
          <DoneScreen hanamaru title={<>Done for<br />today</>} />
          <DoneScreen title="18 cards done" art={<Spot kind="lantern" />} actions={<Button size="lg" full iconEnd="arrow-right" href="#">Back to Today</Button>}>
            Your grades are safe on this phone. Nothing to do; they save by themselves.
          </DoneScreen>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open the sheet
          </Button>
          <Sheet
            open={sheet}
            onClose={() => setSheet(false)}
            title="Add a word"
            actions={
              <>
                <Button size="lg" full icon="check" onClick={() => setSheet(false)}>
                  Save word
                </Button>
                <Button variant="quiet" onClick={() => setSheet(false)}>
                  Cancel
                </Button>
              </>
            }
          >
            <Field label="Word" name="sheet-word" ja />
            <Field label="Meaning" name="sheet-meaning" placeholder="e.g. warm" />
          </Sheet>
        </Block>

        <Block title="The rabbit" note="Six poses, one job each.">
          <div className="grid grid-cols-3 gap-3">
            {RABBIT_POSES.map((p) => (
              <figure key={p} className="m-0 flex flex-col items-center gap-1 rounded-card bg-cover-blue pt-4 pb-2">
                <Rabbit pose={p} size={110} />
                <figcaption className="text-caption font-bold text-on-cover">{p}</figcaption>
              </figure>
            ))}
          </div>
        </Block>

        <Block title="The farmhouse" note="Four evenings; windows light one per finished task, the lantern at 6.">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setLit((n) => (n + 1) % 7)}>
              Light one more
            </Button>
            <span className="text-meta text-ink2">{lit} of 6</span>
          </div>
          <HeroCard art={<Scene lit={lit} season="winter" />}>
            <div className="flex items-center gap-2">
              <h3 className="m-0 text-title font-black">Reviews</h3>
              <Chip cover="butter">must-do</Chip>
            </div>
            <p className="m-0 text-meta text-ink2">18 cards · about 6 min</p>
          </HeroCard>
          <div className="grid grid-cols-2 gap-3">
            {seasons.map((s) => (
              <figure key={s} className="m-0 flex flex-col gap-1">
                <div className="h-28 overflow-hidden rounded-btn-lg bg-scene-night">
                  <Scene season={s} lit={6} />
                </div>
                <figcaption className="text-caption text-ink2">{s} · 6 of 6</figcaption>
              </figure>
            ))}
            {[0, 1].map((n) => (
              <figure key={n} className="m-0 flex flex-col gap-1">
                <div className="h-28 overflow-hidden rounded-btn-lg bg-scene-night">
                  <Scene season="winter" lit={n} />
                </div>
                <figcaption className="text-caption text-ink2">winter · {n} of 6</figcaption>
              </figure>
            ))}
          </div>
        </Block>

        <Block title="Spots, stickers, the red pencil">
          <div className="flex flex-wrap justify-center gap-3">
            {SPOT_KINDS.map((k) => (
              <figure key={k} className="m-0 flex flex-col items-center gap-1">
                <Spot kind={k} size={120} />
                <figcaption className="text-caption text-ink2">{k}</figcaption>
              </figure>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {STICKER_KINDS.map((k) => (
              <Sticker key={k} kind={k} />
            ))}
            <Tick size={32} />
            <WashiTape />
          </div>
          <div className="mt-10" />
          <StickerSheet days={["star-butter", "flower-pink", "leaf-mint", "star-peri", "hanamaru-butter", null, null]} today={4} dropping />
          <div className="flex justify-center">
            <Hanamaru width={200} />
          </div>
        </Block>

        <Block title="Icons" note="One stroke set: 24 viewBox, stroke 2.">
          <div className="grid grid-cols-6 gap-2">
            {ICON_NAMES.map((n) => (
              <div key={n} className="flex flex-col items-center gap-1 text-ink" title={n}>
                <Icon name={n} />
                <code className="max-w-full truncate text-caption text-ink2">{n}</code>
              </div>
            ))}
          </div>
        </Block>
      </div>
    </VoiceProvider>
  );
}
