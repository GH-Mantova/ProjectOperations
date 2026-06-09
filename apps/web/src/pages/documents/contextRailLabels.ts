export type ContextRailLabel = {
  label: string;
  subLabel?: string;
};

type ContextRailSource = {
  entitySummary?: { title: string } | null;
  folderLink?: { relativePath: string } | null;
};

export function resolveContextRailLabel(source: ContextRailSource, fallbackId: string): ContextRailLabel {
  const summary = source.entitySummary?.title?.trim();
  if (summary) {
    const separatorIndex = summary.indexOf(" - ");
    if (separatorIndex > 0) {
      const code = summary.slice(0, separatorIndex).trim();
      const name = summary.slice(separatorIndex + 3).trim();
      if (code && name) return { label: code, subLabel: name };
    }
    return { label: summary };
  }

  const pathSegment = source.folderLink?.relativePath?.split("/").slice(-2, -1)[0]?.trim();
  if (pathSegment) return { label: pathSegment };

  return { label: fallbackId.slice(0, 10) };
}
