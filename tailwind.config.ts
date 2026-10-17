import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        bg: '#FBF3EA',
        card: '#FFFAF4',
        primary: '#4F6B57',
        'sage-light': '#C7DDAE',
        good: '#6A784D',
        warn: {
          DEFAULT: '#F4C542',
          soft: '#DEC59E',
        },
        alert: '#C4866D',
        // #C4866D sobre card queda en 2.9:1. Este cobre llega a 6.3:1 para texto.
        'alert-ink': '#85503C',
        blush: '#F7B7C4',
        lavender: '#A79BCB',
        text: '#202808',
        // Secundario del boceto, 5.5:1 sobre card y 5.2:1 sobre el fondo.
        muted: '#6B6656',
        sand: '#F1E5D6',
        line: '#EADCCB',
        debt: '#FDEEE9',
        shell: '#EFE3D4',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 14px #c4866d18',
        fab: '0 8px 18px #4f6b5766',
        soft: '0 3px 8px #c4866d22',
      },
    },
  },
}

export default config
