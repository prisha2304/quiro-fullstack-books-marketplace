/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // QUIRO Official Brand Identity
        primary: {
          50: '#F8F4F7',
          100: '#EFE7ED',
          200: '#DFCED9',
          300: '#C7ABC0',
          400: '#A77E9F',
          500: '#6F3262',
          600: '#35152F', // QUIRO Deep Aubergine (Primary Brand Colour)
          700: '#2A1025',
          800: '#1F0B1C',
          900: '#170715',
          950: '#0F030E',
          DEFAULT: '#35152F',
        },
        secondary: {
          50: '#F8FAFC',
          100: '#EEF2F6',
          200: '#DCE2E8', // QUIRO Ice Silver (Secondary Brand Colour)
          300: '#C3CDD7',
          400: '#A3B2C1',
          500: '#7E92A7',
          600: '#617489',
          700: '#4B5A6B',
          DEFAULT: '#DCE2E8',
        },
        accent: {
          50: '#FEF9EC',
          100: '#FDF1D3',
          200: '#FBE1A6',
          300: '#F7CC6E',
          400: '#F1B838',
          500: '#E5A323', // QUIRO Marigold (Accent & Highlight Colour)
          600: '#C78814',
          700: '#9F680D',
          800: '#794D0A',
          900: '#543407',
          DEFAULT: '#E5A323',
        },
        aubergine: {
          50: '#F8F4F7',
          100: '#EFE7ED',
          200: '#DFCED9',
          300: '#C7ABC0',
          400: '#A77E9F',
          500: '#6F3262',
          600: '#35152F', // Deep Aubergine
          700: '#2A1025',
          800: '#1F0B1C',
          900: '#170715',
          DEFAULT: '#35152F',
        },
        silver: {
          50: '#F8FAFC',
          100: '#EEF2F6',
          200: '#DCE2E8', // Ice Silver
          300: '#C3CDD7',
          400: '#A3B2C1',
          500: '#7E92A7',
          600: '#617489',
          DEFAULT: '#DCE2E8',
        },
        marigold: {
          50: '#FEF9EC',
          100: '#FDF1D3',
          200: '#FBE1A6',
          300: '#F7CC6E',
          400: '#F1B838',
          500: '#E5A323', // Marigold
          600: '#C78814',
          700: '#9F680D',
          800: '#794D0A',
          DEFAULT: '#E5A323',
        },
        gold: {
          50: '#FEF9EC',
          100: '#FDF1D3',
          200: '#FBE1A6',
          300: '#F7CC6E',
          400: '#F1B838',
          500: '#E5A323', // Backwards-compatible alias to Marigold
          600: '#C78814',
          700: '#9F680D',
          DEFAULT: '#E5A323',
        },
        wine: {
          50: '#F8F4F7',
          100: '#EFE7ED',
          200: '#DFCED9',
          500: '#6F3262',
          600: '#35152F', // Backwards-compatible alias to Aubergine
          700: '#2A1025',
          DEFAULT: '#35152F',
        },
        ivory: {
          50: '#FFFFFF',
          100: '#FAF9F6', // Soft Ivory Neutral Background
          200: '#F3EFE9',
          300: '#E7E1D8',
          DEFAULT: '#FAF9F6',
        },
        surface: '#FFFFFF',
        background: '#FAF9F6',
        text: '#1F1924',
        border: '#DCE2E8',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Cinzel', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(53, 21, 47, 0.05), 0 4px 6px -2px rgba(53, 21, 47, 0.03)',
        'editorial': '0 10px 30px -5px rgba(53, 21, 47, 0.10), 0 4px 12px -2px rgba(53, 21, 47, 0.05)',
        'hover': '0 20px 25px -5px rgba(53, 21, 47, 0.14), 0 8px 10px -6px rgba(53, 21, 47, 0.06)',
        'gold': '0 6px 20px -3px rgba(229, 163, 35, 0.25)',
      }
    },
  },
  plugins: [],
}
