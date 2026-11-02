import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        bg: '#FBF3EA',
        shell: '#EFE3D4',
        card: '#FFFAF4',
        sand: '#F1E5D6',
        'sand-soft': '#F8EFE4',
        line: '#EADCCB',
        title: '#2F4A38',
        muted: '#6B6656',
        primary: '#4F6B57',
        'sage-light': '#C7DDAE',
        'sage-soft': '#E3EED4',
        good: '#6A784D',
        alert: '#C4866D',
        'alert-ink': '#85503C',
        'alert-light': '#E8C2A6',
        'copper-soft': '#F8E0CC',
        warn: {
          DEFAULT: '#F4C542',
          strong: '#C99A00',
          ink: '#7A5A10',
          soft: '#DEC59E',
        },
        'gold-soft': '#FFF1C2',
        lavender: '#A79BCB',
        'lavender-light': '#CBC2E4',
        'lavender-soft': '#EDE6F5',
        'lavender-ink': '#6A5C9E',
        'blue-soft': '#E6EFF7',
        'blue-ink': '#3D5874',
        'on-primary': '#FFFFFF',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 14px #c4866d18',
        fab: '0 8px 18px #4f6b5766',
        'fab-lite': '0 3px 8px rgb(79 107 87 / 25%)',
        toast: '0 2px 8px rgb(47 74 56 / 14%)',
        soft: '0 3px 8px #c4866d22',
      },
    },
  },
}

export default config
