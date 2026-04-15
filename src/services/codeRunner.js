const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RESULT_START = "__EDGEPROOF_RESULT_START__";
const RESULT_END = "__EDGEPROOF_RESULT_END__";

let cachedPythonInvocation = null;

function mergeStderr(parsedError, stderrText) {
  const base = String(parsedError || "").trim();
  const stderr = String(stderrText || "").trim();
  if (!stderr) return base;
  if (!base) return stderr;
  return base.includes(stderr) ? base : `${base}\n${stderr}`;
}

function extractMarkedResult(text) {
  const haystack = String(text || "");
  const startIndex = haystack.lastIndexOf(RESULT_START);
  if (startIndex === -1) return null;

  const from = startIndex + RESULT_START.length;
  const endIndex = haystack.indexOf(RESULT_END, from);
  if (endIndex === -1) return null;

  return haystack.slice(from, endIndex).trim();
}

function parseRunnerOutput(stdout, stderr, status) {
  const marked = extractMarkedResult(stdout);
  const raw = marked ?? (stdout || "").trim();

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
    const preview = raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;
    return {
      ok: false,
      error: `Could not parse runner output. Raw output preview: ${preview}`
    };
  }
}

function resolvePythonInvocation() {
  if (cachedPythonInvocation !== null) {
    return cachedPythonInvocation;
  }

  const candidates = [
    { command: "python3", args: [] },
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
    { command: "py", args: [] }
  ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.args, "--version"], {
      encoding: "utf8",
      timeout: 1500
    });

    if (!probe.error && probe.status === 0) {
      cachedPythonInvocation = candidate;
      return candidate;
    }
  }

  cachedPythonInvocation = false;
  return cachedPythonInvocation;
}

function buildJavaScriptHarness(referenceCode) {
  return `
const input = JSON.parse(process.env.TEST_INPUT_JSON || "{}");
const functionName = process.env.RUN_FUNCTION_NAME || "solve";
const RESULT_START = ${JSON.stringify(RESULT_START)};
const RESULT_END = ${JSON.stringify(RESULT_END)};

function isSafeIdentifier(name) {
  return typeof name === "string" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

${referenceCode}

(async () => {
  let targetFn = null;

  // Common reference snippets define function solve(...) {} (module-scoped).
  // In Node CommonJS modules this does NOT attach to globalThis, so we use a
  // guarded eval to resolve the identifier from local scope.
  if (isSafeIdentifier(functionName)) {
    try {
      // eslint-disable-next-line no-eval
      const maybeFn = eval(functionName);
      if (typeof maybeFn === "function") {
        targetFn = maybeFn;
      }
    } catch {
      // ignore
    }
  }

  if (!targetFn && typeof globalThis[functionName] === "function") {
    targetFn = globalThis[functionName];
  } else if (
    !targetFn &&
    typeof module !== "undefined" &&
    module.exports &&
    typeof module.exports[functionName] === "function"
  ) {
    targetFn = module.exports[functionName];
  } else if (!targetFn && typeof exports !== "undefined" && typeof exports[functionName] === "function") {
    targetFn = exports[functionName];
  }

  if (!targetFn) {
    throw new Error(
      "Function '" + functionName + "' was not found. Define it in your reference code."
    );
  }

  const result = await targetFn(input);
  process.stdout.write(RESULT_START + JSON.stringify({ ok: true, result }) + RESULT_END);
})().catch((err) => {
  process.stdout.write(
    RESULT_START +
      JSON.stringify({
        ok: false,
        error: String(err && err.stack ? err.stack : err)
      }) +
      RESULT_END
  );
  process.exitCode = 1;
});
`;
}

function buildJavaScriptBatchHarness(referenceCode) {
  return `
const inputs = JSON.parse(process.env.TEST_INPUT_JSON || "[]");
const functionName = process.env.RUN_FUNCTION_NAME || "solve";
const RESULT_START = ${JSON.stringify(RESULT_START)};
const RESULT_END = ${JSON.stringify(RESULT_END)};

function isSafeIdentifier(name) {
  return typeof name === "string" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

${referenceCode}

(async () => {
  if (!Array.isArray(inputs)) {
    throw new Error("Batch runner expected an array of inputs.");
  }

  let targetFn = null;

  // Common reference snippets define function solve(...) {} (module-scoped).
  // In Node CommonJS modules this does NOT attach to globalThis, so we use a
  // guarded eval to resolve the identifier from local scope.
  if (isSafeIdentifier(functionName)) {
    try {
      // eslint-disable-next-line no-eval
      const maybeFn = eval(functionName);
      if (typeof maybeFn === "function") {
        targetFn = maybeFn;
      }
    } catch {
      // ignore
    }
  }

  if (!targetFn && typeof globalThis[functionName] === "function") {
    targetFn = globalThis[functionName];
  } else if (
    !targetFn &&
    typeof module !== "undefined" &&
    module.exports &&
    typeof module.exports[functionName] === "function"
  ) {
    targetFn = module.exports[functionName];
  } else if (!targetFn && typeof exports !== "undefined" && typeof exports[functionName] === "function") {
    targetFn = exports[functionName];
  }

  if (!targetFn) {
    throw new Error(
      "Function '" + functionName + "' was not found. Define it in your reference code."
    );
  }

  const results = [];
  for (const input of inputs) {
    try {
      const value = await targetFn(input);
      results.push({ ok: true, result: value });
    } catch (err) {
      results.push({
        ok: false,
        error: String(err && err.stack ? err.stack : err)
      });
    }
  }

  process.stdout.write(RESULT_START + JSON.stringify({ ok: true, results }) + RESULT_END);
})().catch((err) => {
  process.stdout.write(
    RESULT_START +
      JSON.stringify({
        ok: false,
        error: String(err && err.stack ? err.stack : err)
      }) +
      RESULT_END
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
result_start = ${JSON.stringify(RESULT_START)}
result_end = ${JSON.stringify(RESULT_END)}

${referenceCode}

try:
    target = globals().get(function_name)
    if not callable(target):
        raise Exception(f"Function '{function_name}' was not found. Define it in your reference code.")

    result = target(input_data)
    print(result_start + json.dumps({"ok": True, "result": result}, ensure_ascii=False) + result_end)
except Exception:
    print(result_start + json.dumps({"ok": False, "error": traceback.format_exc()}, ensure_ascii=False) + result_end)
    raise
`;
}

function buildPythonBatchHarness(referenceCode) {
  return `
import json
import os
import traceback

inputs = json.loads(os.environ.get("TEST_INPUT_JSON", "[]"))
function_name = os.environ.get("RUN_FUNCTION_NAME", "solve")
result_start = ${JSON.stringify(RESULT_START)}
result_end = ${JSON.stringify(RESULT_END)}

${referenceCode}

try:
  if not isinstance(inputs, list):
    raise Exception("Batch runner expected a JSON array of inputs.")

  target = globals().get(function_name)
  if not callable(target):
    raise Exception(f"Function '{function_name}' was not found. Define it in your reference code.")

  results = []
  for input_data in inputs:
    try:
      results.append({"ok": True, "result": target(input_data)})
    except Exception:
      results.append({"ok": False, "error": traceback.format_exc()})

  print(result_start + json.dumps({"ok": True, "results": results}, ensure_ascii=False) + result_end)
except Exception:
  print(result_start + json.dumps({"ok": False, "error": traceback.format_exc()}, ensure_ascii=False) + result_end)
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
      command = process.execPath;
      args = [fileName];
    } else if (normalizedLanguage === "python" || normalizedLanguage === "py") {
      fileName = "runner.py";
      fileContent = buildPythonHarness(referenceCode);

      const python = resolvePythonInvocation();
      if (!python) {
        return {
          ok: false,
          error:
            "Python interpreter was not found. Install Python (or ensure `python`/`python3`/`py` is on PATH) to run reference execution."
        };
      }

      command = python.command;
      args = [...python.args, fileName];
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
        error:
          execution.error.code === "ETIMEDOUT"
            ? `Execution timed out after ${timeoutMs}ms.`
            : `Execution failed: ${execution.error.message}`
      };
    }

    const parsed = parseRunnerOutput(execution.stdout, execution.stderr, execution.status);
    if (!parsed.ok && execution.stderr?.trim()) {
      return {
        ...parsed,
        error: mergeStderr(parsed.error, execution.stderr)
      };
    }

    return parsed;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runReferenceBatch({
  language,
  referenceCode,
  functionName,
  inputs,
  timeoutMs = 15000
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
      fileContent = buildJavaScriptBatchHarness(referenceCode);
      command = process.execPath;
      args = [fileName];
    } else if (normalizedLanguage === "python" || normalizedLanguage === "py") {
      fileName = "runner.py";
      fileContent = buildPythonBatchHarness(referenceCode);

      const python = resolvePythonInvocation();
      if (!python) {
        return {
          ok: false,
          error:
            "Python interpreter was not found. Install Python (or ensure `python`/`python3`/`py` is on PATH) to run reference execution."
        };
      }

      command = python.command;
      args = [...python.args, fileName];
    } else {
      return {
        ok: false,
        error: `Execution is currently supported for Python and JavaScript only. Got: ${language}`
      };
    }

    const inputArray = Array.isArray(inputs) ? inputs : [];
    fs.writeFileSync(path.join(tempDir, fileName), fileContent, "utf8");

    const execution = spawnSync(command, args, {
      cwd: tempDir,
      env: {
        ...process.env,
        TEST_INPUT_JSON: JSON.stringify(inputArray),
        RUN_FUNCTION_NAME: functionName || "solve"
      },
      encoding: "utf8",
      timeout: timeoutMs
    });

    if (execution.error) {
      return {
        ok: false,
        error:
          execution.error.code === "ETIMEDOUT"
            ? `Execution timed out after ${timeoutMs}ms.`
            : `Execution failed: ${execution.error.message}`
      };
    }

    const parsed = parseRunnerOutput(execution.stdout, execution.stderr, execution.status);
    if (!parsed.ok && execution.stderr?.trim()) {
      return {
        ...parsed,
        error: mergeStderr(parsed.error, execution.stderr)
      };
    }

    if (parsed.ok && (!parsed.results || !Array.isArray(parsed.results))) {
      return {
        ok: false,
        error: "Batch runner output was missing a results array."
      };
    }

    return parsed;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  runReferenceOnce,
  runReferenceBatch
};
