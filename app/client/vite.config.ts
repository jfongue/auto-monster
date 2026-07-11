import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Infos du dernier commit (footer "version actuelle") — lues au build, pas au runtime
// (le serveur de prod ne rejoue pas git). Fallback si .git absent (ex: build hors repo).
function commitInfo() {
  try {
    const [author, date, hash] = execSync('git log -1 --format="%an|%aI|%h"')
      .toString()
      .trim()
      .replace(/^"|"$/g, "")
      .split("|");
    return { author, date, hash };
  } catch {
    return { author: "inconnu", date: "", hash: "" };
  }
}
const commit = commitInfo();

// host: true => accessible depuis n'importe quel appareil sur le réseau local.
// proxy /api => backend Express.
export default defineConfig({
  define: {
    __COMMIT_AUTHOR__: JSON.stringify(commit.author),
    __COMMIT_DATE__: JSON.stringify(commit.date),
    __COMMIT_HASH__: JSON.stringify(commit.hash),
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
