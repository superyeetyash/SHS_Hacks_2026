function setupJsonActions() {
  const outputEl = document.getElementById("jsonOutput");
  if (!outputEl) return;

  const getRaw = () => outputEl.textContent || "";
  const copyBtn = document.getElementById("copyJsonButton");
  const downloadBtn = document.getElementById("downloadJsonButton");

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(getRaw());
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
      const blob = new Blob([getRaw()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "generated-test-cases.json";
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}

function prefersReducedMotion() {
  return Boolean(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function setupAutoScrollToResults() {
  const resultCard = document.querySelector(".result-card");
  const hasResult = document.getElementById("jsonOutput");
  if (!resultCard || !hasResult) return;

  const rect = resultCard.getBoundingClientRect();
  const isAlreadyVisible = rect.top >= 0 && rect.top < window.innerHeight * 0.25;
  if (isAlreadyVisible) return;

  const behavior = prefersReducedMotion() ? "auto" : "smooth";
  requestAnimationFrame(() => {
    resultCard.scrollIntoView({ behavior, block: "start" });
  });
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

function isRunnerSupported(language) {
  const normalized = (language || "").toLowerCase();
  return normalized === "python" || normalized === "javascript";
}

function setupRunnerToggleState() {
  const langSelect = document.querySelector("select[name='language']");
  if (!langSelect) return;

  const runReferenceCheckbox = document.querySelector("input[name='runCodeEnabled']");
  const runCandidateCheckbox = document.querySelector("input[name='runCandidateEnabled']");

  const updateCheckbox = (checkbox, labelOn, labelOff) => {
    if (!checkbox) return;
    const row = checkbox.closest(".checkbox-row");
    const label = row ? row.querySelector("span") : null;

    const supported = isRunnerSupported(langSelect.value);
    checkbox.disabled = !supported;
    if (!supported) checkbox.checked = false;

    if (label) {
      label.textContent = supported ? labelOn : labelOff;
    }

    if (row) {
      row.classList.toggle("is-disabled", !supported);
    }
  };

  const update = () => {
    updateCheckbox(
      runReferenceCheckbox,
      "Run reference code now",
      "Run reference code now (Python/JS only)"
    );
    updateCheckbox(
      runCandidateCheckbox,
      "Run student code against generated tests",
      "Run student code against generated tests (Python/JS only)"
    );
  };

  langSelect.addEventListener("change", update);
  update();
}

async function initCodeEditors() {
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

    if (textarea.required) {
      textarea.dataset.wasRequired = "yes";
      textarea.required = false;
    }

    textarea.style.display = "none";
    textarea.insertAdjacentElement("afterend", host);

    const editor = monaco.editor.create(host, {
      value: textarea.value || "",
      language: mapEditorLanguage(langSelect ? langSelect.value : ""),
      theme: "vs-dark",
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

    // Sync once so native form validation doesn't trip on an empty hidden textarea.
    textarea.value = editor.getValue();

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

function setupCodeEditorsOnDemand() {
  const textareas = Array.from(document.querySelectorAll("textarea[data-code-editor='true']"));
  if (!textareas.length) return;

  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    await initCodeEditors();
  };

  textareas.forEach((t) => {
    t.addEventListener("focus", () => void start(), { once: true });
    t.addEventListener("paste", () => void start(), { once: true });
  });
}

setupJsonActions();
setupAutoScrollToResults();
setupCodeEditorsOnDemand();
setupRunnerToggleState();
