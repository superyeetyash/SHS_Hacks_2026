import type { EdgeproofLanguage } from "@/lib/edgeproof/languages";

export type SupportedLanguage = EdgeproofLanguage;

export type ExpectedOutput = unknown | "depends-on-spec";

export type BatchCaseOk = { ok: true; result: unknown };
export type BatchCaseError = { ok: false; error: string };
export type BatchCaseResult = BatchCaseOk | BatchCaseError;

export type RunOnceOk = { ok: true; result: unknown };
export type RunError = { ok: false; error: string };

export type RunOnceResult = RunOnceOk | RunError;
export type RunBatchOk = { ok: true; results: BatchCaseResult[] };
export type RunBatchResult = RunBatchOk | RunError;

export type InputModel = "array" | "string" | "number" | "matrix" | "graph";

export type SuiteMetadata = {
  challengeTitle: string;
  language: string;
  inferredInputModel: InputModel;
  requiredCount: number;
  generatedCount: number;
  constraintHints: string[];
  seed: number;
  generatedAt: string;
  note: string;
};

export type SuiteExecution = {
  enabled: true;
  functionName: string;
  successCount: number;
  failedCount: number;
  warning: string;
};

export type ExampleRun = {
  description: string;
  input: unknown;
  output: unknown | null;
  error: string | null;
};

export type StudentEvaluation = {
  enabled: true;
  functionName: string;
  passCount: number;
  failCount: number;
  errorCount: number;
  note: string;
};

export type TestCase = {
  id: string;
  category: string;
  input: unknown;
  expected: ExpectedOutput;
  rationale: string;

  actualOutput?: unknown | null;
  executionError?: string | null;

  studentOutput?: unknown | null;
  studentError?: string | null;
  studentPass?: boolean;
  expectedReady?: boolean;
};

export type GeneratedSuite = {
  metadata: SuiteMetadata;
  testCases: TestCase[];
  execution?: SuiteExecution;
  exampleRun?: ExampleRun;
  studentEvaluation?: StudentEvaluation;
};
