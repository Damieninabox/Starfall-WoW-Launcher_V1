import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Swallow known fullscreen shortcuts (F11, Alt+Enter).
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      e.stopPropagation();
    } else if (e.altKey && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});

// --- global runtime error banner ----------------------------------------
// If anything throws outside a React render (Promise rejections, setTimeout,
// event handlers), a red banner sticks to the top of the screen with the
// message + stack instead of the UI silently going blank.

function reportRuntime(label: string, err: unknown, detail?: unknown) {
  console.error(`[runtime:${label}]`, err, detail);
  try {
    let host = document.getElementById("starfall-runtime-banner");
    if (!host) {
      host = document.createElement("div");
      host.id = "starfall-runtime-banner";
      host.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:9999;max-height:40vh;overflow:auto;" +
        "background:rgba(80,0,0,0.92);color:#fecaca;font:12px/1.4 monospace;" +
        "padding:10px 14px;border-bottom:1px solid #7f1d1d;";
      document.body.appendChild(host);
    }
    const e = err as Error | undefined;
    const msg = e?.message ?? String(err);
    const stack = e?.stack ?? "";
    const entry = document.createElement("div");
    entry.style.cssText = "margin-bottom:6px;";
    entry.innerHTML =
      `<div style="color:#fca5a5;font-weight:600">[${label}] ${escapeHtml(msg)}</div>` +
      (detail !== undefined
        ? `<pre style="white-space:pre-wrap">${escapeHtml(
            typeof detail === "string" ? detail : JSON.stringify(detail),
          )}</pre>`
        : "") +
      (stack ? `<pre style="white-space:pre-wrap">${escapeHtml(stack)}</pre>` : "");
    host.prepend(entry);
    // trim to last 5 entries
    while (host.childElementCount > 5) host.lastElementChild?.remove();
  } catch {
    // never let the error reporter itself crash the app
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

window.addEventListener("error", (e) => {
  reportRuntime("window.error", e.error ?? e.message, {
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
  });
});
window.addEventListener("unhandledrejection", (e) => {
  reportRuntime("unhandledrejection", e.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
