import { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Allocation = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
};

type DocItem = {
  id: string;
  name: string;
  category: string;
  fileUrl: string | null;
  fileType: string | null;
  uploadedAt: string;
};

type Group = { allocation: Allocation; docs: DocItem[] };

function mimeBadge(mime: string | null): string {
  if (!mime) return "FILE";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("wordprocessingml")) return "DOCX";
  if (mime.includes("spreadsheetml")) return "XLSX";
  if (mime.startsWith("image/")) return "IMG";
  return mime.split("/").pop()?.toUpperCase() ?? "FILE";
}

export function FieldDocumentsPage() {
  const { authFetch } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allocResponse = await authFetch("/field/my-allocations");
        if (!allocResponse.ok) throw new Error(await allocResponse.text());
        const allocations = (await allocResponse.json()) as Allocation[];
        const next: Group[] = [];
        for (const allocation of allocations) {
          const docResponse = await authFetch(`/field/my-allocations/${allocation.id}/documents`);
          const docs = docResponse.ok ? ((await docResponse.json()) as DocItem[]) : [];
          next.push({ allocation, docs });
        }
        if (!cancelled) setGroups(next);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (error) {
    return (
      <div className="field-card" role="alert" style={{ color: "#A32D2D" }}>
        {error}
      </div>
    );
  }

  if (!groups) {
    return <Skeleton width="100%" height={180} />;
  }

  if (groups.length === 0) {
    return (
      <div className="field-card">
        <EmptyState
          heading="No documents available"
          subtext="Contact your office if you are expecting site documents."
        />
      </div>
    );
  }

  return (
    <div>
      {groups.map((g) => (
        <section key={g.allocation.id} className="field-card">
          <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif", fontSize: 16 }}>
            {g.allocation.projectName}
            <span style={{ color: "#6B7280", marginLeft: 6, fontWeight: 400, fontSize: 13 }}>
              · {g.allocation.projectNumber}
            </span>
          </h3>
          {g.docs.length === 0 ? (
            <p style={{ color: "#6B7280", fontSize: 13, margin: "8px 0 0" }}>
              No documents uploaded for this project yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
              {g.docs.map((doc) => (
                <li
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderTop: "1px solid #F3F4F6"
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.name}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                      <span
                        className="field-pill"
                        style={{ background: "#F1EFE8", color: "#1F2937", marginRight: 6 }}
                      >
                        {mimeBadge(doc.fileType)}
                      </span>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="field-btn"
                      style={{ textDecoration: "none", fontSize: 13, padding: "8px 12px" }}
                    >
                      Open
                    </a>
                  ) : (
                    <span style={{ color: "#6B7280", fontSize: 12 }}>No file</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
