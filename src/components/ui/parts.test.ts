import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Rabbit } from "./art/rabbit";
import { Hanamaru, Sticker } from "./art/rewards";
import { Scene } from "./art/scene";
import { Spot } from "./art/spots";
import { Banner } from "./banner";
import { Button } from "./button";
import { Chip } from "./chip";
import { EmptyState } from "./empty-state";
import { AnswerInput, Field } from "./field";
import { GradeButtons } from "./grade-buttons";
import { IconButton } from "./icon-button";
import { ListRow } from "./list-row";
import { PageHeader } from "./page-header";
import { ProgressBar } from "./progress";
import { Segmented } from "./segmented";
import { Sheet } from "./sheet";
import { Switch } from "./switch";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("ui parts", () => {
  it("Button passes native props through, and links when given href", () => {
    const b = html(h(Button, { name: "intent", value: "save", type: "submit", "data-hook": "x", disabled: true, children: "Save" } as never));
    expect(b).toMatch(/^<button /);
    expect(b).toContain('type="submit"');
    expect(b).toContain('name="intent"');
    expect(b).toContain('value="save"');
    expect(b).toContain('data-hook="x"');
    expect(b).toContain("disabled");
    expect(b).toContain("bg-accent");
    const a = html(h(Button, { href: "/review", variant: "secondary", children: "Go" }));
    expect(a).toMatch(/^<a [^>]*href="\/review"/);
    expect(html(h(Button, { loading: true, children: "Wait" }))).toContain('aria-busy="true"');
  });

  it("IconButton always has a name", () => {
    expect(html(h(IconButton, { icon: "flag", label: "Flag this card" }))).toContain('aria-label="Flag this card"');
  });

  it("Field renders a labelled <input name>, its error, and passes props through", () => {
    const f = html(h(Field, { label: "Meaning", name: "meaning", defaultValue: "warm", required: true, error: "Type a meaning" }));
    expect(f).toMatch(/<label for="([^"]+)"[^>]*>Meaning<\/label><input[^>]*id="\1"/);
    expect(f).toContain('name="meaning"');
    expect(f).toContain('value="warm"');
    expect(f).toContain("required");
    expect(f).toContain('aria-invalid="true"');
    expect(f).toContain("Type a meaning");
    expect(html(h(Field, { label: "Word", name: "term", ja: true }))).toContain('lang="ja"');
    expect(html(h(Field, { as: "textarea", label: "Note", name: "note" }))).toContain('<textarea name="note"');
    expect(html(h(AnswerInput, { "aria-label": "Answer", name: "answer", state: "wrong" }))).toContain('aria-invalid="true"');
  });

  it("Segmented renders real radios in a radiogroup", () => {
    const s = html(
      h(Segmented, {
        label: "Theme",
        name: "theme",
        defaultValue: "dark",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ],
      }),
    );
    expect(s).toContain('role="radiogroup"');
    expect(s.match(/<input [^>]*type="radio"[^>]*name="theme"/g)).toHaveLength(3);
    expect(s).toMatch(/<input [^>]*checked=""[^>]*value="dark"/);
  });

  it("Sheet renders a <dialog>", () => {
    const s = html(h(Sheet, { open: false, onClose: () => {}, title: "Add a word" }));
    expect(s).toMatch(/^<dialog /);
  });

  it("Switch is a checkbox with role=switch", () => {
    const s = html(h(Switch, { label: "Speech recognition", name: "speech", defaultChecked: true }));
    expect(s).toContain('type="checkbox"');
    expect(s).toContain('role="switch"');
    expect(s).toContain('name="speech"');
  });

  it("ProgressBar reports its value", () => {
    const p = html(h(ProgressBar, { value: 7, max: 18, label: "Card 7 of 18" }));
    expect(p).toContain('aria-valuenow="7"');
    expect(p).toContain('aria-valuemax="18"');
    expect(p.match(/<path /g)).toHaveLength(17);
  });

  it("ListRow links, or stays quiet when locked", () => {
    expect(html(h(ListRow, { href: "/quiz", title: "Daily quiz", lead: { check: "mint" } }))).toMatch(/<li[^>]*><a [^>]*href="\/quiz"/);
    expect(html(h(ListRow, { href: "/work", title: "Work", lead: { check: "blue", state: "locked" } }))).not.toContain("href");
  });

  it("GradeButtons give the keys and call back", () => {
    const g = html(h(GradeButtons, { intervals: ["1 min", "8 min", "3 days", "9 days"], onGrade: () => {} }));
    expect(g.match(/aria-keyshortcuts="\d"/g)).toEqual(['aria-keyshortcuts="1"', 'aria-keyshortcuts="2"', 'aria-keyshortcuts="3"', 'aria-keyshortcuts="4"']);
  });

  it("headings, chips, banners and empty states render their words", () => {
    expect(html(h(PageHeader, { title: "More", sub: "Thursday 3 December" }))).toContain("<h1");
    expect(html(h(Chip, { cover: "butter", children: "must-do" }))).toContain("bg-cover-butter");
    expect(html(h(Banner, { kind: "offline", title: "You’re offline" }))).toContain('role="status"');
    expect(html(h(EmptyState, { title: "Nothing here" }, "Calm words."))).toContain("<h2");
  });

  it("art is decoration and themed by tokens", () => {
    for (const el of [h(Rabbit, { pose: "waving" }), h(Spot, { kind: "path" }), h(Sticker, { kind: "star-butter" }), h(Hanamaru, {})]) {
      expect(html(el)).toMatch(/^<svg aria-hidden="true"/);
    }
    expect(html(h(Rabbit, {}))).toContain("var(--usagi)");
    const lit = html(h(Scene, { season: "winter", lit: 6 }));
    expect(lit).toContain('data-lit="6"');
    expect(lit).toContain("light-dark(");
    expect(html(h(Scene, { season: "summer", lit: 99 }))).toContain('data-lit="6"');
  });
});
