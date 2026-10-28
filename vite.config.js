import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    target: 'es2020', chunkSizeWarningLimit: 4000,
    // 两个入口：编辑器（/）与纯预览页（/view）
    rollupOptions: { input: { main: 'index.html', view: 'view.html' } },
  },
})
