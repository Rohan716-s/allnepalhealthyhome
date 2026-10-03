export type WorkspaceLabels = Record<string, string>;

function normalizeLabel(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function parseWorkspaceLabels(value?: string): WorkspaceLabels {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

/** Resolve a configured display label without changing the stable internal route/permission key. */
export function workspaceLabel(label: string, labels: WorkspaceLabels) {
  const direct = labels[label]?.trim();
  if (direct) return direct;
  const normalized = normalizeLabel(label);
  const alias = Object.entries(labels).find(([key, value]) => normalizeLabel(key) === normalized && value.trim());
  return alias?.[1].trim() || label;
}
