/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./frontend/**/*.{html,js}",
    "./frontend/components/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        // Texas flag color theme (exact specifications)
        'texas-red': {
          DEFAULT: '#BF0A30',
          light: '#dc2626',
          lighter: '#f87171',
          lightest: '#fecaca',
          dark: '#991b1b',
          darker: '#7f1d1d',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D'
        },
        'texas-blue': {
          DEFAULT: '#002868',
          light: '#1e3a8a',
          lighter: '#3b82f6',
          lightest: '#dbeafe',
          dark: '#001a4d',
          darker: '#001233',
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E'
        },
        'texas-white': {
          DEFAULT: '#FFFFFF'
        },
        // Status colors matching Texas theme
        'status': {
          'filed': '#FEF3C7',      // Yellow for Filed
          'committee': '#DBEAFE',   // Blue for In Committee  
          'passed': '#D1FAE5'       // Green for Passed
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'serif': ['Georgia', 'serif']
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}