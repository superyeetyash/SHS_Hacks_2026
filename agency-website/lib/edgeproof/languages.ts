export const EDGEPROOF_LANGUAGES = [
  "javascript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "rust",
  "sql",
] as const;

export type EdgeproofLanguage = (typeof EDGEPROOF_LANGUAGES)[number];

const LANGUAGE_ALIAS_MAP: Record<string, EdgeproofLanguage> = {
  javascript: "javascript",
  js: "javascript",
  node: "javascript",
  python: "python",
  py: "python",
  java: "java",
  c: "c",
  "c++": "cpp",
  cpp: "cpp",
  cxx: "cpp",
  "c#": "csharp",
  csharp: "csharp",
  cs: "csharp",
  dotnet: "csharp",
  rust: "rust",
  rs: "rust",
  sql: "sql",
  mysql: "sql",
  postgres: "sql",
};

const EXECUTION_LANGUAGES = new Set<EdgeproofLanguage>(EDGEPROOF_LANGUAGES);

export function parseEdgeproofLanguage(value: string): EdgeproofLanguage | null {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return null;
  return LANGUAGE_ALIAS_MAP[key] ?? null;
}

export function normalizeEdgeproofLanguage(value: string, fallback: EdgeproofLanguage = "python"): EdgeproofLanguage {
  return parseEdgeproofLanguage(value) ?? fallback;
}

export function isExecutableEdgeproofLanguage(language: string): boolean {
  const parsed = parseEdgeproofLanguage(language);
  return parsed ? EXECUTION_LANGUAGES.has(parsed) : false;
}
