const express = require("express");
const { isDeepStrictEqual } = require("util");

const { requireAuth } = require("../middleware/auth");
const { generateTestCases } = require("../services/testCaseGenerator");
const { runReferenceBatch, runReferenceOnce } = require("../services/codeRunner");

const router = express.Router();

function addMissingFunctionHint(errorText, functionName, language) {
  if (!errorText || !errorText.includes("was not found")) {
    return errorText;
  }

  const normalizedLanguage = (language || "").toLowerCase();
  if (normalizedLanguage === "python") {
    return `${errorText}\n\nHint: your code must define \`${functionName}\(input_data\)\`.\nExample:\ndef ${functionName}(input_data):\n    # use your class/helpers here\n    return input_data`;
  }

  if (normalizedLanguage === "javascript") {
    return `${errorText}\n\nHint: your code must define \`${functionName}(input)\`.\nExample:\nfunction ${functionName}(input) {\n  // use your class/helpers here\n  return input;\n}`;
  }

  return errorText;
}

function estimateBatchTimeoutMs(caseCount) {
  const n = Number.isFinite(caseCount) ? caseCount : 0;
  // Base + small per-case allowance, capped.
  return Math.min(4000 + n * 35, 30000);
}

function evaluateStudentCode({ generated, language, functionName, candidateCode }) {
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;

  const inputs = generated.testCases.map((testCase) => testCase.input);
  const studentBatch = runReferenceBatch({
    language,
    referenceCode: candidateCode,
    functionName,
    inputs,
    timeoutMs: estimateBatchTimeoutMs(inputs.length)
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
          perCase?.error || globalStudentError || "Execution failed for this test case.",
          functionName,
          language
        );

    const expectedReady = testCase.expected !== "depends-on-spec";
    const isPass =
      expectedReady && ok
        ? isDeepStrictEqual(perCase.result, testCase.expected)
        : false;

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
      studentOutput: ok ? perCase.result : null,
      studentError,
      studentPass: isPass,
      expectedReady
    };
  });

  generated.studentEvaluation = {
    enabled: true,
    functionName,
    passCount,
    failCount,
    errorCount,
    note:
      "Student pass/fail uses strict output comparison against expected outputs generated from the reference solution."
  };
}

router.get("/dashboard", requireAuth, (req, res) => {
  return res.render("dashboard", {
    title: "Test Case Generator",
    error: null,
    result: null,
    formData: {
      challengeTitle: "",
      language: "python",
      requiredCount: 20,
      functionName: "solve",
      runCodeEnabled: true,
      runCandidateEnabled: false,
      exampleDescription: "",
      exampleInputJson: "",
      candidateCode: "",
      directions: "",
      referenceCode: ""
    }
  });
});

router.post("/dashboard/generate", requireAuth, (req, res) => {
  const formData = {
    challengeTitle: (req.body.challengeTitle || "").trim(),
    language: (req.body.language || "python").trim().toLowerCase(),
    requiredCount: Number(req.body.requiredCount || 20),
    functionName: (req.body.functionName || "solve").trim() || "solve",
    runCodeEnabled: req.body.runCodeEnabled === "yes",
    runCandidateEnabled: req.body.runCandidateEnabled === "yes",
    exampleDescription: (req.body.exampleDescription || "").trim(),
    exampleInputJson: (req.body.exampleInputJson || "").trim(),
    candidateCode: req.body.candidateCode || "",
    directions: (req.body.directions || "").trim(),
    referenceCode: req.body.referenceCode || ""
  };

  if (!formData.challengeTitle || !formData.directions || !formData.referenceCode) {
    return res.status(400).render("dashboard", {
      title: "Test Case Generator",
      error: "Please provide challenge title, directions, and reference code.",
      result: null,
      formData
    });
  }

  if (Number.isNaN(formData.requiredCount) || formData.requiredCount < 1 || formData.requiredCount > 500) {
    return res.status(400).render("dashboard", {
      title: "Test Case Generator",
      error: "Required test case count must be between 1 and 500.",
      result: null,
      formData
    });
  }

  let exampleInput = null;

  if (formData.exampleInputJson) {
    try {
      exampleInput = JSON.parse(formData.exampleInputJson);
    } catch {
      return res.status(400).render("dashboard", {
        title: "Test Case Generator",
        error: "Example input must be valid JSON (for example: {\"arr\":[1,2,3]}).",
        result: null,
        formData
      });
    }
  }

  const generated = generateTestCases({
    challengeTitle: formData.challengeTitle,
    language: formData.language,
    directions: formData.directions,
    referenceCode: formData.referenceCode,
    requiredCount: formData.requiredCount,
    exampleInput
  });

  if (formData.runCodeEnabled) {
    const inputs = generated.testCases.map((testCase) => testCase.input);
    const batchExecution = runReferenceBatch({
      language: formData.language,
      referenceCode: formData.referenceCode,
      functionName: formData.functionName,
      inputs,
      timeoutMs: estimateBatchTimeoutMs(inputs.length)
    });

    const globalExecutionError = batchExecution.ok
      ? null
      : addMissingFunctionHint(batchExecution.error, formData.functionName, formData.language);

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
            perCase?.error || globalExecutionError || "Execution failed for this test case.",
            formData.functionName,
            formData.language
          );

      return {
        ...testCase,
        expected: ok ? perCase.result : testCase.expected,
        actualOutput: ok ? perCase.result : null,
        executionError
      };
    });

    generated.execution = {
      enabled: true,
      functionName: formData.functionName,
      successCount,
      failedCount,
      warning:
        "Reference code executes on the server for preview. Do not run untrusted code in production without sandboxing."
    };

    if (exampleInput !== null) {
      const exampleExecution = runReferenceOnce({
        language: formData.language,
        referenceCode: formData.referenceCode,
        functionName: formData.functionName,
        input: exampleInput,
        timeoutMs: 3000
      });

      generated.exampleRun = {
        description: formData.exampleDescription || "Optional example run",
        input: exampleInput,
        output: exampleExecution.ok ? exampleExecution.result : null,
        error: exampleExecution.ok
          ? null
          : addMissingFunctionHint(exampleExecution.error, formData.functionName, formData.language)
      };
    }
  }

  if (formData.runCandidateEnabled) {
    if (!formData.candidateCode.trim()) {
      return res.status(400).render("dashboard", {
        title: "Test Case Generator",
        error: "Please paste student code before running candidate evaluation.",
        result: null,
        formData
      });
    }

    evaluateStudentCode({
      generated,
      language: formData.language,
      functionName: formData.functionName,
      candidateCode: formData.candidateCode
    });
  }

  req.session.lastGenerated = generated;
  req.session.lastFormData = formData;

  return res.render("dashboard", {
    title: "Test Case Generator",
    error: null,
    result: generated,
    formData
  });
});

router.post("/dashboard/retest", requireAuth, (req, res) => {
  const lastGenerated = req.session.lastGenerated;
  const lastFormData = req.session.lastFormData;

  if (!lastGenerated || !lastFormData) {
    return res.status(400).render("dashboard", {
      title: "Test Case Generator",
      error: "Generate a test suite first before running student code.",
      result: null,
      formData: {
        challengeTitle: "",
        language: "python",
        requiredCount: 20,
        functionName: "solve",
        runCodeEnabled: true,
        runCandidateEnabled: false,
        exampleDescription: "",
        exampleInputJson: "",
        candidateCode: "",
        directions: "",
        referenceCode: ""
      }
    });
  }

  const candidateCode = req.body.candidateCode || "";
  const functionName = (req.body.functionName || lastFormData.functionName || "solve").trim() || "solve";

  if (!candidateCode.trim()) {
    return res.status(400).render("dashboard", {
      title: "Test Case Generator",
      error: "Please paste student code before retesting.",
      result: lastGenerated,
      formData: {
        ...lastFormData,
        runCandidateEnabled: true,
        candidateCode,
        functionName
      }
    });
  }

  const generatedCopy = JSON.parse(JSON.stringify(lastGenerated));
  evaluateStudentCode({
    generated: generatedCopy,
    language: lastFormData.language,
    functionName,
    candidateCode
  });

  const updatedForm = {
    ...lastFormData,
    runCandidateEnabled: true,
    candidateCode,
    functionName
  };

  req.session.lastGenerated = generatedCopy;
  req.session.lastFormData = updatedForm;

  return res.render("dashboard", {
    title: "Test Case Generator",
    error: null,
    result: generatedCopy,
    formData: updatedForm
  });
});

module.exports = router;
