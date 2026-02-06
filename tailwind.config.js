/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Quicksand', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#667eea',
          dark: '#764ba2',
        },
        // New design system colors
        accent: {
          indigo: '#6366f1',
          purple: '#a855f7',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-modern': 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        'gradient-soft': 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        'max': '9999px',
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'soft-md': '0 8px 30px rgba(0, 0, 0, 0.12)',
        'soft-lg': '0 12px 40px rgba(0, 0, 0, 0.15)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)' },
        },
        'countdown': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-in-up': 'slide-in-up 0.6s ease-out',
        'slide-in-down': 'slide-in-down 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'countdown': 'countdown 1s ease-in-out',
      },
    },
  },
  plugins: [],
}

