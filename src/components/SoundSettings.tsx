"use client";

import type { SoundPreference } from "@/lib/sound-effects";
import { useI18n } from "@/i18n/I18nProvider";

export function SoundSettings({
  value,
  onChange,
}: {
  value: SoundPreference;
  onChange: (value: SoundPreference) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{t("settings.sound.label")}</legend>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>{t("settings.sound.enabled")}</span>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
      </label>
      <label className="block text-sm">
        <span className="flex justify-between gap-4">
          <span>{t("settings.sound.volume")}</span>
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
          aria-label={t("settings.sound.volume")}
          onChange={(event) =>
            onChange({ ...value, masterVolume: Number(event.target.value) })
          }
        />
      </label>
    </fieldset>
  );
}
