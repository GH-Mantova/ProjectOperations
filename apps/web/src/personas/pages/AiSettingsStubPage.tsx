// Stub page for /admin/ai-settings. Replaced by the full AI Settings page
// in §5A.1 PR 3. Exists today so the floating window's cog icon lands at
// a visible placeholder instead of being swallowed by the catch-all
// Navigate-to-"/" route in App.tsx.
export function AiSettingsStubPage() {
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontFamily: "'Syne', 'Outfit', sans-serif", fontSize: 28, marginBottom: 8 }}>
        AI Settings
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 16 }}>
        Coming soon — landing in the next §5A.1 PR.
      </p>
      <p style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.6 }}>
        This page will let Sean configure company-wide AI provider access, per-persona settings,
        and the global &quot;allow user instruction overrides&quot; toggle. Each user will also be able
        to set their own provider preference and (if enabled) their own API key for bring-your-own-key.
      </p>
    </div>
  );
}
