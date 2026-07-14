// PR fix/no-access-page-instead-of-redirect — Failure Honesty (sot/01 SECTION 6).
//
// A permission failure must never be a silent redirect: the page it redirects
// TO looks identical to a broken feature, which cost hours of user reports and
// diagnosis on 2026-07-13 (Rates & Lists appearing to "open the dashboard"
// when the real cause was a missing `rates.manage` permission). Any page that
// gates on a capability MUST render this component when the capability is
// missing, so the user sees the exact permission name and knows who to ask.
//
// This component intentionally does NOT navigate, redirect, or render blank.
// It renders as page content — the surrounding ShellLayout (or FieldLayout)
// keeps the app chrome in place so the user still sees the sidebar and knows
// where they are.

type NoAccessProps = {
  required: string | string[];
  title?: string;
};

export function NoAccess({ required, title }: NoAccessProps) {
  const codes = Array.isArray(required) ? required : [required];
  const heading = title ?? "You don't have access to this page";

  return (
    <div
      data-testid="no-access"
      role="main"
      style={{
        padding: 32,
        maxWidth: 640,
        margin: "48px auto",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}
    >
      <h1
        className="s7-type-page-heading"
        style={{ margin: 0, fontSize: 22, color: "var(--text-primary)" }}
      >
        {heading}
      </h1>
      <p style={{ margin: 0, color: "var(--text-secondary, #4B5563)", fontSize: 14, lineHeight: 1.5 }}>
        {codes.length > 1
          ? "This page requires the following permissions:"
          : "This page requires the following permission:"}
      </p>
      <ul
        data-testid="no-access-codes"
        style={{
          margin: 0,
          padding: "12px 16px",
          background: "var(--border-subtle, #F3F4F6)",
          borderRadius: "var(--radius-md, 8px)",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4
        }}
      >
        {codes.map((code) => (
          <li key={code}>
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
                color: "var(--text-primary)"
              }}
            >
              {code}
            </code>
          </li>
        ))}
      </ul>
      <p style={{ margin: 0, color: "var(--text-secondary, #4B5563)", fontSize: 14, lineHeight: 1.5 }}>
        {codes.length > 1
          ? "Ask an administrator to grant you the permissions above if you need to use this page."
          : "Ask an administrator to grant you the permission above if you need to use this page."}
      </p>
    </div>
  );
}
