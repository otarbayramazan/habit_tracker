/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: c('app'),
        card: c('card'),
        elev: c('elev'),
        elev2: c('elev2'),
        line: c('line'),
        line2: c('line2'),
        fg: c('fg'),
        fg2: c('fg2'),
        sub: c('sub'),
        muted: c('muted'),
        faint: c('faint'),
        rest: c('rest'),
      },
      keyframes: {
        'pop': { '0%': { transform: 'scale(0.6)' }, '60%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        'rise': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'sheet': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade': { from: { opacity: '0' }, to: { opacity: '1' } },
        'flame': { '0%,100%': { transform: 'scale(1) rotate(0)' }, '50%': { transform: 'scale(1.18) rotate(-6deg)' } },
      },
      animation: {
        pop: 'pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
        rise: 'rise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        sheet: 'sheet 0.34s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.25s ease-out both',
        flame: 'flame 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
