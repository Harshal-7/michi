---
name: michi-design
description: Michi's design rules after the 2026 redesign (B "Hanamaru" notebook look with C's snow rabbit and seasonal farmhouse, one light and one dark theme). Read this before any UI work in this repo — a new screen, a new part, a restyle or a layout change — so the result matches the approved canvas instead of inventing a new look.
---

# Designing in Michi

Harshal designs the look on a canvas first and approves it. Build what the canvas shows, from the shared parts in
`src/components/ui/`. Don't invent new visual styles, and don't iterate on looks in code.

## 1. Where the design lives

- **The canvas** (source of truth): https://claude.ai/artifact/AKqg3xuo9DhzzdtdBK3ZMY, page **Redesign · final**.
  Read a board with the Artifact tool (`read`, `path`: `project/<Board>.dc.html`). A local copy of every board, the
  kit and the generators is in `~/Developer/docs/learning/japanese/michi-canvas/redesign/` (outside this repo).
  Older pages ("Final · your mix", "Redesign · directions", the theme pages) are history, not the design.
- **The plan**: `~/Developer/docs/learning/japanese/michi-redesign-plan.md` (outside this repo).
- **The kit** (`redesign/final/kit/`): `tokens.css.txt` (every token, light and dark), `parts.md` (each part's
  exact markup and styles), `icons.svg.txt` (the one stroke icon set), `art/*.svg` (every illustration).
- **Boards by row:**
  1. System: `RF_Tokens`, `RF_Parts`, `RF_Illustrations`.
  2. Today: `RF_Today`, `RF_TodayDark`, `RF_TodayDone`, `RF_TodayWeb`.
  3. Review: `RF_ReviewFront`, `RF_ReviewBack` (dark), `RF_ReviewDone`, `RF_QuickCheck`.
  4. Practice: `RF_PracticeHub`, `RF_QuizQuestion` (dark), `RF_QuizResults`.
  5. Learn: `RF_LearnHub`, `RF_GrammarLesson` (dark), `RF_GrammarLessonWeb`, `RF_KanaChart`, `RF_VocabSession`.
  6. More: `RF_More`, `RF_Settings` (dark), `RF_SignIn`, `RF_States`.
  7. Play: `RF_PlayHub`, `RF_PlayKanaStart`, `RF_PlayKanaInPlay` (dark), `RF_PlayDone`, `RF_PlayLeaderboard`,
     `RF_PlayNameSheet`.
- **`/design`** (signed in only) is the living version of `RF_Tokens` + `RF_Parts` + `RF_Illustrations`, built from the
  real components, light and dark side by side. If `/design` and the canvas disagree, the canvas wins; fix `/design`.

## 2. How to work

1. **Find the closest board** and build from the same parts, sizes and spacing.
2. **No design for it?** (a new kind of screen, a new visual piece, a new layout) Don't improvise in code. Draw it
   on the canvas next to the related boards with the kit, tell Harshal, and build it once he approves. Small
   variations of an existing pattern (another settings row, another chip) don't need this.
3. **Tokens and parts only.** The design-lint test (`src/lib/design-lint.test.ts`) fails on hex colours, arbitrary
   sizes/radii/shadows (`text-[…]`, `rounded-[…]`, `shadow-[…]`), Tailwind's default sizes and palette, raw
   z-index, `var()` in a class, `data-look`, an accent button built by hand outside `ui/` ("use Button"), and colour
   classes that aren't tokens; the class rules read only class strings, never copy. Real exceptions take
   `// design-lint-ignore-next-line <rule>: <reason>`. Every file is restyled, so there's no legacy skip any more,
   and Tailwind's own text sizes, radii and shadows are switched off in globals.css. Art colours live in `src/components/ui/art/*.ts`, not in components.
4. **Check before handing over** (section 7), and say what you couldn't check.

## 3. The system

**Idea.** Michi is your study notebook. Pages stay white (light) or a neutral night desk (dark). Colour lives in
notebook covers, stickers, illustrations and the one blue action. The red pencil is only for rewards.

**Colour** (all in `src/app/globals.css`: `:root, [data-theme="light"]` and `[data-theme="dark"]`; values in
`RF_Tokens` and `kit/tokens.css.txt`):
- Grounds: `page surface surface2 raised`. Text: `ink ink2 ink3` (ink3 for hints and placeholders, still ≥ 4.5:1).
  Lines: `line line-strong` (input and switch borders ≥ 3:1), `track`.
- Action: `accent` notebook blue (#2A62D8 / #7EAAFF), `on-accent`, `accent-soft`, `accent-hover`, `accent-press`,
  `focus`. **One solid accent button per screen.**
- States: `good warn again easy` and their `*-soft` fills (grade buttons, covers). Aliases: danger → again,
  info → easy.
- Covers: `cover-blue mint butter pink lilac aqua peri` (+ `cover-cobalt` for the loud /play hero), text on them
  `on-cover`/`on-cover2`; deeper `tone-*` shades for glyphs, sticker rims and checkbox rims.
- Rewards: `hanamaru` red pencil (#D3263C / #FF5C70). Only for the hanamaru, the red tick, よくできました and "New best!".
- Art: `usagi*`, `snow`, `lit`, `scene-night`, `paper-rule`, `ring-metal`, `shade`, `scrim`. Scene colours live inside
  the scene SVGs, not in tokens.

**Type**
- Zen Maru Gothic 500 / 700 / 900 for the UI (body 500, labels and buttons 700, titles and numbers 900).
- Klee One 600 for card kana, Japanese example lines, the teacher's note and よくできました: the textbook pencil hand
  Harshal writes in class.
- Scale (px): 12 · 14 · 16 · 18 · 22 · 28 · 40 · 72, as `--text-<name>` tokens. Body 16 on the phone, inputs 16,
  nothing under 12. Lines that carry furigana use `--leading-ja`.
- Every Japanese run sits in an element with `lang="ja"`. Furigana is `<ruby>漢字<rt>かんじ</rt></ruby>`, `rt` at
  `max(0.5em, 10px)`, through the shared `Ruby` component.
- Load both families from the one Google Fonts css2 link in `src/app/layout.tsx` (not `next/font/google`).

**Shape and space**
- Radii: chips 7 with one index-tab corner (`7 7 7 2`), buttons 14 (large 16), cards 22, sheets 28, stickers round.
- Shadows: `shadow` for cards, `shadow-raised` for sheets. No nested cards. One washi-tape strip per screen at most.
- Spacing steps 4 8 12 16 20 24 32 40; phone side padding 20, laptop 44.
- Targets ≥ 48px (44 is the floor). Focus ring `--ring` on everything you can tab to.
- Motion: `--ease`, `--ease-spring`, durations 120 / 200 / 320 ms, the hanamaru draws in 800 ms. Reduced motion
  shows the end state at once (the ring already drawn, windows already lit); nothing is hidden.

## 4. Illustrations (inline TSX in `src/components/ui/art/`)

- **Yuki-usagi 雪うさぎ**, the mascot: a snow-mound rabbit with red berry eyes and leaf ears, no arms or legs. Six
  poses, each with one job: sitting (default, headers), waving (sign-in, welcome back), lantern (empty states, end
  of a session), reading (Learn), cheering (session done, /play), sleepy (rest day, nothing due).
- **The farmhouse scene** tops the next-step card on Today. Six windows = the six tasks in the day's plan; one
  lights per finished task (ground floor left to right, then the middle pair, then the attic); at 6 of 6 the stone
  lantern lights too. Four seasons, evening only: winter (Dec–Feb: snow, moon, camellias), spring (Mar–May: sakura,
  dusk pinks), summer (Jun–Aug: teal night, fireflies, wind chime), autumn (Sep–Nov: persimmon dusk, maples, dango).
  Same house and rabbit in every season; UI tokens never change with the season.
- **Spots** (round): rabbit with lantern (empty, session end), tea by the round window (offline, grades waiting to
  save), at the door (sign-in), forked path (404), blank notebook (generic empty).
- **Rewards from the notebook:** the red-pencil hanamaru round "Done for today" + よくできました, round stickers on
  the 日–土 sheet (star, flower, leaf, hanamaru, usagi), the red tick.
- All art is `aria-hidden="true"` and themed through tokens; dark versions use the dark tokens, not a filter.
  Illustrations are components, not files in `public/` (the proxy redirects signed-out requests, and `<img>` can't
  read theme variables).

## 4a. The parts (`src/components/ui/`, one file each, JSDoc on every prop; see them all at `/design`)

| Need | Part | File |
|---|---|---|
| The one action, second choices, links that look like buttons | `Button` (`variant` primary · secondary · quiet · text · danger; `size` sm 44 · md 48 · lg 56; `icon`, `iconEnd`, `loading`, `full`, `href`) | `ui/button.tsx` |
| Close, flag, menu | `IconButton` (`icon`, `label`, `shape` plain · round · round-sm, `href`, `pressed`) | `ui/icon-button.tsx` |
| Icons | `Icon` (`name` from the kit set, `size`, `stroke`) | `ui/icon.tsx` |
| Cards | `Card` (`as`, `padding`), `HeroCard` (`art` band on top) | `ui/card.tsx` |
| Page and section headings | `PageHeader` (`title`, `sub`, `action`, `back`), `SectionTitle` (`meta`, `link`, `action`) | `ui/page-header.tsx` |
| Back link, tabs that are pages | `BackLink`, `LinkTabs` | `ui/back-link.tsx`, `ui/link-tabs.tsx` |
| Progress | `ProgressBar` (ticked; `value`, `max`, `label`, `size` md · strip), `TimerBar` (`startedAt`, `durationMs`, `running`) | `ui/progress.tsx` |
| Exclusive setting (2–4) | `Segmented` (real radios: `name`, `options`, `value`/`defaultValue`, `onChange`) | `ui/segmented.tsx` |
| Labels, filters | `Chip` (`cover`, `kind` cover · count · soon, `size`), `ChoiceChips` (one or `multiple`) | `ui/chip.tsx` |
| Rows | `List` + `ListRow` (`lead`: cover checkbox `{ check, state }`, icon tile `{ icon, cover, waiting }`; `title`, `chip`, `meta`, `trailing`, `href`/`onClick`) | `ui/list-row.tsx` |
| Numbers | `StatGrid` + `StatTile`, `StreakBadge` | `ui/stat.tsx`, `ui/streak-badge.tsx` |
| On/off | `Switch` | `ui/switch.tsx` |
| Inputs | `Field` (input · textarea · select; `label`, `hint`, `error`, `ja`), `AnswerInput` (`state` idle · right · wrong) | `ui/field.tsx` |
| Overlays and states | `Sheet` (`<dialog>`), `EmptyState` (`art`, `title`, `action`; compact without them), `Skeleton`/`SkeletonText`, `Banner` (offline · waiting · version · info), `useVersionPoll` | `ui/sheet.tsx`, `ui/empty-state.tsx`, `ui/skeleton.tsx`, `ui/banner.tsx`, `ui/use-version-poll.ts` |
| Sessions | `SessionHeader` (close, title, count, ticked bar; hides the bottom bar), `GradeButtons`, `DoneScreen` (`hanamaru` ring) | `ui/session-header.tsx`, `ui/grade-buttons.tsx`, `ui/done-screen.tsx` |
| Japanese | `Ruby` and `Mixed` (furigana), `SpeakButton` (round · round-sm · icon · pill) inside `VoiceProvider` (`useSpeak`) | `ui/ruby.tsx`, `ui/speak-button.tsx`, `ui/voice.tsx` |
| The week | `StickerSheet` (日–土, today's sticker dropping) | `ui/sticker-sheet.tsx` |
| Art | `Rabbit` (`pose`), `Scene` (`season`, `lit` 0–6), `Spot` (`kind`), `Hanamaru`, `Tick`, `Sticker`, `WashiTape` | `ui/art/rabbit.tsx`, `ui/art/scene.tsx`, `ui/art/spots.tsx`, `ui/art/rewards.tsx` |
| A page not built yet | `Stub` (`title`, `art`, `empty`) | `ui/stub.tsx` |

The shell (`src/components/shell/`): `nav.ts` (the IA), `phone-nav.tsx`, `phone-top-bar.tsx` ("+ Add a word" on the
hubs), `sidebar.tsx`, `logo.tsx`; the layout is `src/app/(app)/layout.tsx`. Tokens and the type scale are in
`src/app/globals.css` (`text-caption · meta · body · lead · title · headline · display · kana`, `leading-ja`,
`rounded-chip · box · seg · pill · btn · track · btn-lg · grade · card · sheet`, `shadow-card · raised · btn · seg ·
grade · sticker · field`, `z-nav · chip · session · sheet · banner`, `pb-nav`, `bottom-nav`).

## 5. Navigation and layout

- Phone: bottom bar **Today · Review · Learn · Practice · More** (stroke icons; the current tab is a 56×32
  `accent-soft` pill behind the icon with a bold `accent` label). Sessions (review, quiz, quick check, a lesson
  reader, a game in play) show `SessionHeader` (close, title, count, ticked progress bar), which hides the bar by
  itself (it marks the page `data-session`).
- "+ Add a word" appears once: top-right on phone hubs, at the end of the laptop sidebar.
- Laptop (≥ 1024px): sidebar with the same five, then a quieter group (Progress, Decks, Log, Resources, Work
  Japanese, Settings), then "+ Add a word". Today and the grammar lesson have laptop boards; other pages are the
  phone layout centred unless a board shows otherwise.
- Settings → Theme is a segmented control: System / Light / Dark. Stored per device; the head script sets
  `data-theme` before paint and ignores the old look keys.
- Section headings: one style (`SectionTitle`), no kicker labels above them.

## 6. /play

Same tokens, fonts and parts, louder: cover-colour game tiles with big glyphs, the cobalt quick-play hero, the
rabbit cheering. Each game keeps its own colour (`--g-*` via `hueStyle()`). Big panels a player looks at for long
sit on `surface`; the game colour stays in small parts. Real modes and scoring stay: Read it / Find it, the
0–100 score, weekly and all-time boards, guest name + 4-digit PIN sheet. Keys: Enter, Esc, Space.

## 7. States every screen needs

Empty, loading (skeletons), offline, "grades waiting to save", "new version, reload", and 404 are drawn on
`RF_States`; done-for-today on `RF_TodayDone`; session end on `RF_ReviewDone` / `RF_QuizResults` / `RF_PlayDone`. Use
those, don't invent new ones. Words stay calm and plain, with no guilt about missed days and no "round N" text.

## 8. Before you hand over

- [ ] Phone (390 wide, and 375×667 for the review card + 4 grade buttons) and laptop (1280×800) match the boards.
- [ ] Light and dark both checked.
- [ ] Keyboard: focus visible; review Space / 1–4 / U, quiz 1–4, kana Enter / Esc / Space still work.
- [ ] Targets ≥ 44px, text ≥ 12px, `rt` ≥ 10px, contrast ≥ 4.5:1, `lang="ja"` on Japanese.
- [ ] Reduced motion: nothing moves that shouldn't, nothing is hidden.
- [ ] `pnpm check` passes (includes design-lint and the theme contrast test). Say what you didn't check.
