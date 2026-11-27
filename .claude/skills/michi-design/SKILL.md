---
name: michi-design
description: Michi's design rules (the approved mix "Colours Washi · Fonts 2 Print · Cards Soft · Nav Pill", light and dark). Read this before any UI work in this repo, including a new screen, a new part, a restyle or a layout change, so the result matches the approved canvas instead of inventing a new look.
---

# Designing in Michi

Harshal designs the look on a canvas first and approves it. Build what the canvas shows, from the parts
that already exist. Don't invent new visual styles, and don't iterate on looks in code.

## 1. Where the design lives

- **The canvas** (source of truth): https://claude.ai/artifact/AKqg3xuo9DhzzdtdBK3ZMY, page
  **Final · your mix**. Read a board's source with the Artifact tool (`read`, `path`:
  `project/<Board>.dc.html`). A copy of every board is also on Harshal's machine in
  `~/Developer/docs/learning/japanese/michi-canvas/` (outside this repo).
- **The approved plan** says what each screen does: `~/Developer/docs/learning/japanese/michi-plan.md`
  (outside this repo).
- Boards on the Final page, by row:
  1. Daily loop: `F_SignIn`, `F_Today`, `F_TodayDone`, `F_AddWord`, `F_QuickCheckKana`,
     `F_QuickCheckWords`, `F_ReviewFront`, `F_ReviewBack`, `F_ReviewDone`.
  2. Practice: `F_Practice`, `F_QuizQuestion`, `F_Quiz` (results), `F_MockTest`, `F_MockResults`,
     `F_Speaking`, `F_Shadowing`.
  3. Grammar and logs: `F_Grammar`, `F_GrammarPoint`, `F_Log`, `F_ClassLog`, `F_Immersion`, `F_Import`.
  4. More: `F_More`, `F_Work`, `F_WorkIntro`, `F_Resources`, `F_Progress`, `F_Decks`, `F_Settings`.
  5. Laptop: `F_TodayWeb`, `F_ReviewWeb`, `F_GrammarWeb`, `F_ProgressWeb`.
  6. Dark: `F_DarkToday`, `F_DarkReviewBack`, `F_DarkPractice`, `F_DarkGrammar`, `F_DarkClassLog`,
     `F_DarkTodayWeb`. Every board also has a light/dark `theme` prop.
  7. Parts and states: `F_Parts` (buttons, chips, inputs, rating buttons, task rows, progress bars, and
     the empty, loading, "grades waiting to save", no-signal and "new version, reload" states), `F_Nav`,
     `F_PhoneTop` (the phone's top bar, approved 22 Nov 2026).
- How the boards are built: most `F_` boards style themselves inline with the tokens in
  `project/michi.css`. `F_Today`, `F_ReviewFront`/`Back`, `F_Quiz`, `F_ClassLog` and `F_TodayWeb` are
  wrappers that pass `colors="washi" fonts="2" cards="soft" nav="pill"` to the engine boards
  (`Today`, `Review`, `Quiz`, `ClassLog`, `TodayWeb`); read the engine with those values. Ignore the
  "Three looks" and "Mix and match" pages: they were the options, not the decision.

## 2. How to work

1. **Find the closest board** and build from the same parts, sizes and spacing.
2. **If a screen or element has no design** (a new kind of screen, a new visual piece, a new layout),
   don't improvise it in code. Draw it on the canvas next to the related boards, using the same tokens
   and parts, tell Harshal, and build it once it's approved. Small variations of an existing pattern
   (another settings row, another chip) don't need this.
3. **Use only tokens.** No hex colours outside the token blocks in `src/app/globals.css`, no new font
   sizes, radii or shadows when an existing one fits, no one-off button styles.
4. **Check before handing over** (section 6), and say what you couldn't check.

## 3. The system

**Type**
- Zen Kaku Gothic New (400, 500, 700) for everything you read and for headings (700).
- Zen Old Mincho (600) for the big Japanese on card faces and the term on a word or kanji page.
- Load both from the Google Fonts stylesheet in `src/app/layout.tsx` (`display=swap`), exposed as
  `--font-ui`, `--font-head`, `--font-card`. Not `next/font/google`: it downloads all ~600 Japanese
  unicode-range files at every dev start and build, and the dev server times out on them.
- Every Japanese string sits in an element with `lang="ja"`, so kanji take Japanese shapes, not Chinese.
- Furigana uses `<ruby>` with `<rt>` at 0.4em in `--ink2`. Content stores it as ruby markup
  (`{食|た}べる`, see `content/schema.ts`); render it with one shared component.

**Colour: themes.** Since 28 Nov 2026 each device picks a light theme and a dark theme (Settings → Theme).
The theme boards (`T_Today` and `T_TodayWeb`, with a `look` prop) are kept locally in
`~/Developer/docs/learning/japanese/michi-canvas/themes-page-unpublished/`, not on the canvas. Every theme fills the same
tokens in `src/app/globals.css`: the default light theme (Kumo) on `:root`, the others on
`[data-look="…"]`; the default dark theme (Kuro) on `[data-theme="dark"]`, the others on
`[data-theme="dark"][data-look="…"]`. Harshal's brief: whites and darks that differ in shade and in how
cards sit on the page, not tinted pages. So every theme shares one accent and one set of rating colours;
only the neutrals and `--card-shadow` change. A new theme needs Harshal's OK on the canvas first, then a
block in `globals.css` that fills every colour token, its `--page` in `PAGE_COLOR` and its name in
`LOOKS` (`src/lib/theme.ts`); `theme.test.ts` checks the tokens and 4.5:1 contrast for each.

| Theme | `--page` | `--surface` | `--surface2` | `--ink` / `--ink2` | `--line` | `--track` | Cards (`--card-shadow`) |
|---|---|---|---|---|---|---|---|
| **Kumo** 雲 (light default) | #F2F2F1 | #FFFFFF | #ECECEB | #1A1A1A / #595959 | #E2E2E0 | #E8E8E6 | soft shadow |
| Shiro 白 | #FFFFFF | #FFFFFF | #F4F4F3 | #1A1A1A / #5C5C5C | #E5E5E3 | #ECECEA | fine line (`0 0 0 1px var(--line)`) |
| Kinu 絹 | #FFFFFF | #F5F5F4 | #E9E9E7 | #1A1A1A / #575757 | #E0E0DE | #E1E1DF | flat (`none`) |
| Washi 和紙 (the first look) | #FAF8F3 | #FEFDFA | #F2EEE6 | #1D1A16 / #5B544A | #E3DCCF | #EBE5DA | soft shadow |
| **Kuro** 黒 (dark default) | #000000 | #121212 | #1F1F1F | #ECECEC / #A3A3A3 | #2C2C2C | #2A2A2A | fine line |
| Sumi 墨 | #1A1918 | #252422 | #302E2C | #EEEBE6 / #ACA79F | #3B3936 | #373532 | soft shadow |
| Graphite (the first dark) | #121212 | #1E1E1E | #2C2C2C | #E0E0E0 / #A0A0A0 | #383838 | #333333 | soft shadow |

Shared by every light theme (dark in brackets):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | #B03A22 | #E88A73 | the one solid button, current nav item, links that act |
| `--on-accent` | #FFF8F0 | #1A0D08 | text on accent |
| `--accent-soft` | #F8E4DE (Kinu #F5E0D9, Washi #F2DCD3) | #33221E (Sumi #3D2A24, Graphite #342522) | current nav pill, picked chips |
| `--good` | #2F6B45 | #8FCB9B | done, on track, Good |
| `--warn` | #7D5C00 | #E0B565 | 1–3 days behind, waiting to save |
| `--again` | #A3242B | #F28B82 | Again, missed |
| `--easy` | #2F5C8A | #8AB4F8 | Easy |
| `--glow` | rgba(176,58,34,.16) | rgba(232,138,115,.16) | nav shadow |
| `--shadow` | rgba(0,0,0,.06) (Shiro, Kinu .05; Washi rgba(40,30,20,.08)) | rgba(0,0,0,.6) (Sumi .45, Graphite .5) | card shadow |

Contrast (checked by `theme.test.ts`): text, accent and rating colours are at least 4.5:1 on `--page`,
`--surface` and `--surface2` in every theme. The lowest is the accent on `--accent-soft` in Washi, 4.6:1.
`--again` and `--warn` (light) moved from #A8361F and #8A560A on 28 Nov so they are easier to tell apart.
The dark themes follow Material's dark theme (https://m2.material.io/design/color/dark-theme.html): raised
surfaces lighter than the page, off-white text, desaturated accents. Use the values here, not the
"Final · your mix" boards, which still show the first Washi colours.

Rating buttons: Again `--again`, Hard `--ink`, Good `--good`, Easy `--easy`, each with its next interval.

**Shape**
- Cards: `--radius` 18px, no border, `--card-shadow` (set by the theme: a soft shadow, a fine line or none).
- The one "next up" card on a screen gets `--hero-shadow` (a 2px accent ring plus the soft shadow).
- Buttons and chips are pills (`--btn-radius` 999px). One solid accent button per screen; the rest are
  quiet (surface or text buttons).
- Targets at least 44px tall. Focus ring visible on everything you can tab to.

**Navigation**
- Phone: the floating pill bar from `F_Nav` (Today · Review · Practice · Grammar · Log; 22px stroke icons
  at 1.6; the current item gets `--accent-soft` with `--accent` text). Progress, Work Japanese,
  Resources, Decks and Settings live on the More page (`F_More`).
- Phone top bar (`F_PhoneTop`, `src/components/shell/phone-top-bar.tsx`) on every phone page: "Michi 道"
  on the left; on the right a quiet "+ Add a word" pill (to the quick add, `F_AddWord`) and a round More
  button, which turns `--accent-soft` on the More page. Pages start 12px below it.
- Laptop (from 1024px wide): a 228px sidebar with everything, ending in "+ Add a word". Today, Review,
  Grammar and Progress have their own laptop boards; other screens are the sidebar plus the phone
  layout centred, at most 720px wide, unless they opt into the wide column (below).
- Wide column (Harshal, 22 Nov 2026: long single columns meant too much scrolling on a laptop). A page
  that puts `data-wide` on its top element gets up to 1136px and lays out its own columns, from
  `laptop:` (1024px) where they fit, otherwise from `wide:` (1280px, `--breakpoint-wide`). Below that it
  stays the phone layout at 720px. The patterns:
  - **Side panel that stays in view**: the thing you pick (a kana's detail, a deck's pace) in a
    sticky right or left column, the long list beside it (Kana from `laptop:`, deck page from `wide:`).
  - **Two columns of cards**: Settings (dates and study left; voice, look and data right), Japanese
    voice (the list and speed left, the install help right), both from `wide:`.
  - **Flowing reference cards**: Verb forms puts its guides in two CSS columns (`columns-2`) from
    `wide:`, with the full table across the bottom.
  - **Two-column rows inside one card**: Decks (from `laptop:`), a deck's cards (from `wide:`).
  - **List and detail** (Grammar): the list column is sticky and scrolls on its own; the lesson reads
    down the page beside it, at most 760px, with roomier cards and examples split by lines.
  - Stay at 720px on purpose: focus screens (Quick check, a review session) keep one centred column so
    the eye stays on the card; hubs that already fit on a screen (Learn) and placeholder pages
    (Log, Practice, Resources, Add a word, Work) get their wide layout when their round builds them.
- Picking one of a few options (Settings → Theme, Furigana): a segmented control, equal segments in a
  `--surface2` track with the chosen one on `--surface` with the card shadow, like the level tabs.

**Theme**: system, light or dark, plus a light theme and a dark theme, set by a script in `<head>` before
the page paints (the same way the games app does it), stored per device (`localStorage`: `michi:theme`,
`michi:light-look`, `michi:dark-look`). The script puts `data-theme` and `data-look` on `<html>`.

Dark mode is on (`DARK_MODE` in `src/lib/theme.ts`), picked per device in Settings → Theme. Check new
screens in light and dark, and in a lined theme (Shiro or Kuro) and the flat one (Kinu), since cards
there have no shadow.

**Words**
- Calm, plain and short. Say what happens ("Start", "Review the 10 mistakes").
- No guilt about missed days and no hype. Numbers must agree with each other across a screen.
- Mock scores are a "rough pass guide", never a promise of passing.

## 4. States every screen needs

Empty, loading, done for today, "grades waiting to save", no signal and "new version, reload" are drawn
on `F_Parts` and `F_TodayDone`. Use those, don't invent new ones.

## 5. Don'ts

- Don't add colours, fonts, shadows, radii or button styles outside the token blocks.
- Don't put Japanese text in an element without `lang="ja"`.
- Don't iterate on a look in code to see what Harshal thinks. Draw it on the canvas.
- Don't use `:has()` on `html` or `body`.

## 6. Before you hand over

- [ ] Phone width (390px) and a laptop (1280×800) both match their boards.
- [ ] Light and dark, in a soft theme (Kumo), a lined one (Shiro or Kuro) and the flat one (Kinu).
- [ ] Keyboard focus visible, targets at least 44px, text contrast at least 4.5:1.
- [ ] Reduced motion: nothing moves that shouldn't, and nothing is hidden.
- [ ] One solid accent button per screen; no hard-coded colours; `lang="ja"` on Japanese.
- [ ] `pnpm check` passes. Say which device or screen size you didn't check.
