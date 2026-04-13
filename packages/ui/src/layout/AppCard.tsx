import type { PropsWithChildren, ReactNode } from "react";

type AppCardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}>;

export function AppCard({ title, subtitle, actions, children }: AppCardProps) {
  return (
    <section className="app-card">
      {(title || subtitle || actions) && (
        <header className="app-card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      )}
      <div className="app-card__body">{children}</div>
    </section>
  );
}
