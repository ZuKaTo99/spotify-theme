import type {
  ChangeEvent,
  ReactElement,
} from "react";

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

interface FeatureManagerProps {
  features: FeaturePreferences;
  t: Translator;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

interface FeatureGroup {
  surface: FeatureSurface;
  title: string;
}

export function FeatureManager(
  props: FeatureManagerProps,
): ReactElement {
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

    function handleTitleChange(
      event: ChangeEvent<HTMLInputElement>,
    ): void {
      updateFeature(
        definition.id,
        {
          customTitle:
            event.target.value,
        },
      );
    }

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
        <header className="zukato-feature__header">
          <h4>
            {visibleTitle}
          </h4>

          {definition.required && (
            <span>
              {props.t(
                "modules.required",
              )}
            </span>
          )}
        </header>

        <div className="zukato-feature__field">
          <label htmlFor={enabledId}>
            {props.t(
              "modules.enabled",
            )}
          </label>

          <input
            id={enabledId}
            type="checkbox"
            checked={preference.enabled}
            disabled={definition.required}
            onChange={
              handleEnabledChange
            }
          />
        </div>

        <div className="zukato-feature__field">
          <label htmlFor={titleId}>
            {props.t(
              "modules.displayTitle",
            )}
          </label>

          <input
            id={titleId}
            type="text"
            maxLength={60}
            value={
              preference.customTitle
            }
            disabled={
              !definition.customizableTitle
            }
            placeholder={
              props.t(
                "modules.defaultTitlePlaceholder",
                {
                  title: defaultTitle,
                },
              )
            }
            onChange={
              handleTitleChange
            }
          />
        </div>

        <div className="zukato-feature__field">
          <label htmlFor={orderId}>
            {props.t(
              "modules.order",
            )}
          </label>

          <input
            id={orderId}
            type="number"
            min={0}
            max={10000}
            step={10}
            value={preference.order}
            onChange={
              handleOrderChange
            }
          />
        </div>
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