const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function parseRunnerOutput(stdout, stderr, status) {
  const raw = (stdout || "").trim();

  if (!raw) {
    return {
      ok: false,
      error: stderr?.trim() || `Runner produced no output (exit ${status}).`
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {
      ok: false,
      error: "Runner output was not a valid object."
    };
  } catch {
    return {
      ok: false,
      error: `Could not parse runner output: ${raw.slice(0, 400)}`
    };
  }
}

function buildJavaScriptHarness(referenceCode) {
  return `
const input = JSON.parse(process.env.TEST_INPUT_JSON || "{}");
const functionName = process.env.RUN_FUNCTION_NAME || "solve";

${referenceCode}

(async () => {
  let targetFn = null;

  if (typeof globalThis[functionName] === "function") {
    targetFn = globalThis[functionName];
  } else if (
    typeof module !== "undefined" &&
    module.exports &&
    typeof module.exports[functionName] === "function"
  ) {
    targetFn = module.exports[functionName];
  }

  if (!targetFn) {
    throw new Error(
      "Function '" + functionName + "' was not found. Define it in your reference code."
    );
  }

  const result = await targetFn(input);
  process.stdout.write(JSON.stringify({ ok: true, result }));
})().catch((err) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: String(err && err.stack ? err.stack : err)
    })
  );
  process.exitCode = 1;
});
`;
}

function buildPythonHarness(referenceCode) {
  return `
import json
import os
import traceback

input_data = json.loads(os.environ.get("TEST_INPUT_JSON", "{}"))
function_name = os.environ.get("RUN_FUNCTION_NAME", "solve")

${referenceCode}

try:
    target = globals().get(function_name)
    if not callable(target):
        raise Exception(f"Function '{function_name}' was not found. Define it in your reference code.")

    result = target(input_data)
    print(json.dumps({"ok": True, "result": result}, ensure_ascii=False))
except Exception:
    print(json.dumps({"ok": False, "error": traceback.format_exc()}, ensure_ascii=False))
    raise
`;
}

function runReferenceOnce({
  language,
  referenceCode,
  functionName,
  input,
  timeoutMs = 3000
}) {
  const normalizedLanguage = (language || "").toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgeproof-"));

  try {
    let command;
    let args;
    let fileName;
    let fileContent;

    if (normalizedLanguage === "javascript" || normalizedLanguage === "js") {
      fileName = "runner.js";
      fileContent = buildJavaScriptHarness(referenceCode);
      command = "node";
      args = [fileName];
    } else if (normalizedLanguage === "python" || normalizedLanguage === "py") {
      fileName = "runner.py";
      fileContent = buildPythonHarness(referenceCode);
      command = "python3";
      args = [fileName];
    } else {
      return {
        ok: false,
        error: `Execution is currently supported for Python and JavaScript only. Got: ${language}`
      };
    }

    fs.writeFileSync(path.join(tempDir, fileName), fileContent, "utf8");

    const execution = spawnSync(command, args, {
      cwd: tempDir,
      env: {
        ...process.env,
        TEST_INPUT_JSON: JSON.stringify(input || {}),
        RUN_FUNCTION_NAME: functionName || "solve"
      },
      encoding: "utf8",
      timeout: timeoutMs
    });

    if (execution.error) {
      return {
        ok: false,
        error: `Execution failed: ${execution.error.message}`
      };
    }

    const parsed = parseRunnerOutput(execution.stdout, execution.stderr, execution.status);
    if (!parsed.ok && execution.stderr?.trim()) {
      return {
        ...parsed,
        error: `${parsed.error}\n${execution.stderr.trim()}`
      };
    }

    return parsed;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  runReferenceOnce
};
