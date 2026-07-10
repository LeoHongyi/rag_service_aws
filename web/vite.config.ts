import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@aws-amplify') || id.includes('aws-amplify')) return 'amplify';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          if (id.includes('mermaid') || id.includes('cytoscape') || id.includes('dagre')) return 'diagrams';
          if (id.includes('codemirror') || id.includes('@uiw/react-codemirror')) return 'editor';
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-') || id.includes('highlight.js')) return 'markdown';
          return undefined;
        },
      },
    },
  },
});
