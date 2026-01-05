/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0f766e',
          dark: '#115e59',
        },
        secondary: {
          DEFAULT: '#f97316',
          dark: '#ea580c',
        },
        background: '#f6f2ec',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
