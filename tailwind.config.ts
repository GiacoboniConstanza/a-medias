import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
      boxShadow: {
        toast: '0 2px 8px rgb(47 74 56 / 14%)',
        soft: '0 3px 8px rgb(27 36 46 / 8%)',
      },
    },
  },
}

export default config
