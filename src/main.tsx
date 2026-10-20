import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./ui/styles.css";
import "./ui/split-compact.css";
import "./ui/badges.css";
import "./ui/slate.css";
import "./ui/density.css";
// A file dropped outside a drop zone must not replace the app with the file.
for (const type of ["dragover", "drop"] as const)
  window.addEventListener(type, (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    if (type === "dragover" && !event.defaultPrevented)
      event.dataTransfer.dropEffect = "none";
    event.preventDefault();
  });
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
