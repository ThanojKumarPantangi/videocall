import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"

export default defineConfig({
  plugins: [react()],

  define: {
    global: "globalThis",
    "process.env": {}, 
  },

  resolve: {
    alias: {
      util: "util/",
      events: "events/",
      process: "process/browser",
    },
  },

  optimizeDeps: {
    include: ["simple-peer"]
  }
})
