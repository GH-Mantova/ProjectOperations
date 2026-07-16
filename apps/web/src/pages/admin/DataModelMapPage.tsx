import { useAuth } from "../../auth/AuthContext";
import { NoAccess } from "../../components/NoAccess";

// Super-user only: iframes /data-model.html, which the vite build emits by
// regenerating scripts/data-model/build-graph-html.mjs against the current
// schema.prisma. The static file is gitignored and only exists in the
// deployed bundle — this page is the one way to view it via the app.
export function DataModelMapPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.isSuperUser !== true) {
    return (
      <NoAccess
        required="role:SuperUser"
        title="Data-model map is restricted to super-users"
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-subtle, #E5E7EB)" }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0, fontSize: 20 }}>
          Data-model map
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted, #6B7280)", fontSize: 13 }}>
          Interactive relationship graph regenerated at build time from{" "}
          <code>schema.prisma</code>. Click a model to focus its relationships.
        </p>
      </div>
      <iframe
        title="ProjectOperations data-model relationship graph"
        src="/data-model.html"
        style={{ flex: 1, width: "100%", border: "none" }}
      />
    </div>
  );
}
