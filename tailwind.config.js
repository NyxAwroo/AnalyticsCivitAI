/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}', './src/popup/index.html', './popup.html'],
  theme: {
    extend: {
      colors: {
        civitai: {
          accent: '#7C3AED',
          bg: '#111827',
          panel: '#1F2937',
          muted: '#9CA3AF'
        }
      }
    }
  },
  plugins: []
};
