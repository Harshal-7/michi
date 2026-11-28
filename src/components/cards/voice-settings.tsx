"use client";

import { useEffect, useState, useTransition } from "react";

import { saveVoice } from "@/app/(app)/settings/voice/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/page-header";
import { SkeletonText } from "@/components/ui/skeleton";
import { canSpeak, loadVoices, speak } from "@/lib/voice/speak";
import { japaneseVoices, pickVoice, type VoicePrefs } from "@/lib/voice/voices";

const SAMPLE = "まいにち、にほんごを べんきょうします。";

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
      <Card aria-labelledby="voice-device" className="flex flex-col gap-2">
        <SectionTitle id="voice-device">Voice on this device</SectionTitle>
        {!supported ? (
          <p className="m-0 text-body">This browser can&apos;t speak. Chrome on Android and on the Mac can.</p>
        ) : voices === null ? (
          <SkeletonText lines={2} label="Looking for voices" className="py-1" />
        ) : voices.length === 0 ? (
          <p className="m-0 text-body">
            No Japanese voice on this device yet. Install one (below), then reload this page.
          </p>
        ) : (
          <div role="radiogroup" aria-label="Japanese voice" className="flex flex-col">
            {voices.map((v, i) => (
              <label key={v.name} className={`flex min-h-14 cursor-pointer items-center gap-3 ${i ? "border-t-[1.5px] border-line" : ""}`}>
                <input
                  type="radio"
                  name="voice"
                  checked={picked?.name === v.name}
                  onChange={() => setName(v.name)}
                  className="size-5 shrink-0 accent-accent"
                />
                <span className="flex min-w-0 flex-auto flex-col">
                  <span lang="ja" className="text-body font-bold">
                    {v.name}
                  </span>
                  <span className="text-meta text-ink2">{v.localService ? "on this device" : "online"}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {saved.name && voices && voices.length > 0 && !voices.some((v) => v.name === saved.name) && (
          <p className="m-0 text-meta text-ink2">
            The voice you saved (<span lang="ja">{saved.name}</span>) isn&apos;t on this device, so it uses the one picked
            above.
          </p>
        )}
      </Card>

      <Card aria-label="Speed" className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex min-h-11 items-center justify-between">
            <span className="text-title font-bold">Speed</span>
            <span className="text-body font-bold">{rate.toFixed(1)}×</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="min-h-11 w-full accent-accent"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon="speaker" disabled={!picked} onClick={() => void speak(SAMPLE, { name: picked?.name ?? null, rate })}>
            Test
          </Button>
          <Button
            disabled={pending}
            loading={pending}
            onClick={() =>
              start(async () => {
                const result = await saveVoice({ name: picked?.name ?? name, rate });
                setMessage("error" in result ? result.error : "Saved. Every card uses it now.");
              })
            }
          >
            Save
          </Button>
          {message && (
            <p role="status" className="m-0 text-meta text-ink2">
              {message}
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
