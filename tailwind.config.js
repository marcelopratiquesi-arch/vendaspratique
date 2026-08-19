/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 🔥 A MÁGICA DO DARK MODE AQUI! Destrava o botão.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // FAZ LER OS EFEITOS NAS PASTAS
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}