/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f1f4f9',
          100: '#e1e8f2',
          200: '#c2d1e5',
          300: '#a3b9d9',
          400: '#84a2cc',
          500: '#5c70c2',
          600: '#3E54AC', // Brand Medium Blue
          700: '#2f4082',
          800: '#1f2b58',
          900: '#0A2463', // Brand Dark Blue
          950: '#06163b',
        },
        accent: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
