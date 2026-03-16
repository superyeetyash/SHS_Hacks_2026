function inferInputModel(directions, referenceCode) {
  const text = `${directions}\n${referenceCode}`.toLowerCase();

  if (/(list|array|vector)/.test(text)) {
    return "array";
  }

  if (/(string|substring|palindrome|char)/.test(text)) {
    return "string";
  }

  if (/(graph|tree|node|edge)/.test(text)) {
    return "graph";
  }

  if (/(matrix|grid)/.test(text)) {
    return "matrix";
  }

  return "number";
}

function extractConstraintHints(directions) {
  const hints = [];

  if (/non[- ]?negative/i.test(directions)) {
    hints.push("non_negative");
  }

  if (/positive/i.test(directions)) {
    hints.push("positive");
  }

  if (/sorted/i.test(directions)) {
    hints.push("sorted");
  }

  if (/unique|distinct/i.test(directions)) {
    hints.push("unique");
  }

  if (/(10\^\d+|1e\d+|large|big input|up to \d+)/i.test(directions)) {
    hints.push("high_bounds");
  }

  return hints;
}

function buildCase(id, category, input, expected, rationale) {
  return {
    id,
    category,
    input,
    expected,
    rationale
  };
}

function generateArrayCases(constraints) {
  const sortedA = constraints.includes("sorted") ? [1, 2, 3, 4] : [4, 1, 3, 2];
  const sortedB = constraints.includes("sorted") ? [1, 1, 2, 3] : [3, 1, 1, 2];

  return [
    ["empty input", { arr: [] }, "depends-on-spec", "Checks base behavior with no elements."],
    ["single element", { arr: [7] }, "depends-on-spec", "Verifies minimal valid non-empty size."],
    ["small mixed values", { arr: [3, -1, 0, 5, -8] }, "depends-on-spec", "Combines negative, zero, and positive values."],
    ["already sorted", { arr: sortedA }, "depends-on-spec", "Ensures sorted input does not mask logic issues."],
    ["duplicates", { arr: sortedB }, "depends-on-spec", "Checks duplicate-handling behavior."],
    ["all equal", { arr: [9, 9, 9, 9, 9] }, "depends-on-spec", "Detects assumptions about variance."],
    ["alternating signs", { arr: [-10, 10, -20, 20, -30, 30] }, "depends-on-spec", "Catches parity and sign mistakes."],
    ["boundary extremes", { arr: [-1000000000, 0, 1000000000] }, "depends-on-spec", "Stresses integer boundary behavior."],
    ["long input", { arr: Array.from({ length: 1000 }, (_, i) => i % 17) }, "depends-on-spec", "Targets performance and repeated-pattern handling."]
  ];
}

function generateNumberCases(constraints) {
  const positiveOnly = constraints.includes("positive");

  return [
    ["zero", { n: 0 }, "depends-on-spec", "Zero is often a corner case."],
    ["one", { n: 1 }, "depends-on-spec", "Smallest common positive integer."],
    ["negative value", { n: positiveOnly ? 1 : -7 }, "depends-on-spec", "Validates sign handling and validation rules."],
    ["small positive", { n: 7 }, "depends-on-spec", "Simple correctness anchor."],
    ["large positive", { n: 1000000 }, "depends-on-spec", "Checks behavior near scale limits."],
    ["near overflow", { n: 2147483647 }, "depends-on-spec", "Stresses boundary integer arithmetic."],
    ["repeated run value", { n: 42 }, "depends-on-spec", "Useful for deterministic checks and idempotence."]
  ];
}

function generateStringCases() {
  return [
    ["empty string", { s: "" }, "depends-on-spec", "Ensures zero-length handling is explicit."],
    ["single char", { s: "a" }, "depends-on-spec", "Minimal non-empty string."],
    ["mixed case", { s: "AbCdEf" }, "depends-on-spec", "Tests case-sensitivity assumptions."],
    ["whitespace only", { s: "   " }, "depends-on-spec", "Verifies trimming/splitting behavior."],
    ["punctuation", { s: "a,b.c!" }, "depends-on-spec", "Covers non-alphanumeric characters."],
    ["unicode", { s: "naive cafe" }, "depends-on-spec", "Checks whether implementation assumes ASCII only."],
    ["palindrome", { s: "racecar" }, "depends-on-spec", "Common branch for symmetry logic."],
    ["very long", { s: "abc".repeat(5000) }, "depends-on-spec", "Stresses time and memory complexity."]
  ];
}

function generateMatrixCases() {
  return [
    ["empty matrix", { matrix: [] }, "depends-on-spec", "Validates no-row behavior."],
    ["single cell", { matrix: [[1]] }, "depends-on-spec", "Minimal 2D input case."],
    ["single row", { matrix: [[1, 2, 3, 4]] }, "depends-on-spec", "Checks row-only loops."],
    ["single column", { matrix: [[1], [2], [3]] }, "depends-on-spec", "Checks column-only loops."],
    ["rectangular", { matrix: [[1, 2, 3], [4, 5, 6]] }, "depends-on-spec", "Ensures non-square logic works."],
    ["contains negatives", { matrix: [[-1, -2], [3, 4]] }, "depends-on-spec", "Verifies sign-sensitive behavior."],
    ["large matrix", { matrix: Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => 1)) }, "depends-on-spec", "Targets algorithmic scalability."]
  ];
}

function generateGraphCases() {
  return [
    ["empty graph", { n: 0, edges: [] }, "depends-on-spec", "Validates base graph with no nodes."],
    ["single node", { n: 1, edges: [] }, "depends-on-spec", "Checks trivial connectivity."],
    ["disconnected", { n: 5, edges: [[0, 1], [3, 4]] }, "depends-on-spec", "Ensures disconnected components are handled."],
    ["simple cycle", { n: 4, edges: [[0, 1], [1, 2], [2, 3], [3, 0]] }, "depends-on-spec", "Targets cycle detection branches."],
    ["self loop", { n: 3, edges: [[1, 1]] }, "depends-on-spec", "Captures self-loop edge case."],
    ["duplicate edges", { n: 3, edges: [[0, 1], [0, 1], [1, 2]] }, "depends-on-spec", "Tests dedupe and counting logic."],
    ["large sparse", { n: 1000, edges: Array.from({ length: 999 }, (_, i) => [i, i + 1]) }, "depends-on-spec", "Stresses traversal efficiency."]
  ];
}

function casesByModel(model, constraints) {
  if (model === "array") return generateArrayCases(constraints);
  if (model === "string") return generateStringCases();
  if (model === "matrix") return generateMatrixCases();
  if (model === "graph") return generateGraphCases();
  return generateNumberCases(constraints);
}

function expandToCount(baseCases, requiredCount) {
  const output = [];
  let counter = 1;

  while (output.length < requiredCount) {
    for (const item of baseCases) {
      if (output.length >= requiredCount) break;

      const [category, input, expected, rationale] = item;
      output.push(
        buildCase(
          `TC-${String(counter).padStart(4, "0")}`,
          category,
          input,
          expected,
          rationale
        )
      );
      counter += 1;
    }
  }

  return output;
}

function generateTestCases(payload) {
  const { challengeTitle, language, directions, referenceCode, requiredCount } = payload;
  const model = inferInputModel(directions, referenceCode);
  const constraintHints = extractConstraintHints(directions);

  const baseCases = casesByModel(model, constraintHints);
  const testCases = expandToCount(baseCases, requiredCount);

  return {
    metadata: {
      challengeTitle,
      language,
      inferredInputModel: model,
      requiredCount,
      generatedCount: testCases.length,
      constraintHints,
      generatedAt: new Date().toISOString(),
      note:
        "Expected outputs are placeholders unless you enable reference execution. Always validate final answers with a trusted solution before grading."
    },
    testCases
  };
}

module.exports = {
  generateTestCases
};
