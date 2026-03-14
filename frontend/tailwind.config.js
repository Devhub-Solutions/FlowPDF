/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f0f0f5',
          100: '#e0e0ec',
          200: '#c1c1d8',
          300: '#9292bb',
          400: '#6363a0',
          500: '#3d3d7a',
          600: '#2e2e6b',
          700: '#1f1f4f',
          800: '#13133a',
          900: '#0a0a22',
          950: '#050512',
        },
        acid: {
          400: '#b8ff57',
          500: '#9fef2f',
          600: '#7ad400',
        },
        coral: {
          400: '#ff6b6b',
          500: '#ff4d4d',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 4s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
