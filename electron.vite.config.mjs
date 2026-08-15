import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        '@components': resolve('src/renderer/src/components')
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('naive-ui') || id.includes('@vicons')) return 'vendor-ui'
            if (id.includes('markdown-it') || id.includes('dayjs')) return 'vendor-utils'
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vendor-vue'
            }
          }
        }
      }
    },
    plugins: [
      vue(),
      AutoImport({
        resolvers: [NaiveUiResolver()]
      }),
      Components({
        resolvers: [NaiveUiResolver()]
      }),
      process.env.BUNDLE_ANALYZE === '1'
        ? visualizer({
            filename: 'log/bundle-stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap'
          })
        : null
    ].filter(Boolean)
  }
})
