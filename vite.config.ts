import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works at any mount path (GitHub Pages serves
  // this from /cafflife/). The app is a single page, so there is no routing
  // to worry about.
  base: "./",
  plugins: [react()],
})
