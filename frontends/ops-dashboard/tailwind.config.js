/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bold Meridian brand — deep civic blue + amber "noon sun" accent.
        // Values resolve to CSS variables (defaults in src/index.css) so one build
        // can be re-themed at runtime from the industry config. The
        // rgb(var(--x) / <alpha-value>) form preserves Tailwind opacity modifiers.
        meridian: {
          blue: 'rgb(var(--brand) / <alpha-value>)',
          'blue-deep': 'rgb(var(--brand-deep) / <alpha-value>)',
          'blue-soft': 'rgb(var(--brand-soft) / <alpha-value>)',
          tint: 'rgb(var(--brand-tint) / <alpha-value>)',
        },
        noon: {
          sun: 'rgb(var(--accent) / <alpha-value>)',
          'sun-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
