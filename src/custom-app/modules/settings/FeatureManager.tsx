// =============================================================================
// Datei: src/custom-app/modules/settings/FeatureManager.tsx
// Zweck: Verwaltet Aktivierung, Anzeigenamen und Sortierung aller registrierten Features.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";

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
    const currentPreference =
      props.features[featureId];

    props.onChange({
      features: {
        ...props.features,

        [featureId]: {
          ...currentPreference,
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

    // Speichert die numerische Sortierposition eines Features.
    function handleOrderChange(
      event: ChangeEvent<HTMLInputElement>,
    ): void {
      updateFeature(
        definition.id,
        {
          order:
            event.target.valueAsNumber,
        },
      );
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
            <input id={orderId} type="number" min={0} max={10000} step={10}
              value={preference.order} onChange={handleOrderChange} />
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