/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#865221',
          light: '#a46930',
          dark: '#6a3f18',
        }
      }
    },
  },
  plugins: [],
}
