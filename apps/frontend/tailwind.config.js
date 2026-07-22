/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          accent: 'var(--color-accent)',
          background: 'var(--color-background)',
          surface: 'var(--color-surface)',
          text: 'var(--color-text)',
        },
      },
    },
  },
  plugins: [],
};
