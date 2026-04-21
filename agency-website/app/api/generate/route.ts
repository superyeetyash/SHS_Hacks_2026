import { NextResponse } from "next/server";
import { isDeepStrictEqual } from "node:util";

import { runReferenceBatch, runReferenceOnce } from "@/lib/edgeproof/codeRunner";
import { isExecutableEdgeproofLanguage, parseEdgeproofLanguage } from "@/lib/edgeproof/languages";
import { generateTestCases } from "@/lib/edgeproof/testCaseGenerator";
import type { GeneratedSuite } from "@/lib/edgeproof/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addMissingFunctionHint(errorText: string | null, functionName: string, language: string) {
  if (!errorText || !errorText.includes("was not found")) {
    return errorText;
  }

  const normalizedLanguage = (language || "").toLowerCase();
  if (normalizedLanguage === "python") {
    return `${errorText}\n\nHint: your code must define \`${functionName}(input_data)\`.\nExample:\ndef ${functionName}(input_data):\n    # use your class/helpers here\n    return input_data`;
  }

  if (normalizedLanguage === "javascript") {
    return `${errorText}\n\nHint: your code must define \`${functionName}(input)\`.\nExample:\nfunction ${functionName}(input) {\n  // use your class/helpers here\n  return input;\n}`;
  }

  if (normalizedLanguage === "java") {
    return `${errorText}\n\nHint: define class \`Solution\` with method \`${functionName}(String inputJson)\`.\nExample:\npublic class Solution {\n  public static String ${functionName}(String inputJson) {\n    return inputJson;\n  }\n}`;
  }

  if (normalizedLanguage === "c") {
    return `${errorText}\n\nHint: define \`${functionName}(const char* input_json)\`.\nExample:\nconst char* ${functionName}(const char* input_json) {\n  return input_json;\n}`;
  }

  if (normalizedLanguage === "cpp") {
    return `${errorText}\n\nHint: define \`${functionName}(const std::string& input_json)\`.\nExample:\nstd::string ${functionName}(const std::string& input_json) {\n  return input_json;\n}`;
  }

  if (normalizedLanguage === "csharp") {
    return `${errorText}\n\nHint: define class \`Solution\` with method \`${functionName}(string inputJson)\`.\nExample:\npublic static class Solution {\n  public static string ${functionName}(string inputJson) {\n    return inputJson;\n  }\n}`;
  }

  if (normalizedLanguage === "rust") {
    return `${errorText}\n\nHint: define \`${functionName}(input_json: String) -> String\`.\nExample:\nfn ${functionName}(input_json: String) -> String {\n    input_json\n}`;
  }

  return errorText;
}

function estimateBatchTimeoutMs(caseCount: number) {
  const n = Number.isFinite(caseCount) ? caseCount : 0;
  // Base + small per-case allowance, capped.
  return Math.min(4000 + n * 35, 30000);
}

function evaluateStudentCode({
  generated,
  language,
  functionName,
  candidateCode,
}: {
  generated: GeneratedSuite;
  language: string;
  functionName: string;
  candidateCode: string;
}) {
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;

  const inputs = generated.testCases.map((testCase) => testCase.input);
  const studentBatch = runReferenceBatch({
    language,
    referenceCode: candidateCode,
    functionName,
    inputs,
    timeoutMs: estimateBatchTimeoutMs(inputs.length),
  });

  const globalStudentError = studentBatch.ok
    ? null
    : addMissingFunctionHint(studentBatch.error, functionName, language);
  const batchResults = studentBatch.ok ? studentBatch.results : [];

  generated.testCases = generated.testCases.map((testCase, idx) => {
    const perCase = studentBatch.ok ? batchResults[idx] : null;
    const ok = Boolean(perCase && perCase.ok);

    const studentError = ok
      ? null
      : addMissingFunctionHint(
          (perCase && !perCase.ok ? perCase.error : null) ||
            globalStudentError ||
            "Execution failed for this test case.",
          functionName,
          language
        );

    const expectedReady = testCase.expected !== "depends-on-spec";
    const isPass = expectedReady && ok ? isDeepStrictEqual((perCase as any).result, testCase.expected) : false;

    if (!ok) {
      errorCount += 1;
      failCount += 1;
    } else if (expectedReady && isPass) {
      passCount += 1;
    } else {
      failCount += 1;
    }

    return {
      ...testCase,
      studentOutput: ok ? (perCase as any).result : null,
      studentError,
      studentPass: isPass,
      expectedReady,
    };
  });

  generated.studentEvaluation = {
    enabled: true,
    functionName,
    passCount,
    failCount,
    errorCount,
    note:
      "Student pass/fail uses strict output comparison against expected outputs generated from the reference solution.",
  };
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const challengeTitle = String(body?.challengeTitle || "").trim();
  const directions = String(body?.directions || "").trim();
  const referenceCode = String(body?.referenceCode || "");

  const requestedLanguage = String(body?.language || "python").trim();
  const parsedLanguage = parseEdgeproofLanguage(requestedLanguage);
  if (!parsedLanguage) {
    return NextResponse.json({ ok: false, error: `Unsupported language: ${requestedLanguage}` }, { status: 400 });
  }

  const language = parsedLanguage;
  const requiredCount = Number(body?.requiredCount ?? 20);
  const functionName = String(body?.functionName || "solve").trim() || "solve";

  const executionSupported = isExecutableEdgeproofLanguage(language);
  const runReference = executionSupported ? body?.runReference !== false : false;
  const runStudent = executionSupported ? Boolean(body?.runStudent) : false;
  const studentCode = String(body?.studentCode || "");

  const hasExampleInput = Object.prototype.hasOwnProperty.call(body || {}, "exampleInput");
  const exampleInput = hasExampleInput ? body.exampleInput : undefined;
  const exampleDescription = String(body?.exampleDescription || "Optional example run").trim();

  if (!challengeTitle || !directions || !referenceCode.trim()) {
    return NextResponse.json(
      { ok: false, error: "Please provide challenge title, directions, and reference code." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(requiredCount) || requiredCount < 1 || requiredCount > 500) {
    return NextResponse.json(
      { ok: false, error: "Required test case count must be between 1 and 500." },
      { status: 400 }
    );
  }

  if (runStudent && !studentCode.trim()) {
    return NextResponse.json(
      { ok: false, error: "Please paste student code before running candidate evaluation." },
      { status: 400 }
    );
  }

  const generated = generateTestCases({
    challengeTitle,
    language,
    directions,
    referenceCode,
    requiredCount,
    exampleInput,
  });

  if (runReference) {
    const inputs = generated.testCases.map((testCase) => testCase.input);
    const batchExecution = runReferenceBatch({
      language,
      referenceCode,
      functionName,
      inputs,
      timeoutMs: estimateBatchTimeoutMs(inputs.length),
    });

    const globalExecutionError = batchExecution.ok
      ? null
      : addMissingFunctionHint(batchExecution.error, functionName, language);

    let successCount = 0;
    let failedCount = 0;

    const batchResults = batchExecution.ok ? batchExecution.results : [];

    generated.testCases = generated.testCases.map((testCase, idx) => {
      const perCase = batchExecution.ok ? batchResults[idx] : null;
      const ok = Boolean(perCase && perCase.ok);
      if (ok) successCount += 1;
      else failedCount += 1;

      const executionError = ok
        ? null
        : addMissingFunctionHint(
            (perCase && !perCase.ok ? perCase.error : null) ||
              globalExecutionError ||
              "Execution failed for this test case.",
            functionName,
            language
          );

      return {
        ...testCase,
        expected: ok ? (perCase as any).result : testCase.expected,
        actualOutput: ok ? (perCase as any).result : null,
        executionError,
      };
    });

    generated.execution = {
      enabled: true,
      functionName,
      successCount,
      failedCount,
      warning:
        "Reference code executes on the server for preview. Do not run untrusted code in production without sandboxing.",
    };

    if (hasExampleInput) {
      const exampleExecution = runReferenceOnce({
        language,
        referenceCode,
        functionName,
        input: exampleInput,
        timeoutMs: 3000,
      });

      generated.exampleRun = {
        description: exampleDescription || "Optional example run",
        input: exampleInput,
        output: exampleExecution.ok ? exampleExecution.result : null,
        error: exampleExecution.ok
          ? null
          : addMissingFunctionHint(exampleExecution.error, functionName, language),
      };
    }
  }

  if (runStudent) {
    evaluateStudentCode({
      generated,
      language,
      functionName,
      candidateCode: studentCode,
    });
  }

  return NextResponse.json({ ok: true, suite: generated });
}
