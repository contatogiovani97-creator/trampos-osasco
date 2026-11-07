/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#02367b",
        secondary: "#6a85a7",
        accent: "#14913c",
        background: "#f0f1f3"
      }
    },
  },
  plugins: [],
}
