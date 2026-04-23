import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Swallow known fullscreen shortcuts (F11 toggle; Alt+Enter on some
// WebView2 builds). Also trap document fullscreen entry from any
// source (keyboard, context menu, JS) so the user can never get stuck.
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
