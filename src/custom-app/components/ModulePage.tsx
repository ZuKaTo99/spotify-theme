import type { ReactNode } from "react";

interface ModulePageProps {
  title: string;
  children?: ReactNode;
}

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