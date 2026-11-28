"use client";

import { setThemeChoice, useThemeChoice } from "@/components/theme-sync";
import { Segmented } from "@/components/ui/segmented";
import type { ThemeChoice as Choice } from "@/lib/theme";

/**
 * Settings → Theme (RF_Settings): System / Light / Dark for this device. It changes the page at once and
 * is kept on the device; the choice is also saved with the settings (the last one picked anywhere).
 * Shows the device's real choice, not the saved one.
 */
export function ThemeChoice({ saved, pending, onSave }: { saved: Choice; pending: boolean; onSave: (theme: Choice) => void }) {
  const choice = useThemeChoice(saved);
  return (
    <div className="flex flex-col gap-2 pt-1 pb-3">
      <p id="theme-label" className="m-0 text-meta font-bold">
        Theme
      </p>
      <Segmented
        label="Theme"
        name="theme"
        value={choice}
        disabled={pending}
        onChange={(v) => {
          setThemeChoice(v);
          onSave(v);
        }}
        options={[
          { value: "system", label: "System", icon: "monitor" },
          { value: "light", label: "Light", icon: "sun" },
          { value: "dark", label: "Dark", icon: "moon" },
        ]}
      />
    </div>
  );
}
