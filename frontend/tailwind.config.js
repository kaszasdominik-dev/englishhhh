/** @type {import('tailwindcss').Config} */
module.exports = {
  blocklist: ["overline"],
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        ink: {
          DEFAULT: '#0F172A',
          soft: '#334155',
          mute: '#64748B',
          faint: '#94A3B8',
        },
        brand: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          soft: '#EEF0FF',
          ring: '#C7D2FE',
        },
        emerald2: { DEFAULT: '#10B981', bg: '#D1FAE5' },
        rose2: { DEFAULT: '#F43F5E', bg: '#FFE4E6' },
        amber2: { DEFAULT: '#F59E0B' },
        task: { bg: '#131A2B', text: '#F8FAFC', accent: '#FBBF24' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)',
        card: '0 2px 6px rgba(15,23,42,.05), 0 18px 40px -20px rgba(15,23,42,.20)',
        task: '0 20px 45px -18px rgba(19,26,43,.65), 0 0 0 1px rgba(251,191,36,.10)',
        phone: '0 40px 120px -30px rgba(15,23,42,.35)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        floaty: 'floaty 4s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
