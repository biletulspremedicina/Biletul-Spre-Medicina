/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f7f4',
          100: '#dbede4',
          150: '#c8e3d4',
          200: '#b9dbca',
          300: '#8bc2a8',
          400: '#5aa183',
          500: '#3a8563',
          600: '#2a6b4e',
          700: '#225540',
          800: '#1e4534',
          900: '#19382c',
        },
        accent: {
          50: '#fff8ed',
          100: '#ffefd4',
          150: '#ffe6bb',
          200: '#ffdba8',
          300: '#ffc070',
          400: '#ff9a37',
          500: '#f97e0f',
          600: '#ea6510',
          700: '#c24c0e',
          800: '#9a3c12',
          900: '#7c3312',
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2.5s ease-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(0)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
