/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bold Meridian brand — deep civic blue + amber "noon sun" accent.
        meridian: {
          blue: '#0C447C',
          'blue-deep': '#082f57',
          'blue-soft': '#185FA5',
          tint: '#E6F1FB',
        },
        noon: {
          sun: '#EF9F27',
          'sun-soft': '#f6b54e',
          ink: '#412402',
        },
      },
    },
  },
  plugins: [],
}
