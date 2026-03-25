/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        myanmar: ['Pyidaungsu', 'Noto Sans Myanmar', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fdf2ff',
          100: '#f5d9ff',
          200: '#ecb3ff',
          300: '#dc7aff',
          400: '#c942ff',
          500: '#a200e6',
          600: '#7c00b0',
          700: '#5e0085',
          800: '#420060',
          900: '#280040',
        },
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#D4AF37',
          600: '#b8930a',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
    },
  },
  plugins: [],
}