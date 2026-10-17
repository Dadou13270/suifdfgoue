import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_TRIAL': '"1"' },
  resolve: { alias: { 'firebase/app': resolve('src/stub.js'), 'firebase/firestore': resolve('src/stub.js'), 'firebase/auth': resolve('src/stub.js'), html2canvas: resolve('src/stub-pdf.js'), jspdf: resolve('src/stub-pdf.js') } },
  build: { outDir: 'dist-trial', cssCodeSplit: false, rollupOptions: { input: 'trial.html', output: { inlineDynamicImports: true } } },
})
