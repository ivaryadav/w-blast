import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",   // ⭐ VERY IMPORTANT

  plugins: [react()],

  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});