/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5e6ff',
          100: '#e6ccff',
          200: '#cc99ff',
          300: '#b366ff',
          400: '#9933ff',
          500: '#7c00b0',
          600: '#63008c',
          700: '#4a0068',
          800: '#320045',
          900: '#190022',
        },
        gold: {
          50: '#fef9e6',
          100: '#fdf2cc',
          200: '#fbe599',
          300: '#f9d866',
          400: '#f7cb33',
          500: '#D4AF37',
          600: '#b8942e',
          700: '#9c7a25',
          800: '#805f1c',
          900: '#644413',
        },
      },
      fontFamily: {
        'display': ['Syne', 'DM Sans', 'sans-serif'],
        'myanmar': ['Pyidaungsu', 'DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}