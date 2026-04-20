"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

export type MonacoTerminalEditorLanguage = "javascript" | "python" | "json" | "text";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
});

function toMonacoLanguage(language: MonacoTerminalEditorLanguage): string {
  switch (language) {
    case "javascript":
      return "javascript";
    case "python":
      return "python";
    case "json":
      return "json";
    default:
      return "plaintext";
  }
}

export function MonacoTerminalEditor({
  value,
  onChange,
  language = "text",
  placeholder,
  ariaLabel,
  path,
  height,
  minHeight,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  language?: MonacoTerminalEditorLanguage;
  placeholder?: string;
  ariaLabel?: string;
  path?: string;
  height?: string;
  minHeight?: string;
  className?: string;
}) {
  const resolvedHeight = height ?? minHeight ?? "200px";

  const beforeMount = React.useCallback((monaco: any) => {
    monaco.editor.defineTheme("edgeproof-terminal-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0b0f14",
        "editorLineNumber.foreground": "#94a3b8cc",
        "editorLineNumber.activeForeground": "#e2e8f0",
        "editorCursor.foreground": "#7dd3fc",
        "editor.selectionBackground": "#38bdf859",
        "editor.inactiveSelectionBackground": "#38bdf833",
        "editor.lineHighlightBackground": "#ffffff09",
        "editorGutter.background": "#0b0f14",
      },
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      checkJs: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
    });
  }, []);

  return (
    <div
      className={cn(
        "rounded-md border border-foreground/15 shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        "overflow-hidden",
        className
      )}
    >
      <MonacoEditor
        value={value}
        onChange={(next) => onChange(next ?? "")}
        beforeMount={beforeMount}
        theme="edgeproof-terminal-dark"
        language={toMonacoLanguage(language)}
        path={path}
        height={resolvedHeight}
        options={{
          ariaLabel: ariaLabel,
          placeholder,
          automaticLayout: true,
          fontFamily:
            "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 13,
          lineHeight: 20,
          minimap: { enabled: false },
          renderLineHighlight: "all",
          scrollBeyondLastLine: false,
          wordWrap: "off",
          folding: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          bracketPairColorization: { enabled: true },
          cursorBlinking: "smooth",
          formatOnPaste: true,
          formatOnType: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          suggestOnTriggerCharacters: true,
          parameterHints: { enabled: true },
          inlineSuggest: { enabled: true },
        }}
      />
    </div>
  );
}
