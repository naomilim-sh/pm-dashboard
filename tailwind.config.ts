import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Shopee brand orange, paired with a deep navy.
        shopee: {
          50: "#FFF3EF",
          100: "#FFE3D9",
          200: "#FFC4B0",
          300: "#FA9A7C",
          400: "#F46E4D",
          DEFAULT: "#EE4D2D",
          500: "#EE4D2D",
          600: "#D73F20",
          700: "#B3321A",
        },
        navy: {
          50: "#EEF2FA",
          200: "#B9C6E4",
          300: "#8FA3CC",
          400: "#6479A8",
          600: "#2A4274",
          700: "#1E335E",
          800: "#152648",
          900: "#0D1A36",
          950: "#081126",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
