import type { ReactElement } from "react";
import type { ActivityDay } from "../../shared/listening-insights";
import type { Translator } from "../../shared/i18n";

interface Point { x: number; y: number; count: number }

/** Formt echte Tageswerte zu einer ruhigen Hörlandschaft; Null bleibt auf der Grundlinie. */
export function listeningLandscapeGeometry(daily: readonly ActivityDay[]): {
  line: string; area: string; points: Point[];
} {
  const counts = daily.slice(0, 7).map((day) =>
    Number.isFinite(day.count) ? Math.max(0, day.count) : 0);
  const maximum = Math.max(1, ...counts);
  const points = counts.map((count, index) => ({
    x: Math.round(28 + index * 644 / Math.max(1, counts.length - 1)),
    y: Math.round(174 - count / maximum * 112),
    count,
  }));
  if (!points.length) return { line: "", area: "", points };
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const handle = Math.round((current.x - previous.x) * .42);
    line += ` C ${previous.x + handle} ${previous.y}, ${current.x - handle} ${current.y}, ${current.x} ${current.y}`;
  }
  return {
    line,
    area: `${line} L ${points.at(-1)!.x} 188 L ${points[0].x} 188 Z`,
    points,
  };
}

export function ListeningLandscape({ daily, t }: {
  daily: readonly ActivityDay[];
  t: Translator;
}): ReactElement {
  const geometry = listeningLandscapeGeometry(daily);
  const format = new Intl.DateTimeFormat(t("stats.dateLocale"), { weekday: "short" });
  return <div className="zukato-landscape" role="group" aria-label={t("stats.activity7")}>
    <svg viewBox="0 0 700 200" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="zukato-landscape-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fa526d" stopOpacity=".48" />
          <stop offset="55%" stopColor="#744ddf" stopOpacity=".23" />
          <stop offset="100%" stopColor="#293e72" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="zukato-landscape-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#80beff" />
          <stop offset="55%" stopColor="#ad8bff" />
          <stop offset="100%" stopColor="#ff5c79" />
        </linearGradient>
      </defs>
      <path d={geometry.area} fill="url(#zukato-landscape-fill)" />
      <path d={geometry.line} className="zukato-landscape__line" />
      {geometry.points.filter((point) => point.count > 0).map((point, index) =>
        <circle key={index} className="zukato-landscape__point" cx={point.x} cy={point.y} r="5" />)}
    </svg>
    <div className="zukato-landscape__days">
      {daily.slice(0, 7).map((day) => <div key={day.start}
        aria-label={`${format.format(new Date(day.start))}: ${day.count} ${t("stats.changes")}`}>
        <strong>{day.count}</strong><span>{format.format(new Date(day.start))}</span>
      </div>)}
    </div>
  </div>;
}
