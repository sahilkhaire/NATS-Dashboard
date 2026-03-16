/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nats-bg': '#0f1117',
        'nats-card': '#1a1d27',
        'nats-border': '#2d3148',
        'nats-accent': '#00c8b4',
        'nats-accent-2': '#4d8ff5',
        'nats-ok': '#00d4a1',
        'nats-warn': '#f5a623',
        'nats-error': '#ff4d6d',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
