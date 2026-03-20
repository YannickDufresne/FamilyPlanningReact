import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = '/' en dev, '/FamilyPlanningReact/' en production (GitHub Pages)
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/FamilyPlanningReact/',
}))
