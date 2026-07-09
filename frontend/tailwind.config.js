/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // User-controllable roundness (themeStore). Use `rounded-field` on
        // inputs/buttons and `rounded-panel` on large surfaces.
        field: 'var(--radius-field)',
        panel: 'var(--radius-panel)',
      },
      colors: {
        // ── ChatSphere design tokens (theme-aware via CSS vars: dark + light) ──
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-dim': 'rgb(var(--c-surface-dim) / <alpha-value>)',
        'surface-bright': 'rgb(var(--c-surface-bright) / <alpha-value>)',
        'surface-container-lowest': 'rgb(var(--c-surface-container-lowest) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--c-surface-container-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--c-surface-container) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--c-surface-container-high) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--c-surface-container-highest) / <alpha-value>)',
        'surface-variant': 'rgb(var(--c-surface-variant) / <alpha-value>)',
        background: 'rgb(var(--c-surface) / <alpha-value>)',
        'on-surface': 'rgb(var(--c-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--c-on-surface-variant) / <alpha-value>)',
        'on-background': 'rgb(var(--c-on-surface) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--c-primary-container) / <alpha-value>)',
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--c-on-primary-container) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        'secondary-container': 'rgb(var(--c-secondary-container) / <alpha-value>)',
        'on-secondary': 'rgb(var(--c-on-secondary) / <alpha-value>)',
        'on-secondary-container': 'rgb(var(--c-on-secondary-container) / <alpha-value>)',
        tertiary: 'rgb(var(--c-tertiary) / <alpha-value>)',
        outline: 'rgb(var(--c-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--c-outline-variant) / <alpha-value>)',
        error: 'rgb(var(--c-error) / <alpha-value>)',
        'error-container': 'rgb(var(--c-error-container) / <alpha-value>)',
        'on-error-container': 'rgb(var(--c-on-error-container) / <alpha-value>)',
        // Accent palette driven by CSS variables so each user can pick a theme
        // at runtime (see index.css `[data-accent]` sets + themeStore).
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.96) translateY(4px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'typing-dot': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        equalize: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'ring-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
        'pop-in': 'pop-in 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.15s ease-out',
        float: 'float 6s ease-in-out infinite',
        'typing-dot': 'typing-dot 1.2s infinite ease-in-out',
        equalize: 'equalize 0.9s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 2.4s ease-out infinite',
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgb(15 23 42 / 0.08), 0 4px 24px -4px rgb(15 23 42 / 0.06)',
        glow: '0 8px 30px -6px rgb(var(--brand-500) / 0.45)',
      },
    },
  },
  plugins: [],
};
