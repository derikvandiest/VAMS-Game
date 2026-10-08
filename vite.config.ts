import { defineConfig } from "vite";

/**
 * Vite configuration (the tool that runs/builds the browser part of the game).
 * - The browser code lives in /client.
 * - During development, requests to the server (/api and Socket.io) are
 *   forwarded to the Node server on port 3001 (see server/src/index.ts).
 * - `npm run build` writes the production files to /dist, which the Node
 *   server serves in production (one server for everything, PROJECT.md section 2).
 */
export default defineConfig({
  root: "client",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3001",
      },
    },
  },
});
