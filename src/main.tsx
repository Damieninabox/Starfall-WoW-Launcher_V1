import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Swallow F11 so Tauri's webview can't accidentally go fullscreen with no
// obvious way out. The user can still resize via the OS decoration.
window.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    e.stopPropagation();
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
