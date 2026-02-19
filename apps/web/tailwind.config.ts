import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FDFCFA',
        'bg-alt': '#F0EFED',
        card: '#FFFFFF',
        border: '#E8E5E0',
        'text-primary': '#1A1917',
        'text-secondary': '#6B6762',
        'text-muted': '#9C9891',
        accent: '#2D2A26',
        'accent-soft': '#F5F3F0',
        success: '#3D8B5A',
        'success-soft': '#E8F5ED',
        warning: '#C4873B',
        'warning-soft': '#FDF4E8',
        danger: '#B84747',
        'danger-soft': '#FDEBEB',
        purple: '#6B5B95',
        'purple-soft': '#F0EDF5',
        blue: '#4A7FB5',
        'blue-soft': '#EBF3FA',
        buying: '#3B82F6',
        'buying-soft': '#DBEAFE',
        selling: '#22C55E',
        'selling-soft': '#DCFCE7',
        unread: '#FAF8F0',
        'unread-border': '#E8E2D0',
      },
      fontFamily: {
        body: ['var(--font-dm-sans)', 'sans-serif'],
        heading: ['var(--font-fraunces)', 'serif'],
      },
      fontSize: {
        'xs': ['0.6875rem', { lineHeight: '1.4' }],    // 11px
        'sm': ['0.75rem', { lineHeight: '1.4' }],       // 12px
        'base': ['0.8125rem', { lineHeight: '1.4' }],   // 13px
        'md': ['0.875rem', { lineHeight: '1.4' }],      // 14px
        'lg': ['0.9375rem', { lineHeight: '1.4' }],     // 15px
        'xl': ['1rem', { lineHeight: '1.4' }],          // 16px
        '2xl': ['1.125rem', { lineHeight: '1.15' }],    // 18px
        '3xl': ['1.25rem', { lineHeight: '1.15' }],     // 20px
        'h3': ['1.375rem', { lineHeight: '1.15' }],     // 22px
        'h2': ['1.5rem', { lineHeight: '1.15' }],       // 24px
        'h1': ['1.75rem', { lineHeight: '1.15' }],      // 28px
        'display': ['2.25rem', { lineHeight: '1.15' }],  // 36px
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'pill': '100px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
        'huge': '48px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(26, 25, 23, 0.06)',
        'lg': '0 8px 24px rgba(26, 25, 23, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
