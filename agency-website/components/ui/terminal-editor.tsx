"use client";

import * as React from "react";

import type { Extension } from "@codemirror/state";
import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json as jsonLanguage } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";

import { cn } from "@/lib/utils";

export type TerminalEditorLanguage = "javascript" | "python" | "json" | "text";

const terminalThemeOverrides = EditorView.theme(
  {
    "&": {
      backgroundColor: "#0b0f14",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
    },
    ".cm-content": {
      padding: "10px 0",
      caretColor: "#7dd3fc",
    },
    ".cm-line": {
      padding: "0 10px",
    },
    ".cm-gutters": {
      backgroundColor: "#0b0f14",
      color: "rgba(148, 163, 184, 0.8)",
      borderRight: "1px solid rgba(255, 255, 255, 0.08)",
    },
    ".cm-gutterElement": {
      padding: "0 8px 0 10px",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.035)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.035)",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(56, 189, 248, 0.35)",
    },
    ".cm-cursor": {
      borderLeftColor: "#7dd3fc",
    },
    ".cm-placeholder": {
      color: "rgba(148, 163, 184, 0.7)",
    },
  },
  { dark: true }
);

function languageExtensions(language: TerminalEditorLanguage): Extension[] {
  switch (language) {
    case "javascript":
      return [javascript({ jsx: true, typescript: true })];
    case "python":
      return [python()];
    case "json":
      return [jsonLanguage()];
    default:
      return [];
  }
}

export function TerminalEditor({
  value,
  onChange,
  language = "text",
  placeholder,
  ariaLabel,
  height,
  minHeight,
  maxHeight,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  language?: TerminalEditorLanguage;
  placeholder?: string;
  ariaLabel?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}) {
  const extensions = React.useMemo(() => {
    const ext: Extension[] = [terminalThemeOverrides, ...languageExtensions(language)];
    if (placeholder) ext.push(placeholderExtension(placeholder));
    return ext;
  }, [language, placeholder]);

  return (
    <div
      className={cn(
        "rounded-md border border-foreground/15 shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        "overflow-hidden",
        className
      )}
    >
      <CodeMirror
        value={value}
        theme={oneDark}
        extensions={extensions}
        onChange={onChange}
        height={height}
        minHeight={minHeight}
        maxHeight={maxHeight}
        aria-label={ariaLabel}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          allowMultipleSelections: true,
          rectangularSelection: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          historyKeymap: true,
          lintKeymap: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
