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
        // 232 Partnership brand colors
        brand: {
          blue:   '#436578',
          yellow: '#F3C108',
          green:  '#8A9C3A',
          red:    '#BE1E2C',
          orange: '#F15B25',
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body:    ['Athiti', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
