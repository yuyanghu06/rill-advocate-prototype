import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#dbe4ff",
          500: "#4361ee",
          600: "#3a56d4",
          700: "#2d44b0",
        },
      },
    },
  },
  plugins: [],
};

export default config;
