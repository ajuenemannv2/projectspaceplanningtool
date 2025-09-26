// Vite configuration for multi-page build targeting static hosting (e.g., Power Pages)
// - Uses relative base so assets work when uploaded as Web Files
// - Builds three entry HTML pages: index, logistics-map, admin
// - Outputs to ./dist

import { resolve } from 'path'

/** @type {import('vite').UserConfig} */
export default {
    base: './',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
                logistics: resolve(__dirname, 'logistics-map.html'),
                admin: resolve(__dirname, 'admin.html')
            },
            output: {
                // Stable-ish file names for easier Web File referencing (optional)
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    },
    server: {
        open: '/index.html'
    }
}


