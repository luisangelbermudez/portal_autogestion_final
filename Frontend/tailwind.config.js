/** Paleta original del portal, ahora como tokens de Tailwind. */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', '"Segoe UI"', "Arial", "sans-serif"] },
      colors: {
        navy: { 950: "#071a4d", 900: "#0A2266", 800: "#0F2F80", 700: "#1B4FBF", 600: "#2E6BE6", 100: "#e3ecff", 50: "#f1f5ff" },
        amber: { DEFAULT: "#EF9F27", 300: "#F6B84A", 600: "#B5790A", 800: "#7a5300", 50: "#FFF6E5" },
        ok: { DEFAULT: "#1B7F3A", dark: "#14602b", bg: "#EAF7EE" },
        err: { DEFAULT: "#B83232", dark: "#8f2020", bg: "#FCEBEB" },
        ink: { DEFAULT: "#1a1f2e", muted: "#4a5675", soft: "#e3e7f0" },
        lienzo: "#f4f6fb",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,47,128,.06), 0 8px 24px -12px rgba(15,47,128,.18)",
        lift: "0 14px 32px -12px rgba(15,47,128,.35)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(16px)" }, "100%": { opacity: 1, transform: "none" } },
        "fade-in": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "scale-in": { "0%": { opacity: 0, transform: "scale(.94)" }, "100%": { opacity: 1, transform: "none" } },
        "slide-right": { "0%": { opacity: 0, transform: "translateX(-14px)" }, "100%": { opacity: 1, transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        gradient: { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        shine: { "0%": { transform: "translateX(-120%)" }, "100%": { transform: "translateX(220%)" } },
        ring: { "0%": { boxShadow: "0 0 0 0 rgba(239,159,39,.55)" }, "100%": { boxShadow: "0 0 0 14px rgba(239,159,39,0)" } },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.2,.7,.2,1) both",
        "fade-in": "fade-in .5s ease both",
        "scale-in": "scale-in .35s cubic-bezier(.2,.7,.2,1) both",
        "slide-right": "slide-right .5s cubic-bezier(.2,.7,.2,1) both",
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite",
        gradient: "gradient 14s ease infinite",
        shine: "shine 3.2s ease-in-out infinite",
        ring: "ring 2.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
