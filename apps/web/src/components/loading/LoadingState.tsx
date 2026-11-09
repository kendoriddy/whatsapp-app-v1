import type { CSSProperties, ReactNode } from "react";

type StatusProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

function StatusRegion({ label, className, children }: StatusProps) {
  return (
    <div
      className={className}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function Shimmer({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`loading-shimmer ${className}`.trim()} style={style} />
  );
}

/** Relay mark: green ring + gold traveling highlight + signal arcs. */
export function RelayMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`loading-relay-mark ${className}`.trim()}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
        <circle
          className="loading-relay-ring"
          cx="16"
          cy="16"
          r="11"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          className="loading-relay-orbit"
          cx="16"
          cy="16"
          r="11"
          stroke="var(--accent-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="8 62"
        />
        <path
          className="loading-relay-arc"
          d="M10 12.5a7.5 7.5 0 0 1 12 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          className="loading-relay-arc loading-relay-arc-2"
          d="M12 15a4.8 4.8 0 0 1 8 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx="16" cy="19.5" r="1.6" fill="var(--accent-2)" />
      </svg>
    </span>
  );
}

function MarkedHeader({ label }: { label: string }) {
  return (
    <div className="loading-marked-head">
      <RelayMark />
      <span className="muted">{label}</span>
    </div>
  );
}

export function StatGridSkeleton({
  count = 7,
  label = "Loading dashboard",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <StatusRegion label={label} className="grid-cards loading-stat-grid">
      {Array.from({ length: count }, (_, i) => (
        <div className="panel card-stat loading-stat-card" key={i}>
          <Shimmer
            className="loading-bar loading-bar-sm"
            style={{ width: "48%" }}
          />
          <Shimmer
            className="loading-bar loading-bar-lg"
            style={{ width: "36%", marginTop: "0.65rem" }}
          />
        </div>
      ))}
    </StatusRegion>
  );
}

export function DashPanelsSkeleton({
  label = "Loading dashboard panels",
}: {
  label?: string;
}) {
  const titles = [
    "Orders by stage",
    "Recent orders",
    "Recent payments",
    "Latest messages",
  ];
  return (
    <StatusRegion label={label} className="loading-dash-panels">
      <MarkedHeader label="Loading desk…" />
      <div className="dash-columns">
        {titles.map((title) => (
          <section className="panel" key={title}>
            <h2>{title}</h2>
            <ul className="dash-list loading-dash-list">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i}>
                  <Shimmer
                    className="loading-bar"
                    style={{ width: `${72 - i * 12}%` }}
                  />
                  <Shimmer
                    className="loading-bar loading-bar-xs"
                    style={{ width: "28%", marginTop: "0.35rem" }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </StatusRegion>
  );
}

export function ListSkeleton({
  rows = 6,
  label = "Loading conversations",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <StatusRegion label={label} className="loading-list">
      {Array.from({ length: rows }, (_, i) => (
        <div className="list-item loading-list-item" key={i} aria-hidden="true">
          <div className="conversation-row">
            <Shimmer
              className="loading-bar"
              style={{ width: `${42 + (i % 3) * 10}%` }}
            />
            <Shimmer className="loading-chip" />
          </div>
          <Shimmer
            className="loading-bar loading-bar-sm"
            style={{ width: `${58 + (i % 4) * 8}%`, marginTop: "0.45rem" }}
          />
        </div>
      ))}
    </StatusRegion>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  label = "Loading table",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr
          key={r}
          className="loading-table-row"
          role={r === 0 ? "status" : undefined}
          aria-busy={r === 0 ? true : undefined}
          aria-label={r === 0 ? label : undefined}
        >
          {Array.from({ length: columns }, (_, c) => (
            <td key={c}>
              <Shimmer
                className="loading-bar loading-bar-sm"
                style={{
                  width: `${55 + ((r + c) % 4) * 10}%`,
                  maxWidth: "100%",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ThreadSkeleton({
  label = "Loading messages",
}: {
  label?: string;
}) {
  const bubbles: Array<{ side: "in" | "out"; width: string }> = [
    { side: "in", width: "62%" },
    { side: "out", width: "48%" },
    { side: "in", width: "55%" },
    { side: "out", width: "70%" },
    { side: "in", width: "40%" },
  ];
  return (
    <StatusRegion label={label} className="loading-thread">
      <MarkedHeader label="Loading messages…" />
      {bubbles.map((b, i) => (
        <div
          key={i}
          className={`msg ${b.side === "in" ? "in" : "out"} loading-msg`}
          style={{ width: b.width, maxWidth: "70%" }}
          aria-hidden="true"
        >
          <Shimmer
            className="loading-bar loading-bar-xs"
            style={{ width: "30%" }}
          />
          <Shimmer
            className="loading-bar loading-bar-sm"
            style={{ width: "88%", marginTop: "0.45rem" }}
          />
          <Shimmer
            className="loading-bar loading-bar-sm"
            style={{ width: "64%", marginTop: "0.35rem" }}
          />
        </div>
      ))}
    </StatusRegion>
  );
}

export function DrawerSkeleton({
  label = "Loading details",
  rows = 5,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <StatusRegion label={label} className="loading-drawer">
      <Shimmer
        className="loading-bar loading-bar-lg"
        style={{ width: "42%" }}
      />
      <Shimmer
        className="loading-bar loading-bar-sm"
        style={{ width: "28%", marginTop: "0.5rem" }}
      />
      <dl className="detail-grid" style={{ marginTop: "1.25rem" }}>
        {Array.from({ length: rows }, (_, i) => (
          <div className="loading-drawer-row" key={i}>
            <dt>
              <Shimmer
                className="loading-bar loading-bar-xs"
                style={{ width: "70%" }}
              />
            </dt>
            <dd>
              <Shimmer
                className="loading-bar loading-bar-sm"
                style={{ width: `${50 + (i % 3) * 15}%` }}
              />
            </dd>
          </div>
        ))}
      </dl>
    </StatusRegion>
  );
}

export function PanelSkeleton({
  label = "Merlin is reading this thread",
}: {
  label?: string;
}) {
  return (
    <StatusRegion label={label} className="loading-panel">
      <MarkedHeader label="Merlin is reading…" />
      <Shimmer
        className="loading-bar loading-bar-xs"
        style={{ width: "28%", marginTop: "0.85rem" }}
      />
      <Shimmer
        className="loading-bar loading-bar-lg"
        style={{ width: "78%", marginTop: "0.55rem" }}
      />
      <Shimmer
        className="loading-bar loading-bar-sm"
        style={{ width: "92%", marginTop: "0.55rem" }}
      />
      <ul className="loading-panel-facts">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <Shimmer
              className="loading-bar loading-bar-sm"
              style={{ width: `${70 - i * 12}%` }}
            />
          </li>
        ))}
      </ul>
    </StatusRegion>
  );
}

export function InlineSkeleton({
  label = "Loading",
  width = "10rem",
}: {
  label?: string;
  width?: string;
}) {
  return (
    <StatusRegion label={label} className="loading-inline">
      <Shimmer className="loading-bar loading-bar-sm" style={{ width }} />
    </StatusRegion>
  );
}

export function ReceiptSkeleton({
  label = "Loading receipt",
}: {
  label?: string;
}) {
  return (
    <StatusRegion label={label} className="loading-mkt">
      <div className="loading-marked-head">
        <RelayMark className="loading-relay-mark--mkt" />
        <span>Loading receipt…</span>
      </div>
      <Shimmer
        className="loading-bar loading-bar-sm"
        style={{ width: "72%", marginTop: "1rem" }}
      />
      <dl className="loading-mkt-dl">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="loading-mkt-row" key={i}>
            <Shimmer
              className="loading-bar loading-bar-xs"
              style={{ width: "4.5rem" }}
            />
            <Shimmer
              className="loading-bar loading-bar-sm"
              style={{ width: `${48 + (i % 3) * 12}%` }}
            />
          </div>
        ))}
      </dl>
    </StatusRegion>
  );
}
