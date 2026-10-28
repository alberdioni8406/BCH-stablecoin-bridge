import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bch: {
          DEFAULT: "#0AC18E",
          dark: "#088F6A",
          light: "#12E0A8",
        },
        surface: {
          DEFAULT: "#0D0F12",
          raised: "#15181E",
          overlay: "#1C2028",
          border: "#2A2F3A",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
