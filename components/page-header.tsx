import type { ReactNode } from "react";
import { AppNav } from "./app-nav";

export function PageHeader({
  current,
  section,
  title,
  description,
  meta,
  className = "",
}: {
  current: string;
  section: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`page-header no-print ${className}`.trim()}>
      <div className="app-bar">
        <div className="product-lockup" aria-label="SIM manager workspace">
          <span className="product-mark">SIM</span>
          <span><strong>Sales Incentive Machine</strong><small>Restaurant manager workspace</small></span>
        </div>
        <AppNav current={current} />
      </div>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">{section}</p>
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {meta && <div className="page-meta">{meta}</div>}
      </div>
    </header>
  );
}
