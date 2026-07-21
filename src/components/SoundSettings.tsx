"use client";

import type { SoundPreference } from "@/lib/sound-effects";

export function SoundSettings({
  value,
  onChange,
}: {
  value: SoundPreference;
  onChange: (value: SoundPreference) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">효과음</legend>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>효과음 사용</span>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
      </label>
      <label className="block text-sm">
        <span className="flex justify-between gap-4">
          <span>효과음 볼륨</span>
          <output>{value.masterVolume}%</output>
        </span>
        <input
          className="w-full"
          type="range"
          min="0"
          max="100"
          step="1"
          value={value.masterVolume}
          disabled={!value.enabled}
          aria-label="효과음 볼륨"
          onChange={(event) =>
            onChange({ ...value, masterVolume: Number(event.target.value) })
          }
        />
      </label>
    </fieldset>
  );
}
