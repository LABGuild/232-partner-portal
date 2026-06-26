import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 232 Partnership brand colors (updated brand deck, 2026)
        brand: {
          blue:   '#28657A',  // primary teal
          yellow: '#FDC20D',
          green:  '#829E3C',
          red:    '#DE1E29',
          orange: '#F15C2F',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body:    ['Figtree', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
