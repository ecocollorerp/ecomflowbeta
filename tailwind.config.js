/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{tsx,ts,jsx,js}",
  ],
  theme: {
    extend: {
      colors: {
        // Adicionar cores customizadas aqui se necessário
      },
    },
  },
  plugins: [],
  // Modo JIT é padrão no Tailwind v3+
  mode: 'jit',
}
