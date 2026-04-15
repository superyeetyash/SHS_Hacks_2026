import { NextResponse } from "next/server";
import { isDeepStrictEqual } from "node:util";

import { runReferenceBatch } from "@/lib/edgeproof/codeRunner";
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

  const suite = body?.suite as GeneratedSuite | undefined;
  const studentCode = String(body?.studentCode || "");
  const functionName = String(body?.functionName || "solve").trim() || "solve";

  const language = String(body?.language || suite?.metadata?.language || "python").trim().toLowerCase();

  if (!suite || !suite.metadata || !Array.isArray(suite.testCases)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid suite." }, { status: 400 });
  }

  if (!studentCode.trim()) {
    return NextResponse.json({ ok: false, error: "Please paste student code before retesting." }, { status: 400 });
  }

  const suiteCopy: GeneratedSuite = JSON.parse(JSON.stringify(suite));

  evaluateStudentCode({
    generated: suiteCopy,
    language,
    functionName,
    candidateCode: studentCode,
  });

  return NextResponse.json({ ok: true, suite: suiteCopy });
}
