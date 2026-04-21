import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { parseEdgeproofLanguage } from "@/lib/edgeproof/languages";
import type { RunBatchResult, RunOnceResult } from "@/lib/edgeproof/types";

const RESULT_START = "__EDGEPROOF_RESULT_START__";
const RESULT_END = "__EDGEPROOF_RESULT_END__";

type PythonInvocation = { command: string; args: string[] } | false;
type JavaToolchain = { javac: string; java: string } | false;
type CSharpCompiler =
  | { kind: "csc" | "mcs" | "dotnet-csc"; command: string; compilerPath?: string }
  | false;
type CommandBinary = string | false;

type ExecutionPlan = {
  fileName: string;
  fileContent: string;
  runCommand: string;
  runArgs: string[];
  compileCommand?: string;
  compileArgs?: string[];
  envExtras?: Record<string, string>;
};

let cachedPythonInvocation: PythonInvocation | null = null;
let cachedJavaToolchain: JavaToolchain | null = null;
let cachedCCompiler: CommandBinary | null = null;
let cachedCppCompiler: CommandBinary | null = null;
let cachedRustCompiler: CommandBinary | null = null;
let cachedCSharpCompiler: CSharpCompiler | null = null;
let cachedMonoBinary: CommandBinary | null = null;
let cachedDotnetBinary: CommandBinary | null = null;

function isSafeIdentifier(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function mergeStderr(parsedError: unknown, stderrText: unknown) {
  const base = String(parsedError || "").trim();
  const stderr = String(stderrText || "").trim();
  if (!stderr) return base;
  if (!base) return stderr;
  return base.includes(stderr) ? base : `${base}\n${stderr}`;
}

function extractMarkedResult(text: unknown) {
  const haystack = String(text || "");
  const startIndex = haystack.lastIndexOf(RESULT_START);
  if (startIndex === -1) return null;

  const from = startIndex + RESULT_START.length;
  const endIndex = haystack.indexOf(RESULT_END, from);
  if (endIndex === -1) return null;

  return haystack.slice(from, endIndex).trim();
}

function maybeParseJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!/^[\[{"\d\-tfn]/.test(trimmed)) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeParsedRunnerResult(parsed: any) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (!parsed.ok) return parsed;

  if (Object.prototype.hasOwnProperty.call(parsed, "result")) {
    parsed.result = maybeParseJsonString(parsed.result);
  }

  if (Array.isArray(parsed.results)) {
    parsed.results = parsed.results.map((entry: any) => {
      if (!entry || typeof entry !== "object") return entry;
      if (!entry.ok) return entry;
      return {
        ...entry,
        result: maybeParseJsonString(entry.result),
      };
    });
  }

  return parsed;
}

function parseRunnerOutput(stdout: string, stderr: string, status: number | null): any {
  const marked = extractMarkedResult(stdout);
  const raw = marked ?? (stdout || "").trim();

  if (!raw) {
    return {
      ok: false,
      error: stderr?.trim() || `Runner produced no output (exit ${status}).`,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return normalizeParsedRunnerResult(parsed);
    }

    return { ok: false, error: "Runner output was not a valid object." };
  } catch {
    const preview = raw.length > 800 ? `${raw.slice(0, 800)}...` : raw;
    return {
      ok: false,
      error: `Could not parse runner output. Raw output preview: ${preview}`,
    };
  }
}

function commandAvailable(command: string, args: string[] = ["--version"]) {
  const probe = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 1500,
  });

  return !probe.error && probe.status === 0;
}

function firstAvailableCommand(candidates: Array<{ command: string; args?: string[] }>): CommandBinary {
  for (const candidate of candidates) {
    if (commandAvailable(candidate.command, candidate.args ?? ["--version"])) {
      return candidate.command;
    }
  }

  return false;
}

function resolvePythonInvocation(): PythonInvocation {
  if (cachedPythonInvocation !== null) {
    return cachedPythonInvocation;
  }

  const candidates = [
    { command: "python3", args: [] },
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
    { command: "py", args: [] },
  ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.args, "--version"], {
      encoding: "utf8",
      timeout: 1500,
    });

    if (!probe.error && probe.status === 0) {
      cachedPythonInvocation = candidate;
      return candidate;
    }
  }

  cachedPythonInvocation = false;
  return cachedPythonInvocation;
}

function resolveJavaToolchain(): JavaToolchain {
  if (cachedJavaToolchain !== null) return cachedJavaToolchain;

  const javac = firstAvailableCommand([{ command: "javac", args: ["-version"] }]);
  const java = firstAvailableCommand([{ command: "java", args: ["-version"] }]);

  if (!javac || !java) {
    cachedJavaToolchain = false;
    return cachedJavaToolchain;
  }

  cachedJavaToolchain = { javac, java };
  return cachedJavaToolchain;
}

function resolveCCompiler(): CommandBinary {
  if (cachedCCompiler !== null) return cachedCCompiler;

  cachedCCompiler = firstAvailableCommand([
    { command: "gcc" },
    { command: "clang" },
    { command: "cc" },
  ]);

  return cachedCCompiler;
}

function resolveCppCompiler(): CommandBinary {
  if (cachedCppCompiler !== null) return cachedCppCompiler;

  cachedCppCompiler = firstAvailableCommand([
    { command: "g++" },
    { command: "clang++" },
    { command: "c++" },
  ]);

  return cachedCppCompiler;
}

function resolveRustCompiler(): CommandBinary {
  if (cachedRustCompiler !== null) return cachedRustCompiler;

  cachedRustCompiler = firstAvailableCommand([{ command: "rustc" }]);
  return cachedRustCompiler;
}

function resolveCSharpCompiler(): CSharpCompiler {
  if (cachedCSharpCompiler !== null) return cachedCSharpCompiler;

  if (commandAvailable("csc", ["-version"])) {
    cachedCSharpCompiler = { kind: "csc", command: "csc" };
    return cachedCSharpCompiler;
  }

  if (commandAvailable("mcs", ["--version"])) {
    cachedCSharpCompiler = { kind: "mcs", command: "mcs" };
    return cachedCSharpCompiler;
  }

  const dotnet = resolveDotnetBinary();
  if (dotnet) {
    const sdks = spawnSync(dotnet, ["--list-sdks"], { encoding: "utf8", timeout: 1500 });
    if (!sdks.error && sdks.status === 0) {
      const sdkLine = String(sdks.stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .pop();

      const sdkMatch = sdkLine?.match(/^([^\s]+)\s+\[(.+)\]$/);
      if (sdkMatch) {
        const sdkVersion = sdkMatch[1];
        const sdkBasePath = sdkMatch[2];
        const cscPath = path.join(sdkBasePath, sdkVersion, "Roslyn", "bincore", "csc.dll");
        if (fs.existsSync(cscPath)) {
          cachedCSharpCompiler = { kind: "dotnet-csc", command: dotnet, compilerPath: cscPath };
          return cachedCSharpCompiler;
        }
      }
    }
  }

  cachedCSharpCompiler = false;
  return cachedCSharpCompiler;
}

function resolveMonoBinary(): CommandBinary {
  if (cachedMonoBinary !== null) return cachedMonoBinary;

  cachedMonoBinary = firstAvailableCommand([{ command: "mono" }]);
  return cachedMonoBinary;
}

function resolveDotnetBinary(): CommandBinary {
  if (cachedDotnetBinary !== null) return cachedDotnetBinary;

  cachedDotnetBinary = firstAvailableCommand([{ command: "dotnet", args: ["--info"] }]);
  return cachedDotnetBinary;
}

function buildJavaScriptHarness(referenceCode: string) {
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
        error: String(err && err.stack ? err.stack : err),
      }) +
      RESULT_END
  );
  process.exitCode = 1;
});
`;
}

function buildJavaScriptBatchHarness(referenceCode: string) {
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
      results.push({ ok: false, error: String(err && err.stack ? err.stack : err) });
    }
  }

  process.stdout.write(RESULT_START + JSON.stringify({ ok: true, results }) + RESULT_END);
})().catch((err) => {
  process.stdout.write(
    RESULT_START +
      JSON.stringify({
        ok: false,
        error: String(err && err.stack ? err.stack : err),
      }) +
      RESULT_END
  );
  process.exitCode = 1;
});
`;
}

function buildPythonHarness(referenceCode: string) {
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

function buildPythonBatchHarness(referenceCode: string) {
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

function buildJavaRunnerWrapper() {
  return `
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;

class Runner {
  private static final String RESULT_START = ${JSON.stringify(RESULT_START)};
  private static final String RESULT_END = ${JSON.stringify(RESULT_END)};

  private static String escapeJson(String input) {
    if (input == null) return "";
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < input.length(); i++) {
      char ch = input.charAt(i);
      switch (ch) {
        case '\\\\': sb.append("\\\\\\\\"); break;
        case '"': sb.append("\\\\\""); break;
        case '\\b': sb.append("\\\\b"); break;
        case '\\f': sb.append("\\\\f"); break;
        case '\\n': sb.append("\\\\n"); break;
        case '\\r': sb.append("\\\\r"); break;
        case '\\t': sb.append("\\\\t"); break;
        default:
          if (ch < 0x20) {
            sb.append(String.format("\\\\u%04x", (int) ch));
          } else {
            sb.append(ch);
          }
      }
    }
    return sb.toString();
  }

  private static String quoteJson(String input) {
    return "\"" + escapeJson(input) + "\"";
  }

  public static void main(String[] args) {
    String functionName = System.getenv().getOrDefault("RUN_FUNCTION_NAME", "solve");
    String inputJson = System.getenv().getOrDefault("TEST_INPUT_JSON", "{}");

    try {
      Class<?> clazz = Class.forName("Solution");
      Method target = null;
      for (Method m : clazz.getDeclaredMethods()) {
        if (m.getName().equals(functionName) && m.getParameterCount() == 1) {
          target = m;
          break;
        }
      }

      if (target == null) {
        throw new RuntimeException("Function '" + functionName + "' was not found. Define it in class Solution.");
      }

      target.setAccessible(true);
      Object receiver = Modifier.isStatic(target.getModifiers()) ? null : clazz.getDeclaredConstructor().newInstance();
      Object raw = target.invoke(receiver, inputJson);
      String rendered = raw == null ? "null" : String.valueOf(raw);

      System.out.print(RESULT_START + "{\\\"ok\\\":true,\\\"result\\\":" + quoteJson(rendered) + "}" + RESULT_END);
    } catch (Throwable err) {
      Throwable base = err.getCause() != null ? err.getCause() : err;
      String message = String.valueOf(base);
      System.out.print(RESULT_START + "{\\\"ok\\\":false,\\\"error\\\":" + quoteJson(message) + "}" + RESULT_END);
      System.exit(1);
    }
  }
}
`;
}

function buildCHarness(functionName: string) {
  return `
#include <stdio.h>
#include <stdlib.h>

static void print_json_string(const char* s) {
  if (!s) {
    printf("\"\"");
    return;
  }

  putchar('\\"');
  for (const unsigned char* p = (const unsigned char*)s; *p; ++p) {
    unsigned char c = *p;
    switch (c) {
      case '\\\\': fputs("\\\\\\\\", stdout); break;
      case '\\"': fputs("\\\\\"", stdout); break;
      case '\\b': fputs("\\\\b", stdout); break;
      case '\\f': fputs("\\\\f", stdout); break;
      case '\\n': fputs("\\\\n", stdout); break;
      case '\\r': fputs("\\\\r", stdout); break;
      case '\\t': fputs("\\\\t", stdout); break;
      default:
        if (c < 32) {
          fprintf(stdout, "\\\\u%04x", c);
        } else {
          fputc(c, stdout);
        }
    }
  }
  putchar('\\"');
}

int main(void) {
  const char* input_json = getenv("TEST_INPUT_JSON");
  if (!input_json) input_json = "{}";

  const char* result = ${functionName}(input_json);
  if (!result) result = "null";

  printf(${JSON.stringify(RESULT_START)} "{\\\"ok\\\":true,\\\"result\\\":");
  print_json_string(result);
  printf("}" ${JSON.stringify(RESULT_END)});
  return 0;
}
`;
}

function buildCppHarness(functionName: string) {
  return `
#include <iostream>
#include <sstream>
#include <string>

static std::string escape_json(const std::string& input) {
  std::ostringstream out;
  for (unsigned char c : input) {
    switch (c) {
      case '\\\\': out << "\\\\\\\\"; break;
      case '\\"': out << "\\\\\\\""; break;
      case '\\b': out << "\\\\b"; break;
      case '\\f': out << "\\\\f"; break;
      case '\\n': out << "\\\\n"; break;
      case '\\r': out << "\\\\r"; break;
      case '\\t': out << "\\\\t"; break;
      default:
        if (c < 32) {
          out << "\\\\u";
          const char* hex = "0123456789abcdef";
          out << "00" << hex[(c >> 4) & 0xF] << hex[c & 0xF];
        } else {
          out << static_cast<char>(c);
        }
    }
  }
  return out.str();
}

template <typename T>
static std::string to_output_string(const T& value) {
  std::ostringstream out;
  out << value;
  return out.str();
}

static std::string to_output_string(const std::string& value) {
  return value;
}

static std::string to_output_string(const char* value) {
  return value ? std::string(value) : std::string("null");
}

int main() {
  const char* env = std::getenv("TEST_INPUT_JSON");
  std::string input_json = env ? std::string(env) : std::string("{}");

  auto raw = ${functionName}(input_json);
  std::string rendered = to_output_string(raw);

  std::cout << ${JSON.stringify(RESULT_START)}
            << "{\\\"ok\\\":true,\\\"result\\\":\\\""
            << escape_json(rendered)
            << "\\\"}"
            << ${JSON.stringify(RESULT_END)};

  return 0;
}
`;
}

function buildRustHarness(functionName: string) {
  return `
fn escape_json(input: &str) -> String {
    let mut out = String::with_capacity(input.len() + 8);
    for ch in input.chars() {
        match ch {
            '\\\\' => out.push_str("\\\\\\\\"),
            '\"' => out.push_str("\\\\\""),
            '\\n' => out.push_str("\\\\n"),
            '\\r' => out.push_str("\\\\r"),
            '\\t' => out.push_str("\\\\t"),
            '\\u{08}' => out.push_str("\\\\b"),
            '\\u{0c}' => out.push_str("\\\\f"),
            c if c.is_control() => out.push_str(&format!("\\\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

fn print_ok(result: &str) {
    print!(
        "{}{{\\\"ok\\\":true,\\\"result\\\":\\\"{}\\\"}}{}",
        ${JSON.stringify(RESULT_START)},
        escape_json(result),
        ${JSON.stringify(RESULT_END)}
    );
}

fn print_err(message: &str) {
    print!(
        "{}{{\\\"ok\\\":false,\\\"error\\\":\\\"{}\\\"}}{}",
        ${JSON.stringify(RESULT_START)},
        escape_json(message),
        ${JSON.stringify(RESULT_END)}
    );
}

fn main() {
    let input_json = std::env::var("TEST_INPUT_JSON").unwrap_or_else(|_| "{}".to_string());

    let output = std::panic::catch_unwind(|| ${functionName}(input_json.clone()));
    match output {
        Ok(value) => {
            let rendered = value.to_string();
            print_ok(&rendered);
        }
        Err(_) => {
            print_err("Execution panicked.");
            std::process::exit(1);
        }
    }
}
`;
}

function buildCSharpHarness() {
  return `
using System;
using System.Linq;
using System.Reflection;

public static class Runner
{
    private static string EscapeJson(string value)
    {
        if (value == null) return string.Empty;
        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\b", "\\b")
            .Replace("\f", "\\f")
            .Replace("\n", "\\n")
            .Replace("\r", "\\r")
            .Replace("\t", "\\t");
    }

    private static string QuoteJson(string value) => "\"" + EscapeJson(value ?? string.Empty) + "\"";

    public static int Main()
    {
        var functionName = Environment.GetEnvironmentVariable("RUN_FUNCTION_NAME") ?? "solve";
        var inputJson = Environment.GetEnvironmentVariable("TEST_INPUT_JSON") ?? "{}";

        try
        {
            var solutionType = AppDomain.CurrentDomain
                .GetAssemblies()
                .SelectMany(a =>
                {
                    try { return a.GetTypes(); }
                    catch { return Array.Empty<Type>(); }
                })
                .FirstOrDefault(t => t.Name == "Solution");

            if (solutionType == null)
            {
                throw new Exception("Class 'Solution' was not found. Define it in your reference code.");
            }

            var method = solutionType
                .GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance)
                .FirstOrDefault(m => m.Name == functionName && m.GetParameters().Length == 1);

            if (method == null)
            {
                throw new Exception("Function '" + functionName + "' was not found. Define it in class Solution.");
            }

            object instance = method.IsStatic ? null : Activator.CreateInstance(solutionType);
            var raw = method.Invoke(instance, new object[] { inputJson });
            var rendered = raw == null ? "null" : raw.ToString();

            Console.Write(${JSON.stringify(RESULT_START)} + "{\\\"ok\\\":true,\\\"result\\\":" + QuoteJson(rendered) + "}" + ${JSON.stringify(RESULT_END)});
            return 0;
        }
        catch (Exception ex)
        {
            var baseError = ex.InnerException ?? ex;
            Console.Write(${JSON.stringify(RESULT_START)} + "{\\\"ok\\\":false,\\\"error\\\":" + QuoteJson(baseError.ToString()) + "}" + ${JSON.stringify(RESULT_END)});
            return 1;
        }
    }
}
`;
}

function buildSqlHarness() {
  return `
import json
import os
import sqlite3
import traceback

result_start = ${JSON.stringify(RESULT_START)}
result_end = ${JSON.stringify(RESULT_END)}
query = os.environ.get("SQL_QUERY", "")
input_data = json.loads(os.environ.get("TEST_INPUT_JSON", "{}"))

try:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE input_data (payload TEXT NOT NULL)")
    conn.execute("INSERT INTO input_data(payload) VALUES (?)", (json.dumps(input_data, ensure_ascii=False),))

    cursor = conn.execute(query)
    if cursor.description:
        columns = [c[0] for c in cursor.description]
        rows = cursor.fetchall()
        result = {"columns": columns, "rows": rows}
    else:
        result = {"rowsAffected": cursor.rowcount}

    print(result_start + json.dumps({"ok": True, "result": result}, ensure_ascii=False) + result_end)
except Exception:
    print(result_start + json.dumps({"ok": False, "error": traceback.format_exc()}, ensure_ascii=False) + result_end)
    raise
`;
}

function executePlan({
  tempDir,
  plan,
  timeoutMs,
  functionName,
  input,
}: {
  tempDir: string;
  plan: ExecutionPlan;
  timeoutMs: number;
  functionName: string;
  input: unknown;
}): RunOnceResult {
  fs.writeFileSync(path.join(tempDir, plan.fileName), plan.fileContent, "utf8");

  if (plan.compileCommand && plan.compileArgs) {
    const compilation = spawnSync(plan.compileCommand, plan.compileArgs, {
      cwd: tempDir,
      encoding: "utf8",
      timeout: Math.max(3000, Math.min(30000, timeoutMs * 3)),
    });

    if (compilation.error || compilation.status !== 0) {
      const reason = compilation.error
        ? `Compilation failed: ${compilation.error.message}`
        : `Compilation failed with exit code ${compilation.status}.`;
      const details = [compilation.stdout, compilation.stderr].filter(Boolean).map((s) => String(s).trim()).join("\n");
      return {
        ok: false,
        error: details ? `${reason}\n${details}` : reason,
      };
    }
  }

  const execution = spawnSync(plan.runCommand, plan.runArgs, {
    cwd: tempDir,
    env: {
      ...process.env,
      TEST_INPUT_JSON: JSON.stringify(input ?? {}),
      RUN_FUNCTION_NAME: functionName || "solve",
      ...(plan.envExtras || {}),
    },
    encoding: "utf8",
    timeout: timeoutMs,
  });

  if (execution.error) {
    return {
      ok: false,
      error:
        (execution.error as NodeJS.ErrnoException).code === "ETIMEDOUT"
          ? `Execution timed out after ${timeoutMs}ms.`
          : `Execution failed: ${execution.error.message}`,
    };
  }

  const parsed = parseRunnerOutput(execution.stdout, execution.stderr, execution.status);
  if (!parsed.ok && execution.stderr?.trim()) {
    return {
      ...parsed,
      error: mergeStderr((parsed as any).error, execution.stderr),
    };
  }

  return parsed as RunOnceResult;
}

function languageSupportsNativeBatch(normalizedLanguage: string) {
  return normalizedLanguage === "javascript" || normalizedLanguage === "python";
}

export function runReferenceOnce({
  language,
  referenceCode,
  functionName,
  input,
  timeoutMs = 3000,
}: {
  language: string;
  referenceCode: string;
  functionName: string;
  input: unknown;
  timeoutMs?: number;
}): RunOnceResult {
  const parsedLanguage = parseEdgeproofLanguage(String(language || ""));
  const normalizedLanguage = parsedLanguage ?? String(language || "").toLowerCase();
  const safeFunctionName = String(functionName || "solve").trim() || "solve";

  if (["c", "cpp", "rust"].includes(normalizedLanguage) && !isSafeIdentifier(safeFunctionName)) {
    return {
      ok: false,
      error: `Function name '${safeFunctionName}' is invalid for ${normalizedLanguage}. Use a valid identifier like solve.`,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgeproof-"));

  try {
    let plan: ExecutionPlan | null = null;

    if (normalizedLanguage === "javascript") {
      plan = {
        fileName: "runner.js",
        fileContent: buildJavaScriptHarness(referenceCode),
        runCommand: process.execPath,
        runArgs: ["runner.js"],
      };
    } else if (normalizedLanguage === "python") {
      const python = resolvePythonInvocation();
      if (!python) {
        return {
          ok: false,
          error:
            "Python interpreter was not found. Install Python (or ensure `python`/`python3`/`py` is on PATH) to run execution.",
        };
      }

      plan = {
        fileName: "runner.py",
        fileContent: buildPythonHarness(referenceCode),
        runCommand: python.command,
        runArgs: [...python.args, "runner.py"],
      };
    } else if (normalizedLanguage === "sql") {
      const python = resolvePythonInvocation();
      if (!python) {
        return {
          ok: false,
          error:
            "Python interpreter was not found. Install Python (or ensure `python`/`python3`/`py` is on PATH) to run SQL execution.",
        };
      }

      plan = {
        fileName: "runner_sql.py",
        fileContent: buildSqlHarness(),
        runCommand: python.command,
        runArgs: [...python.args, "runner_sql.py"],
        envExtras: {
          SQL_QUERY: referenceCode,
        },
      };
    } else if (normalizedLanguage === "java") {
      const java = resolveJavaToolchain();
      if (!java) {
        return {
          ok: false,
          error: "Java toolchain was not found. Install `javac` and `java` to run Java execution.",
        };
      }

      plan = {
        fileName: "Solution.java",
        fileContent: `${referenceCode}\n\n${buildJavaRunnerWrapper()}`,
        compileCommand: java.javac,
        compileArgs: ["Solution.java"],
        runCommand: java.java,
        runArgs: ["Runner"],
      };
    } else if (normalizedLanguage === "c") {
      const cCompiler = resolveCCompiler();
      if (!cCompiler) {
        return {
          ok: false,
          error: "C compiler was not found. Install `gcc`, `clang`, or `cc` to run C execution.",
        };
      }

      const outputName = process.platform === "win32" ? "runner.exe" : "runner";
      plan = {
        fileName: "runner.c",
        fileContent: `${referenceCode}\n\n${buildCHarness(safeFunctionName)}`,
        compileCommand: cCompiler,
        compileArgs: ["runner.c", "-O2", "-std=c11", "-o", outputName],
        runCommand: path.join(tempDir, outputName),
        runArgs: [],
      };
    } else if (normalizedLanguage === "cpp") {
      const cppCompiler = resolveCppCompiler();
      if (!cppCompiler) {
        return {
          ok: false,
          error: "C++ compiler was not found. Install `g++`, `clang++`, or `c++` to run C++ execution.",
        };
      }

      const outputName = process.platform === "win32" ? "runner.exe" : "runner";
      plan = {
        fileName: "runner.cpp",
        fileContent: `${referenceCode}\n\n${buildCppHarness(safeFunctionName)}`,
        compileCommand: cppCompiler,
        compileArgs: ["runner.cpp", "-O2", "-std=c++17", "-o", outputName],
        runCommand: path.join(tempDir, outputName),
        runArgs: [],
      };
    } else if (normalizedLanguage === "rust") {
      const rustCompiler = resolveRustCompiler();
      if (!rustCompiler) {
        return {
          ok: false,
          error: "Rust compiler was not found. Install `rustc` to run Rust execution.",
        };
      }

      const outputName = process.platform === "win32" ? "runner.exe" : "runner";
      plan = {
        fileName: "runner.rs",
        fileContent: `${referenceCode}\n\n${buildRustHarness(safeFunctionName)}`,
        compileCommand: rustCompiler,
        compileArgs: ["runner.rs", "-O", "-o", outputName],
        runCommand: path.join(tempDir, outputName),
        runArgs: [],
      };
    } else if (normalizedLanguage === "csharp") {
      const compiler = resolveCSharpCompiler();
      if (!compiler) {
        return {
          ok: false,
          error: "C# compiler was not found. Install `csc`, `mcs`, or the .NET SDK to run C# execution.",
        };
      }

      const outputName = "runner.exe";
      let runCommand = path.join(tempDir, outputName);
      let runArgs: string[] = [];

      if (process.platform !== "win32") {
        const mono = resolveMonoBinary();
        if (mono) {
          runCommand = mono;
          runArgs = [outputName];
        } else {
          const dotnet = resolveDotnetBinary();
          if (dotnet) {
            runCommand = dotnet;
            runArgs = [outputName];
          } else {
            return {
              ok: false,
              error: "C# runtime was not found. Install `mono` or `dotnet` to run compiled C# output.",
            };
          }
        }
      }

      const compileArgs =
        compiler.kind === "csc"
          ? ["/nologo", `/out:${outputName}`, "runner.cs"]
          : compiler.kind === "mcs"
            ? ["-nologo", `-out:${outputName}`, "runner.cs"]
            : [compiler.compilerPath as string, "/nologo", `/out:${outputName}`, "runner.cs"];

      plan = {
        fileName: "runner.cs",
        fileContent: `${referenceCode}\n\n${buildCSharpHarness()}`,
        compileCommand: compiler.command,
        compileArgs,
        runCommand,
        runArgs,
      };
    }

    if (!plan) {
      return {
        ok: false,
        error: `Execution is not supported for language: ${language}`,
      };
    }

    return executePlan({
      tempDir,
      plan,
      timeoutMs,
      functionName: safeFunctionName,
      input,
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function runReferenceBatch({
  language,
  referenceCode,
  functionName,
  inputs,
  timeoutMs = 15000,
}: {
  language: string;
  referenceCode: string;
  functionName: string;
  inputs: unknown[];
  timeoutMs?: number;
}): RunBatchResult {
  const parsedLanguage = parseEdgeproofLanguage(String(language || ""));
  const normalizedLanguage = parsedLanguage ?? String(language || "").toLowerCase();
  const inputArray = Array.isArray(inputs) ? inputs : [];

  if (!languageSupportsNativeBatch(normalizedLanguage)) {
    const perCaseTimeout = Math.max(
      1000,
      Math.min(12000, Math.floor(timeoutMs / Math.max(1, inputArray.length)) + 500)
    );

    const results = inputArray.map((input) => {
      const once = runReferenceOnce({
        language: normalizedLanguage,
        referenceCode,
        functionName,
        input,
        timeoutMs: perCaseTimeout,
      });

      if (once.ok) {
        return { ok: true as const, result: once.result };
      }

      return { ok: false as const, error: once.error };
    });

    return {
      ok: true,
      results,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgeproof-"));

  try {
    let command: string;
    let args: string[];
    let fileName: string;
    let fileContent: string;

    if (normalizedLanguage === "javascript") {
      fileName = "runner.js";
      fileContent = buildJavaScriptBatchHarness(referenceCode);
      command = process.execPath;
      args = [fileName];
    } else if (normalizedLanguage === "python") {
      const python = resolvePythonInvocation();
      if (!python) {
        return {
          ok: false,
          error:
            "Python interpreter was not found. Install Python (or ensure `python`/`python3`/`py` is on PATH) to run execution.",
        };
      }

      fileName = "runner.py";
      fileContent = buildPythonBatchHarness(referenceCode);
      command = python.command;
      args = [...python.args, fileName];
    } else {
      return {
        ok: false,
        error: `Execution is not supported for language: ${language}`,
      };
    }

    fs.writeFileSync(path.join(tempDir, fileName), fileContent, "utf8");

    const execution = spawnSync(command, args, {
      cwd: tempDir,
      env: {
        ...process.env,
        TEST_INPUT_JSON: JSON.stringify(inputArray),
        RUN_FUNCTION_NAME: functionName || "solve",
      },
      encoding: "utf8",
      timeout: timeoutMs,
    });

    if (execution.error) {
      return {
        ok: false,
        error:
          (execution.error as NodeJS.ErrnoException).code === "ETIMEDOUT"
            ? `Execution timed out after ${timeoutMs}ms.`
            : `Execution failed: ${execution.error.message}`,
      };
    }

    const parsed = parseRunnerOutput(execution.stdout, execution.stderr, execution.status);
    if (!parsed.ok && execution.stderr?.trim()) {
      return {
        ...parsed,
        error: mergeStderr((parsed as any).error, execution.stderr),
      };
    }

    if (parsed.ok && !Array.isArray((parsed as any).results)) {
      return {
        ok: false,
        error: "Batch runner output was missing a results array.",
      };
    }

    return parsed as RunBatchResult;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
