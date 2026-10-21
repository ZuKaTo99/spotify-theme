// =============================================================================
// Datei: src/custom-app/modules/settings/FeatureManager.tsx
// Zweck: Verwaltet Aktivierung, Anzeigenamen und Sortierung aller registrierten Features.
// =============================================================================
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import { parseFeatureOrderDraft } from "../../../shared/feature-order";
import { loadSettings } from "../../../shared/settings";

// Verwendet die Spotify-eigene React-Laufzeit für kontrollierte Entwurfsfelder.
const ReactRuntime = Spicetify.React as typeof import("react");

import {
  getDefaultFeatureTitle,
  getFeatureTitle,
} from "../../../shared/feature-titles";

import {
  getFeaturesBySurface,
} from "../../../shared/features";

import type {
  FeatureDefinition,
  FeatureId,
  FeatureSurface,
} from "../../../shared/features";

import type {
  FeaturePreferences,
} from "../../../shared/feature-preferences";

import type {
  Translator,
} from "../../../shared/i18n";

import type {
  SettingsChanges,
} from "../../hooks/useSettings";

// -----------------------------------------------------------------------------
// Datenvertrag `FeatureManagerProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface FeatureManagerProps {
  features: FeaturePreferences;
  t: Translator;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

// -----------------------------------------------------------------------------
// Datenvertrag `FeatureGroup` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface FeatureGroup {
  surface: FeatureSurface;
  title: string;
}

// -----------------------------------------------------------------------------
// Rendert und aktualisiert Aktivierung, Titel und Reihenfolge aller Features.
// -----------------------------------------------------------------------------
export function FeatureManager(
  props: FeatureManagerProps,
): ReactElement {
  // Werte werden beim Tippen nicht sofort normalisiert, damit Leerzeichen erhalten bleiben.
  const [titleDrafts, setTitleDrafts] = ReactRuntime.useState<Partial<Record<FeatureId, string>>>({});
  // Sortierwerte bleiben beim Tippen lokal: ein leeres Zwischenfeld ist KEIN
  // Befehl, den bisherigen Wert durch den Standardwert zu ersetzen.
  const [orderDrafts, setOrderDrafts] = ReactRuntime.useState<Partial<Record<FeatureId, string>>>({});

  const groups: readonly FeatureGroup[] = [
    {
      surface: "custom-app",
      title: props.t(
        "modules.customApp",
      ),
    },
    {
      surface: "extension",
      title: props.t(
        "modules.extension",
      ),
    },
  ];

  // Aktualisiert genau ein Feature, ohne die übrigen Feature-Einstellungen zu überschreiben.
  function updateFeature(
    featureId: FeatureId,
    changes: Partial<
      FeaturePreferences[FeatureId]
    >,
  ): void {
    // props.features ist ein Snapshot des letzten React-Renders. Zwei schnelle
    // Änderungen an verschiedenen Modulen können vor dem nächsten Render
    // passieren. Immer den aktuell persistierten Stand einlesen, damit die
    // zweite Änderung die erste nicht durch einen alten Snapshot überschreibt.
    const currentFeatures = loadSettings().features;

    props.onChange({
      features: {
        ...currentFeatures,
        [featureId]: {
          ...currentFeatures[featureId],
          ...changes,
        },
      },
    });
  }

  // Rendert die vollständige Einstellungszeile eines einzelnen Features.
  function renderFeature(
    definition: FeatureDefinition,
  ): ReactElement {
    const preference =
      props.features[definition.id];

    const visibleTitle =
      getFeatureTitle(
        definition.id,
        preference.customTitle,
        props.t,
      );

    const defaultTitle =
      getDefaultFeatureTitle(
        definition.id,
        props.t,
      );

    const enabledId =
      `feature-${definition.id}-enabled`;

    const titleId =
      `feature-${definition.id}-title`;

    const orderId =
      `feature-${definition.id}-order`;

    // Übernimmt den Aktivierungsstatus eines Features aus der Checkbox.
    function handleEnabledChange(
      event: ChangeEvent<HTMLInputElement>,
    ): void {
      updateFeature(
        definition.id,
        {
          enabled: event.target.checked,
        },
      );
    }

    // Speichert den benutzerdefinierten Anzeigenamen eines Features.
    function handleTitleChange(
      event: ChangeEvent<HTMLInputElement>,
    ): void {
      setTitleDrafts((previous) => ({ ...previous, [definition.id]: event.target.value }));
    }

    // Eingabe NICHT sofort persistieren: beim Leeren liefert valueAsNumber
    // NaN und die Normalisierung würde die Position ungewollt zurücksetzen.
    function handleOrderChange(event: ChangeEvent<HTMLInputElement>): void {
      setOrderDrafts((previous) => ({ ...previous, [definition.id]: event.target.value }));
    }

    // Erst beim Verlassen des Feldes eine gültige Position übernehmen.
    // Ungültige Zwischenwerte werden verworfen, der gespeicherte Wert bleibt.
    function handleOrderBlur(event: import("react").FocusEvent<HTMLInputElement>): void {
      const order = parseFeatureOrderDraft(event.currentTarget.value);
      if (order !== null && order !== preference.order) {
        updateFeature(definition.id, { order });
      }
      setOrderDrafts((previous) => {
        const next = { ...previous };
        delete next[definition.id];
        return next;
      });
    }

    // Enter bestätigt, Escape verwirft den Entwurf ohne Storage-Schreibzugriff.
    function handleOrderKey(event: KeyboardEvent<HTMLInputElement>): void {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.value = String(preference.order);
        event.currentTarget.blur();
      }
    }

    return (
      <article
        key={definition.id}
        className="zukato-feature"
      >
        {/* Standardansicht = nur das Wesentliche. Seltene Optionen eingeklappt. */}
        <div className="zukato-feature__compact">
          <div>
            <h4>{visibleTitle}</h4>
            {definition.required && <small>{props.t("modules.required")}</small>}
          </div>
          <label className="zukato-toggle">
            <input id={enabledId} type="checkbox" checked={preference.enabled}
              disabled={definition.required} onChange={handleEnabledChange} />
            <span>{props.t("modules.enabled")}</span>
          </label>
        </div>
        <details className="zukato-feature__advanced">
          <summary>{props.t("settings.advancedModule")}</summary>
          <div className="zukato-feature__field">
            <label htmlFor={titleId}>{props.t("modules.displayTitle")}</label>
            <input id={titleId} type="text" maxLength={60}
              value={titleDrafts[definition.id] ?? preference.customTitle}
              onBlur={() => {
                const draft = titleDrafts[definition.id];
                if (draft !== undefined) {
                  updateFeature(definition.id, { customTitle: draft });
                  setTitleDrafts((previous) => {
                    const next = { ...previous };
                    delete next[definition.id];
                    return next;
                  });
                }
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              disabled={!definition.customizableTitle}
              placeholder={props.t("modules.defaultTitlePlaceholder", { title: defaultTitle })}
              onChange={handleTitleChange} />
          </div>
          <div className="zukato-feature__field">
            <label htmlFor={orderId}>{props.t("modules.order")}</label>
            <input id={orderId} type="number" min={0} max={10000} step={1}
              value={orderDrafts[definition.id] ?? String(preference.order)}
              onChange={handleOrderChange} onBlur={handleOrderBlur}
              onKeyDown={handleOrderKey} />
          </div>
        </details>
      </article>
    );
  }

  return (
    <section
      className="zukato-modules"
      aria-labelledby="modules-heading"
    >
      <header>
        <h2 id="modules-heading">
          {props.t(
            "modules.heading",
          )}
        </h2>

        <p>
          {props.t(
            "modules.description",
          )}
        </p>
      </header>

      {groups.map((group) => (
        <section
          key={group.surface}
          className="zukato-modules__group"
        >
          <h3>
            {group.title}
          </h3>

          <div className="zukato-modules__list">
            {getFeaturesBySurface(
              group.surface,
            ).map(renderFeature)}
          </div>
        </section>
      ))}
    </section>
  );
}