import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Theme color definitions according to UI.md
        indigo: {
          50: '#f4f5fa',
          100: '#e9ebf5',
          200: '#d7dbe9',
          300: '#b9c1d9',
          400: '#919dc3',
          500: '#6d7baa',
          600: '#4e5b8e', // premium steel-blue accent
          700: '#3f4b75',
          800: '#323b5d',
          900: '#252a42',
          950: '#12141f',
        },
        slate: {
          50: '#f9f9fb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#18181b', // dark mode card
          850: '#121215', // dark mode border/panel intermediate
          900: '#0a0a0c', // dark mode bg
          950: '#030304',
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      boxShadow: {
        'glow-indigo': '0 0 15px rgba(99, 102, 241, 0.2)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.15)',
      }
    },
  },
  plugins: [],
};
export default config;
