/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./admin.html",
    "./app.js",
    "./admin.js",
    "./products-data.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fefce8',
          100: '#fef9c3',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          900: '#713f12',
        },
        economax: {
          yellow: '#ffc72c',
          red: '#dc2626',
          darkRed: '#b91c1c',
          blue: '#0284c7'
        }
      }
    },
  },
  plugins: [],
}
