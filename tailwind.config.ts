import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Trading platform dark theme
        background: {
          primary: '#0a0e27',
          secondary: '#1a1d2e',
          tertiary: '#252942',
        },
        surface: {
          primary: '#1e2139',
          secondary: '#252847',
          elevated: '#2d3357',
        },
        text: {
          primary: '#e4e6ea',
          secondary: '#b8bcc8',
          muted: '#6c7293',
        },
        accent: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        trading: {
          buy: '#10b981',
          sell: '#ef4444',
          neutral: '#6b7280',
          profit: '#059669',
          loss: '#dc2626',
        },
        border: {
          primary: '#374151',
          secondary: '#4b5563',
          accent: '#6366f1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.8)' },
        },
      },
      boxShadow: {
        'trading': '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        'trading-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.3)',
      },
      borderRadius: {
        'trading': '8px',
      }
    },
  },
  plugins: [],
}
export default config
