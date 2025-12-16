/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        night: {
          50: '#f0f4ff',
          100: '#e0e8ff',
          200: '#c7d4fe',
          300: '#a5b8fc',
          400: '#8193f8',
          500: '#636ef1',
          600: '#4f4de5',
          700: '#423dca',
          800: '#3734a3',
          900: '#1e1b4b',
          950: '#0f0d2e',
        },
      },
    },
  },
  plugins: [],
};
