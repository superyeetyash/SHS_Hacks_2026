"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CryptoBackdrop, DecryptText, ThemeToggle } from "@/components/crypto-template";
import { HelixGate } from "@/components/helix-gate";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { MonacoTerminalEditor } from "@/components/ui/monaco-terminal-editor";
import { TerminalEditor } from "@/components/ui/terminal-editor";

import type { GeneratedSuite } from "@/lib/edgeproof/types";

type Language = "javascript" | "python";

type FormState = {
  title: string;
  directions: string;
  language: Language;
  functionName: string;
  requiredCount: number;
  seed: string;
  exampleDescription: string;
  exampleInputJson: string;
  runReference: boolean;
  referenceCode: string;
  runStudent: boolean;
  studentCode: string;
};

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function EdgeproofApp() {
  const [form, setForm] = useState<FormState>({
    title: "",
    directions: "",
    language: "javascript",
    functionName: "solve",
    requiredCount: 20,
    seed: "",
    exampleDescription: "",
    exampleInputJson: "",
    runReference: true,
    referenceCode: "",
    runStudent: false,
    studentCode: "",
  });

  const [suite, setSuite] = useState<GeneratedSuite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRetesting, setIsRetesting] = useState(false);

  const suiteSummary = useMemo(() => {
    if (!suite) return null;
    const expectedReadyCount = suite.testCases.filter((t) => t.expectedReady).length;
    const studentPassCount = suite.testCases.filter((t) => t.studentPass === true).length;
    const studentFailCount = suite.testCases.filter((t) => t.studentPass === false).length;
    const studentErrorCount = suite.testCases.filter((t) => Boolean(t.studentError)).length;
    return { expectedReadyCount, studentPassCount, studentFailCount, studentErrorCount };
  }, [suite]);

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);

    try {
      let exampleInput: unknown | undefined;
      if (form.exampleInputJson.trim()) {
        try {
          exampleInput = JSON.parse(form.exampleInputJson);
        } catch {
          throw new Error("Example input JSON must be valid JSON.");
        }
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeTitle: form.title,
          directions: form.directions,
          language: form.language,
          functionName: form.functionName,
          requiredCount: form.requiredCount,
          runReference: form.runReference,
          referenceCode: form.referenceCode,
          runStudent: form.runStudent,
          studentCode: form.runStudent ? form.studentCode : undefined,
          exampleInput,
          exampleDescription: form.exampleDescription || undefined,
        }),
      });

      const body = (await res.json()) as { ok: boolean; suite?: GeneratedSuite; error?: string };
      if (!res.ok || !body.ok || !body.suite) {
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      setSuite(body.suite);
    } catch (e) {
      setSuite(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRetest() {
    if (!suite) return;
    setError(null);
    setIsRetesting(true);

    try {
      const res = await fetch("/api/retest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          suite,
          functionName: form.functionName,
          studentCode: form.studentCode,
        }),
      });

      const body = (await res.json()) as { ok: boolean; suite?: GeneratedSuite; error?: string };
      if (!res.ok || !body.ok || !body.suite) {
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      setSuite(body.suite);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRetesting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <CryptoBackdrop />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3" onClick={(e) => e.preventDefault()} aria-disabled="true">
            <div className="bg-foreground/10 text-foreground inline-flex size-10 items-center justify-center rounded-lg border">
              <span className="font-mono text-xs">01</span>
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-semibold tracking-tight">
                <DecryptText text="Edgeproof" />
              </div>
              <div className="text-muted-foreground text-xs">
                <DecryptText text="Testcase Generator" />
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-4">
            <Link
              href="/#services"
              className="text-muted-foreground hover:text-foreground text-sm"
              onClick={(e) => e.preventDefault()}
              aria-disabled="true"
            >
              <DecryptText text="SERVICES" className="font-mono" />
            </Link>
            <Link
              href="/#work"
              className="text-muted-foreground hover:text-foreground text-sm"
              onClick={(e) => e.preventDefault()}
              aria-disabled="true"
            >
              <DecryptText text="WORK" className="font-mono" />
            </Link>
            <Link
              href="/#process"
              className="text-muted-foreground hover:text-foreground text-sm"
              onClick={(e) => e.preventDefault()}
              aria-disabled="true"
            >
              <DecryptText text="PROCESS" className="font-mono" />
            </Link>
            <ThemeToggle />
          </nav>
        </header>

        <section className="flex flex-col gap-6 pt-6">
          <Badge variant="secondary" className="w-fit">
            <DecryptText text="EDGE • PROOF • CLEAN" className="font-mono text-[11px]" />
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              <DecryptText text="Edgeproof" className="text-foreground font-mono" />
              <DecryptText text="Testcase Generator." className="text-muted-foreground block" />
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm">
              <DecryptText text="Generate edge-case-heavy suites from a prompt and optional reference solution, then evaluate student code." />
            </p>
          </div>
        </section>

        <Separator className="bg-border/60" />

        {error && (
          <Alert variant="destructive">
            <AlertTitle>
              <DecryptText text="Something went wrong" />
            </AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
          </Alert>
        )}

        {!error && (!form.title || !form.directions || !form.referenceCode) && (
          <Alert>
            <AlertTitle>
              <DecryptText text="Ready when you are" />
            </AlertTitle>
            <AlertDescription>
              <DecryptText text="Please provide challenge title, directions, and reference code." />
              {form.runStudent ? <DecryptText text=" Add student code to evaluate too." /> : null}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>
                <DecryptText text="Generate" />
              </CardTitle>
              <CardDescription>
                <DecryptText text="Fill out the prompt and generate a suite." />
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">
                  <DecryptText text="Challenge title" />
                </Label>
                <TerminalEditor
                  value={form.title}
                  onChange={(value) => setForm((p) => ({ ...p, title: value }))}
                  placeholder="Two Sum, Longest Substring..."
                  ariaLabel="Challenge title"
                  minHeight="44px"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="language">
                    <DecryptText text="Language" />
                  </Label>
                  <select
                    id="language"
                    className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm font-mono shadow-xs outline-none focus-visible:ring-[3px]"
                    value={form.language}
                    onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as Language }))}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="requiredCount">
                    <DecryptText text="Test count" />
                  </Label>
                  <Input
                    id="requiredCount"
                    type="number"
                    min={1}
                    max={200}
                    value={String(form.requiredCount)}
                    onChange={(e) => setForm((p) => ({ ...p, requiredCount: Number(e.target.value) }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="seed">
                    <DecryptText text="Seed (optional)" />
                  </Label>
                  <TerminalEditor
                    value={form.seed}
                    onChange={(value) => setForm((p) => ({ ...p, seed: value }))}
                    placeholder="leave blank for random"
                    ariaLabel="Seed (optional)"
                    minHeight="44px"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="functionName">
                    <DecryptText text="Function name" />
                  </Label>
                  <TerminalEditor
                    value={form.functionName}
                    onChange={(value) => setForm((p) => ({ ...p, functionName: value }))}
                    placeholder="solve"
                    ariaLabel="Function name"
                    minHeight="44px"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium">
                      <DecryptText text="Run reference code" />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      <DecryptText text="Computes expected outputs." />
                    </div>
                  </div>
                  <Switch
                    checked={form.runReference}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, runReference: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="directions">
                  <DecryptText text="Directions / prompt" />
                </Label>
                <TerminalEditor
                  value={form.directions}
                  onChange={(value) => setForm((p) => ({ ...p, directions: value }))}
                  placeholder="Explain the problem, input/output, and constraints..."
                  ariaLabel="Directions / prompt"
                  minHeight="128px"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="referenceCode">
                  <DecryptText text="Reference solution" />
                </Label>
                <MonacoTerminalEditor
                  value={form.referenceCode}
                  onChange={(value) => setForm((p) => ({ ...p, referenceCode: value }))}
                  placeholder={
                    form.language === "python"
                      ? "def solve(input_data):\n    ..."
                      : "function solve(input) {\n  ...\n}"
                  }
                  ariaLabel="Reference solution"
                  language={form.language}
                  path={form.language === "python" ? "reference.py" : "reference.js"}
                  minHeight="176px"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col">
                  <div className="text-sm font-medium">
                    <DecryptText text="Evaluate student code" />
                  </div>
                  <div className="text-muted-foreground text-xs">
                    <DecryptText text="Compares against expected outputs." />
                  </div>
                </div>
                <Switch
                  checked={form.runStudent}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, runStudent: checked }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="studentCode">
                  <DecryptText text="Student code" />
                </Label>
                <MonacoTerminalEditor
                  value={form.studentCode}
                  onChange={(value) => setForm((p) => ({ ...p, studentCode: value }))}
                  placeholder={
                    form.language === "python"
                      ? "def solve(input_data):\n    ..."
                      : "function solve(input) {\n  ...\n}"
                  }
                  ariaLabel="Student code"
                  language={form.language}
                  path={form.language === "python" ? "student.py" : "student.js"}
                  minHeight="176px"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="exampleDescription">
                    <DecryptText text="Example description (optional)" />
                  </Label>
                  <TerminalEditor
                    value={form.exampleDescription}
                    onChange={(value) => setForm((p) => ({ ...p, exampleDescription: value }))}
                    placeholder="Optional example run"
                    ariaLabel="Example description (optional)"
                    minHeight="44px"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="exampleInputJson">
                    <DecryptText text="Example input JSON (optional)" />
                  </Label>
                  <TerminalEditor
                    value={form.exampleInputJson}
                    onChange={(value) => setForm((p) => ({ ...p, exampleInputJson: value }))}
                    placeholder='{"arr":[1,2,3]}'
                    ariaLabel="Example input JSON (optional)"
                    language="json"
                    minHeight="44px"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <DecryptText text="Generating..." trigger="click" />
                ) : (
                  <DecryptText text="Generate suite" trigger="click" />
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>
                <DecryptText text="Results" />
              </CardTitle>
              <CardDescription>
                <DecryptText text="Latest generated suite and evaluation summary." />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!suite ? (
                <div className="text-muted-foreground text-sm">
                  <DecryptText text="No suite yet." />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{suite.metadata.language}</Badge>
                    <Badge variant="outline">{suite.metadata.inferredInputModel}</Badge>
                    <Badge variant="outline">
                      {suite.metadata.generatedCount}/{suite.metadata.requiredCount} cases
                    </Badge>
                  </div>

                  {suite.metadata.constraintHints.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {suite.metadata.constraintHints.map((hint) => (
                        <Badge key={hint} variant="outline">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {suite.execution && (
                    <div className="rounded-md border p-3 text-sm">
                      <div className="font-medium">
                        <DecryptText text="Reference execution" />
                      </div>
                      <div className="text-muted-foreground text-xs">
                        <DecryptText text="Function:" /> {suite.execution.functionName}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          <DecryptText text="OK:" /> {suite.execution.successCount}
                        </Badge>
                        <Badge variant={suite.execution.failedCount ? "destructive" : "secondary"}>
                          <DecryptText text="Failed:" /> {suite.execution.failedCount}
                        </Badge>
                        {suiteSummary && (
                          <Badge variant="outline">
                            <DecryptText text="Expected ready:" /> {suiteSummary.expectedReadyCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {suite.studentEvaluation && (
                    <div className="rounded-md border p-3 text-sm">
                      <div className="font-medium">
                        <DecryptText text="Student evaluation" />
                      </div>
                      <div className="text-muted-foreground text-xs">
                        <DecryptText text="Function:" /> {suite.studentEvaluation.functionName}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          <DecryptText text="Pass:" /> {suite.studentEvaluation.passCount}
                        </Badge>
                        <Badge variant={suite.studentEvaluation.failCount ? "destructive" : "secondary"}>
                          <DecryptText text="Fail:" /> {suite.studentEvaluation.failCount}
                        </Badge>
                        <Badge variant={suite.studentEvaluation.errorCount ? "destructive" : "secondary"}>
                          <DecryptText text="Errors:" /> {suite.studentEvaluation.errorCount}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {suite.exampleRun && (
                    <div className="rounded-md border p-3 text-sm">
                      <div className="font-medium">
                        <DecryptText text="Example run" />
                      </div>
                      <div className="text-muted-foreground text-xs">{suite.exampleRun.description}</div>
                      <div className="mt-2 grid gap-2">
                        <div>
                          <div className="text-xs font-medium">
                            <DecryptText text="Input" />
                          </div>
                          <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">{toPrettyJson(suite.exampleRun.input)}</pre>
                        </div>
                        {suite.exampleRun.error ? (
                          <div>
                            <div className="text-xs font-medium">
                              <DecryptText text="Error" />
                            </div>
                            <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">{suite.exampleRun.error}</pre>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs font-medium">
                              <DecryptText text="Output" />
                            </div>
                            <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">{toPrettyJson(suite.exampleRun.output)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">
                      <DecryptText text="Retest existing cases" />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      <DecryptText text="Paste student code and re-run against the current suite." />
                    </div>
                    <div className="mt-3 grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="retestFunctionName">
                          <DecryptText text="Function name" />
                        </Label>
                        <TerminalEditor
                          value={form.functionName}
                          onChange={(value) => setForm((p) => ({ ...p, functionName: value }))}
                          ariaLabel="Function name"
                          minHeight="44px"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="retestStudentCode">
                          <DecryptText text="Student code" />
                        </Label>
                        <MonacoTerminalEditor
                          value={form.studentCode}
                          onChange={(value) => setForm((p) => ({ ...p, studentCode: value }))}
                          ariaLabel="Student code"
                          language={form.language}
                          path={form.language === "python" ? "retest-student.py" : "retest-student.js"}
                          minHeight="128px"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleRetest} disabled={isRetesting}>
                          {isRetesting ? (
                            <DecryptText text="Retesting..." trigger="click" />
                          ) : (
                            <DecryptText text="Retest" trigger="click" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="text-muted-foreground text-xs">
              <DecryptText text="Reference/student code runs server-side; avoid untrusted code." />
            </CardFooter>
          </Card>
        </div>

        {suite && (
          <Card className="bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>
                <DecryptText text="Test cases" />
              </CardTitle>
              <CardDescription>
                {suite.metadata.generatedCount} <DecryptText text="cases. Expand a case to view inputs/outputs/errors." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {suite.testCases.map((testCase) => {
                  const showPass = testCase.expectedReady;
                  const statusBadge = testCase.studentPass
                    ? { label: "PASS", variant: "default" as const }
                    : showPass && testCase.studentPass === false
                      ? { label: "FAIL", variant: "destructive" as const }
                      : null;

                  return (
                    <AccordionItem key={testCase.id} value={testCase.id}>
                      <AccordionTrigger>
                        <div className="flex w-full flex-wrap items-center gap-2 pr-3">
                          <span className="font-mono text-xs">{testCase.id}</span>
                          <span className="text-muted-foreground text-xs">{testCase.category}</span>
                          {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
                          {testCase.executionError && (
                            <Badge variant="destructive">
                              <DecryptText text="REF ERROR" />
                            </Badge>
                          )}
                          {testCase.studentError && (
                            <Badge variant="destructive">
                              <DecryptText text="STUDENT ERROR" />
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4">
                          <div>
                            <div className="text-xs font-medium">
                              <DecryptText text="Rationale" />
                            </div>
                            <div className="text-muted-foreground text-xs">{testCase.rationale}</div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-2">
                            <div>
                              <div className="text-xs font-medium">
                                <DecryptText text="Input" />
                              </div>
                              <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">{toPrettyJson(testCase.input)}</pre>
                            </div>
                            <div>
                              <div className="text-xs font-medium">
                                <DecryptText text="Expected" />
                              </div>
                              <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">
                                {toPrettyJson(testCase.expected)}
                              </pre>
                            </div>
                          </div>

                          {testCase.executionError && (
                            <div>
                              <div className="text-xs font-medium">
                                <DecryptText text="Reference error" />
                              </div>
                              <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">{testCase.executionError}</pre>
                            </div>
                          )}

                          {(testCase.studentError || testCase.studentOutput !== undefined) && (
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div>
                                <div className="text-xs font-medium">
                                  <DecryptText text="Student output" />
                                </div>
                                <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">
                                  {toPrettyJson(testCase.studentOutput)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-xs font-medium">
                                  <DecryptText text="Student error" />
                                </div>
                                <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">
                                  {testCase.studentError ? testCase.studentError : <DecryptText text="(none)" />}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <HelixGate onComplete={() => setEntered(true)} />;
  }

  return <EdgeproofApp />;
}
