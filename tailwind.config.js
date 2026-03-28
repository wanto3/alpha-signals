/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          base: '#0d0d14',
          surface: '#141419',
          card: '#1a1a22',
          border: '#2a2a36',
          muted: '#3d3d4f',
        },
        signal: {
          buy: '#22c55e',
          sell: '#ef4444',
          hold: '#eab308',
        },
        accent: {
          primary: '#6366f1',
          glow: '#818cf8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
