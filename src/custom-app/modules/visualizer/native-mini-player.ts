/** Verbindet Spotifys Mini-Player-Knopf mit dem ZuKaTo-Player, solange die Bühne gemountet ist. */
export function spotifyMiniPlayerButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest("button");
  if (!(button instanceof HTMLButtonElement) || button.closest(".zukato-app")) return null;
  const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
  return /mini[ -]?player/i.test(label) && /(?:öffnen|open)/i.test(label) ? button : null;
}
