/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:    '#080c14',
        bg2:   '#0d1420',
        bg3:   '#111927',
        bg4:   '#162030',
        blue:  '#1a6fff',
        blue2: '#2d85ff',
        cyan:  '#00d4ff',
        green: '#00e5a0',
        red:   '#ff4060',
        amber: '#ffb020',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
