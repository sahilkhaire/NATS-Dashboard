/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // All values are driven by CSS variables so themes work at runtime.
        // Variables hold space-separated RGB channels (e.g. "15 17 23")
        // enabling Tailwind opacity modifiers like bg-nats-bg/50 to work.
        'nats-bg':             'rgb(var(--nats-bg)    / <alpha-value>)',
        'nats-card':           'rgb(var(--nats-card)  / <alpha-value>)',
        'nats-border':         'rgb(var(--nats-border)/ <alpha-value>)',
        'nats-accent':         'rgb(var(--nats-accent)/ <alpha-value>)',
        'nats-accent-2':       'rgb(var(--nats-accent-2)/<alpha-value>)',
        'nats-ok':             'rgb(var(--nats-ok)    / <alpha-value>)',
        'nats-warn':           'rgb(var(--nats-warn)  / <alpha-value>)',
        'nats-error':          'rgb(var(--nats-error) / <alpha-value>)',
        'nats-text-primary':   'rgb(var(--nats-text-primary)  / <alpha-value>)',
        'nats-text-secondary': 'rgb(var(--nats-text-secondary)/ <alpha-value>)',
        'nats-text-muted':     'rgb(var(--nats-text-muted)    / <alpha-value>)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
