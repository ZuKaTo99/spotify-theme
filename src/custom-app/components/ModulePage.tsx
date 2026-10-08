// =============================================================================
// Datei: src/custom-app/components/ModulePage.tsx
// Zweck: Gemeinsamer Seitenrahmen für Workspace-Module mit Titel und Inhaltsbereich.
// =============================================================================
import type { ReactNode } from "react";

// -----------------------------------------------------------------------------
// Datenvertrag `ModulePageProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface ModulePageProps {
  title: string;
  children?: ReactNode;
}

// -----------------------------------------------------------------------------
// Stellt das gemeinsame Seitenlayout für alle Workspace-Module bereit.
// -----------------------------------------------------------------------------
export function ModulePage({
  title,
  children,
}: ModulePageProps) {
  return (
    <section className="spotify-toolkit-module-page">
      <header className="spotify-toolkit-module-page__header">
        <h2>{title}</h2>
      </header>

      <div className="spotify-toolkit-module-page__content">
        {children}
      </div>
    </section>
  );
}