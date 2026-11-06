import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        spectre: {
          bg: 'rgb(var(--bg-primary-rgb) / <alpha-value>)',
          surface: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          card: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          'surface-dark': 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          border: 'rgb(var(--border-rgb) / <alpha-value>)',
          accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
          'accent-hover': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          'accent-contrast': 'rgb(var(--on-accent-rgb) / <alpha-value>)',
          danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
          warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
          success: 'rgb(var(--success-rgb) / <alpha-value>)',
          info: 'rgb(var(--info-rgb) / <alpha-value>)',
          offline: 'rgb(var(--offline-rgb) / <alpha-value>)',
          overlay: 'rgb(var(--overlay-rgb) / <alpha-value>)',
          'muted-bg': 'rgb(var(--muted-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          text: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          'text-secondary': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          'on-danger': 'rgb(var(--on-danger-rgb) / <alpha-value>)',
          'severity-high': 'rgb(var(--severity-high-rgb) / <alpha-value>)',
          'severity-medium': 'rgb(var(--severity-medium-rgb) / <alpha-value>)',
          'severity-low': 'rgb(var(--severity-low-rgb) / <alpha-value>)',
          'severity-info': 'rgb(var(--severity-info-rgb) / <alpha-value>)',
        },
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
