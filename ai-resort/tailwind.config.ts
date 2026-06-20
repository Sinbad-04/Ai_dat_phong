import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Hoàng hôn bên biển" — ocean at dusk
        midnight: "#07292B",   // anchor / ocean deep
        teal: {
          DEFAULT: "#0B3D40",
          700: "#0E4A4E",
          600: "#13615F",
        },
        jade: "#1F8A70",
        sunset: "#E0A458",     // amber accent
        coral: "#D9785F",
        mist: "#F2F5F4",       // cool paper surface
        sand: "#EDE7DA",
        ink: "#0A1F21",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(7,41,43,.06), 0 12px 32px -12px rgba(7,41,43,.18)",
        lift: "0 20px 60px -20px rgba(7,41,43,.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        rise: "rise .5s cubic-bezier(.2,.7,.2,1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
