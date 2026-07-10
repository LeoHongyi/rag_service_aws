import typography from '@tailwindcss/typography';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default {
  content: [`${webRoot}index.html`, `${webRoot}src/**/*.{js,ts,jsx,tsx}`],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#165DFF', dark: '#044AE9', light: '#F0F5FF', border: '#E8ECFF' },
        text: { primary: '#151515', secondary: '#6C6F7D' },
        bg: { page: '#F8FAFF', hover: '#F0F5FF' },
      },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'] },
      boxShadow: { card: '0 4px 16px rgba(22, 93, 255, 0.08)', 'card-hover': '0 12px 32px rgba(22, 93, 255, 0.15)', btn: '0 4px 12px rgba(22, 93, 255, 0.3)', modal: '0 20px 60px rgba(0, 0, 0, 0.15)' },
      borderRadius: { card: '16px', btn: '6px', input: '12px' },
      animation: { 'slide-in-left': 'slideInLeft 0.25s ease-out', 'slide-in-up': 'slideInUp 0.25s ease-out', 'fade-in': 'fadeIn 0.15s ease', blink: 'blink 0.7s infinite' },
    },
  },
  plugins: [typography],
};
