"use client";
// design-lint: legacy

import { useEffect, useState, useTransition } from "react";

import { saveVoice } from "@/app/(app)/settings/voice/actions";
import { canSpeak, loadVoices, speak } from "@/lib/voice/speak";
import { japaneseVoices, pickVoice, type VoicePrefs } from "@/lib/voice/voices";

const SAMPLE = "まいにち、にほんごを べんきょうします。";
const SPEAKER = "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6";
const SECTION = "flex flex-col gap-2.5 rounded-card bg-surface px-3.5 pt-2.5 pb-3.5 shadow-card";
const HEADING = "m-0 text-xs font-bold tracking-[0.04em] text-ink2 uppercase";

type Voice = { name: string; lang: string; localService: boolean };

/** Pick a Japanese voice and its speed, hear it, and save it for every card (F_Settings, "Voice"). */
export function VoiceSettings({ saved }: { saved: VoicePrefs }) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [name, setName] = useState<string | null>(saved.name);
  const [rate, setRate] = useState(saved.rate);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    void loadVoices(3000).then((all) => {
      if (!live) return;
      const ja = japaneseVoices(all).map((v) => ({ name: v.name, lang: v.lang, localService: v.localService }));
      setVoices(ja);
    });
    return () => {
      live = false;
    };
  }, []);

  const picked = voices ? pickVoice(voices, name) : null;
  const supported = typeof window === "undefined" || canSpeak();

  return (
    <>
      <section className={SECTION}>
        <h2 className={HEADING}>Voice on this device</h2>
        {!supported ? (
          <p className="m-0 text-sm">This browser can&apos;t speak. Chrome on Android and on the Mac can.</p>
        ) : voices === null ? (
          <div aria-label="Loading" className="flex flex-col gap-2 py-1">
            <span className="h-3 w-[55%] rounded-full bg-surface2" />
            <span className="h-2.5 w-[85%] rounded-full bg-surface2" />
          </div>
        ) : voices.length === 0 ? (
          <p className="m-0 text-sm">
            No Japanese voice on this device yet. Install one (below), then reload this page.
          </p>
        ) : (
          <div role="radiogroup" aria-label="Japanese voice" className="flex flex-col">
            {voices.map((v, i) => (
              <label key={v.name} className={`flex min-h-11 cursor-pointer items-center gap-2.5 ${i ? "border-t border-line" : ""}`}>
                <input
                  type="radio"
                  name="voice"
                  checked={picked?.name === v.name}
                  onChange={() => setName(v.name)}
                  className="size-5 accent-[var(--accent)]"
                />
                <span className="flex min-w-0 flex-auto flex-col">
                  <span lang="ja" className="text-sm font-semibold">
                    {v.name}
                  </span>
                  <span className="text-xs text-ink2">{v.localService ? "on this device" : "online"}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {saved.name && voices && voices.length > 0 && !voices.some((v) => v.name === saved.name) && (
          <p className="m-0 text-[12.5px] text-ink2">
            The voice you saved (<span lang="ja">{saved.name}</span>) isn&apos;t on this device, so it uses the one picked
            above.
          </p>
        )}
      </section>

      <section className={SECTION}>
        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between">
            <span className={HEADING}>Speed</span>
            <span className="text-sm font-semibold">{rate.toFixed(1)}×</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="min-h-11 w-full accent-[var(--accent)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!picked}
            onClick={() => void speak(SAMPLE, { name: picked?.name ?? null, rate })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-btn border border-line bg-surface2 px-3.5 text-[13px] font-semibold disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={SPEAKER} />
            </svg>
            Test
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await saveVoice({ name: picked?.name ?? name, rate });
                setMessage("error" in result ? result.error : "Saved. Every card uses it now.");
              })
            }
            className="min-h-11 rounded-btn bg-accent px-[18px] text-sm font-bold text-on-accent disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {message && (
            <p role="status" className="m-0 text-[13px] text-ink2">
              {message}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
