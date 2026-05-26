/** Shared Tailwind preset — design tokens + dark mode + tabular nums for finance UI. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontFeatureSettings: {
        tnum: '"tnum"',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Semantic finance colors — use ONLY for gains/losses.
        gain: {
          DEFAULT: 'hsl(var(--gain))',
          foreground: 'hsl(var(--gain-foreground))',
          muted: 'hsl(var(--gain-muted))',
        },
        loss: {
          DEFAULT: 'hsl(var(--loss))',
          foreground: 'hsl(var(--loss-foreground))',
          muted: 'hsl(var(--loss-muted))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'flash-gain': {
          '0%': { backgroundColor: 'hsl(var(--gain-muted))' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-loss': {
          '0%': { backgroundColor: 'hsl(var(--loss-muted))' },
          '100%': { backgroundColor: 'transparent' },
        },
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'flash-gain': 'flash-gain 600ms ease-out',
        'flash-loss': 'flash-loss 600ms ease-out',
        'pulse-live': 'pulse-live 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
