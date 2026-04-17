import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // All colors reference CSS custom properties defined in globals.css.
      // This single source of truth makes dark mode a pure CSS concern —
      // no Tailwind dark: variants needed for color changes.
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        elevated: 'var(--color-elevated)',
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          light: 'var(--color-accent-light)',
          muted: 'var(--color-accent-muted)',
        },
        crimson: {
          DEFAULT: 'var(--color-crimson)',
          light: 'var(--color-crimson-light)',
        },
        forest: {
          DEFAULT: 'var(--color-forest)',
          light: 'var(--color-forest-light)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-garamond)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Tighter academic scale
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
        xs: ['0.72rem', { lineHeight: '1.1rem' }],
        sm: ['0.82rem', { lineHeight: '1.4rem' }],
        base: ['0.9rem', { lineHeight: '1.6rem' }],
        lg: ['1rem', { lineHeight: '1.6rem' }],
        xl: ['1.15rem', { lineHeight: '1.4rem' }],
        '2xl': ['1.35rem', { lineHeight: '1.3rem' }],
        '3xl': ['1.65rem', { lineHeight: '1.2rem' }],
        '4xl': ['2rem', { lineHeight: '1.1rem' }],
        '5xl': ['2.5rem', { lineHeight: '1.05rem' }],
      },
      letterSpacing: {
        label: '0.07em',
        wide: '0.04em',
      },
      spacing: {
        // Base-4 scale already covered by Tailwind; add the odd ones
        18: '4.5rem',
        22: '5.5rem',
        sidebar: '240px',
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.1)',
        panel: '0 0 0 1px var(--color-border)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        slow: '250ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
      },
    },
  },
  plugins: [],
}

export default config
