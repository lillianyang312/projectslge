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
        border: 'hsl(0, 0%, 89%)',
        input: 'hsl(0, 0%, 89%)',
        ring: 'hsl(0, 0%, 63%)',
        background: 'hsl(0, 0%, 100%)',
        foreground: 'hsl(0, 0%, 9%)',
        primary: {
          DEFAULT: 'hsl(0, 0%, 9%)',
          foreground: 'hsl(0, 0%, 98%)',
        },
        secondary: {
          DEFAULT: 'hsl(0, 0%, 96%)',
          foreground: 'hsl(0, 0%, 9%)',
        },
        muted: {
          DEFAULT: 'hsl(0, 0%, 96%)',
          foreground: 'hsl(0, 0%, 45%)',
        },
      },
    },
  },
  plugins: [],
}
export default config
