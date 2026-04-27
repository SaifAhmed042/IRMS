/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rail: {
          50:  '#EEF2FB',
          100: '#D7DFF4',
          200: '#A9B7E3',
          300: '#7B8FD2',
          400: '#4D67C1',
          500: '#1E3A8A',
          600: '#192F6F',
          700: '#142555',
          800: '#0F1B3B',
          900: '#0A1228',
        },
        ok:    '#10B981',
        warn:  '#F59E0B',
        danger:'#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 27, 59, 0.04), 0 8px 24px rgba(15, 27, 59, 0.06)',
      },
    },
  },
  plugins: [],
};
