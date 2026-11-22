import { describe, expect, it } from "vitest";

import { japaneseVoices, pickVoice, type VoiceInfo } from "./voices";

const voices: VoiceInfo[] = [
  { name: "Samantha", lang: "en-US", localService: true },
  { name: "Kyoko", lang: "ja-JP", localService: true },
  { name: "Google 日本語", lang: "ja-JP", localService: false },
  { name: "Japanese Japan", lang: "ja_JP", localService: true },
];

describe("voices", () => {
  it("lists Japanese voices, Google's first", () => {
    expect(japaneseVoices(voices).map((v) => v.name)).toEqual(["Google 日本語", "Japanese Japan", "Kyoko"]);
  });

  it("uses the voice picked in Settings when this device has it", () => {
    expect(pickVoice(voices, "Kyoko")?.name).toBe("Kyoko");
    expect(pickVoice(voices, "A voice from the other device")?.name).toBe("Google 日本語");
    expect(pickVoice(voices.slice(0, 1), null)).toBeNull();
  });
});
