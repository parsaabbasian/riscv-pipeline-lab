/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)', surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)', line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)', muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)', teal: 'rgb(var(--teal) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)', warn: 'rgb(var(--warn) / <alpha-value>)', bad: 'rgb(var(--bad) / <alpha-value>)',
        sif: 'rgb(var(--s-if) / <alpha-value>)', sid: 'rgb(var(--s-id) / <alpha-value>)', sex: 'rgb(var(--s-ex) / <alpha-value>)',
        smem: 'rgb(var(--s-mem) / <alpha-value>)', swb: 'rgb(var(--s-wb) / <alpha-value>)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
