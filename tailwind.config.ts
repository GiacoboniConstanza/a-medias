import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        bg: '#FEF4E8',
        crema: '#FEF4E8',
        shell: '#FEF4E8',
        card: '#FFFAF3',
        tarjeta: '#FFFAF3',
        sand: '#DFE2EC',
        'sand-soft': '#FEF4E8',
        line: 'rgba(27,36,46,.3)',
        'line-strong': 'rgba(27,36,46,.45)',
        title: '#1B242E',
        tinta: '#1B242E',
        muted: '#5F6266',
        gris: '#5F6266',
        azul: '#7D8BB2',
        'azul-ink': '#4C5A80',
        'azul-claro': '#DFE2EC',
        mostaza: '#E6A940',
        'mostaza-ink': '#7E5611',
        'mostaza-claro': '#F6E1BB',
        rosa: '#E8A198',
        'rosa-hondo': '#B96D64',
        'rosa-claro': '#F6D9D5',
        'rosa-texto': '#A25B53',
        salvia: '#A6A066',
        'salvia-ink': '#5A5735',
        'salvia-claro': '#E3E1CF',
        ciruela: '#9C7092',
        'ciruela-ink': '#86607F',
        'ciruela-claro': '#E6D8DB',
        aviso: '#2F4A38',
        'aviso-texto': '#FFFAF4',
        'aviso-accion': '#E3EED4',
      },
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
