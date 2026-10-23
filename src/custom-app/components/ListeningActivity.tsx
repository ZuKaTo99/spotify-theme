// =============================================================================
// Datei: src/custom-app/components/ListeningActivity.tsx
// Zweck: Wiederverwendbare, zugängliche 7-Tage-Anzeige für Dashboard und Statistik.
// Kein Chart-Paket, kein Canvas und keine zusätzlichen Player-Timer nötig.
// =============================================================================
import type { ReactElement } from "react";
import type { ActivityDay } from "../../shared/listening-insights";
import type { Translator } from "../../shared/i18n";

export function ListeningActivity({ daily, t }: {
  daily: readonly ActivityDay[];
  t: Translator;
}): ReactElement {
  const maximum = Math.max(1, ...daily.map((day) => day.count));
  const format = new Intl.DateTimeFormat(t("stats.dateLocale"), { weekday: "short", day: "numeric" });
  return <div className="zukato-activity" role="group" aria-label={t("stats.activity7")}>
    {daily.map((day) => {
      const label = format.format(new Date(day.start));
      return <div className="zukato-activity__day" key={day.start}
        aria-label={`${label}: ${day.count} ${t("stats.changes")}`}>
        <strong>{day.count}</strong>
        <div className="zukato-activity__track" aria-hidden="true">
          <div style={{ height: `${day.count > 0 ? Math.max(8, day.count / maximum * 100) : 0}%` }} />
        </div>
        <small>{label}</small>
      </div>;
    })}
  </div>;
}
