function setupJsonActions() {
  const outputEl = document.getElementById("jsonOutput");
  if (!outputEl) return;

  const raw = outputEl.textContent || "";
  const copyBtn = document.getElementById("copyJsonButton");
  const downloadBtn = document.getElementById("downloadJsonButton");

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(raw);
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.textContent = "Copy JSON";
        }, 1400);
      } catch {
        copyBtn.textContent = "Copy failed";
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "generated-test-cases.json";
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      if (existing.dataset.loaded === "yes") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "yes";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

function mapEditorLanguage(language) {
  const normalized = (language || "").toLowerCase();
  if (normalized === "python") return "python";
  if (normalized === "javascript") return "javascript";
  return "plaintext";
}

async function setupCodeEditors() {
  const textareas = Array.from(document.querySelectorAll("textarea[data-code-editor='true']"));
  if (!textareas.length) return;

  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js");

    await new Promise((resolve, reject) => {
      if (!window.require) {
        reject(new Error("AMD loader is unavailable."));
        return;
      }

      window.require.config({
        paths: {
          vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"
        }
      });

      window.require(["vs/editor/editor.main"], resolve, reject);
    });
  } catch (error) {
    console.error("Code editor failed to initialize:", error);
    return;
  }

  const langSelect = document.querySelector("select[name='language']");
  const editors = [];

  textareas.forEach((textarea) => {
    const host = document.createElement("div");
    host.className = "code-editor-host";

    const height = Number(textarea.dataset.editorHeight || 260);
    host.style.height = `${height}px`;

    textarea.style.display = "none";
    textarea.insertAdjacentElement("afterend", host);

    const editor = monaco.editor.create(host, {
      value: textarea.value || "",
      language: mapEditorLanguage(langSelect ? langSelect.value : ""),
      theme: "vs",
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      roundedSelection: false,
      fontSize: 14,
      lineNumbersMinChars: 3,
      fontFamily: "IBM Plex Mono, monospace"
    });

    editor.onDidChangeModelContent(() => {
      textarea.value = editor.getValue();
    });

    editors.push({ textarea, editor });
  });

  const syncEditors = () => {
    editors.forEach(({ textarea, editor }) => {
      textarea.value = editor.getValue();
    });
  };

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", syncEditors);
  });

  if (langSelect) {
    langSelect.addEventListener("change", () => {
      const lang = mapEditorLanguage(langSelect.value);
      editors.forEach(({ editor }) => {
        monaco.editor.setModelLanguage(editor.getModel(), lang);
      });
    });
  }
}

setupJsonActions();
setupCodeEditors();
