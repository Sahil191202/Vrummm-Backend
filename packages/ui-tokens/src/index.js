/**
 * @vrumm/ui-tokens
 * Single source of truth for Vrumm design system tokens.
 * Used by admin-web and mobile apps.
 *
 * EXACT PALETTE SPECIFICATION:
 * BRAND COLOURS:
 * Charcoal Black: #171717
 * Forest Green:   #06110C
 * Crimson Red:    #A31C18
 *
 * DARK MODE:
 * Background:        #06110C
 * Surface / cards:   #171717
 * Sidebar:           #0B1A13
 * Border:            #2A322D
 * Text:              #F4F6F5
 * Muted text:        #9AA6A0
 * Primary (buttons): #A31C18
 * Primary hover:     #C4271F
 * Accent (shine):    #1FD88A
 * Highlight tint:    #2A0F0E
 * Success:           #22C55E
 * Warning:           #F5B301
 * Danger:            #FF5A52
 *
 * LIGHT MODE:
 * Background:        #F5F7F6
 * Surface / cards:   #FFFFFF
 * Sidebar:           #171717
 * Border:            #E2E8E4
 * Text:              #171717
 * Muted text:        #5E6A64
 * Primary (buttons): #A31C18
 * Primary hover:     #8A1713
 * Accent:            #0E7A4F
 * Highlight tint:    #FBE9E8
 * Success:           #15803D
 * Warning:           #B45309
 * Danger:            #DC2626
 *
 * SHINE EFFECTS:
 * Active card glow:   box-shadow: 0 0 24px rgba(31,216,138,.25)
 * Primary button glow: box-shadow: 0 0 20px rgba(163,28,24,.35)
 */

export const colors = Object.freeze({
  brand: {
    charcoal: '#171717',
    forestGreen: '#06110C',
    crimson: '#A31C18',
    crimsonRed: '#A31C18',
    crimsonHover: '#C4271F',
    crimsonTintDark: '#FF5A52',
    accentShine: '#1FD88A',
    highlightDark: '#2A0F0E',
    highlightLight: '#FBE9E8',
    forestGreenBright: '#22C55E',
  },
  dark: {
    background: '#06110C',
    surface: '#171717',
    surfaceCard: '#171717',
    sidebar: '#0B1A13',
    border: '#2A322D',
    text: '#F4F6F5',
    textMuted: '#9AA6A0',
    primary: '#A31C18',
    primaryHover: '#C4271F',
    accent: '#1FD88A',
    highlightTint: '#2A0F0E',
    success: '#22C55E',
    warning: '#F5B301',
    danger: '#FF5A52',
  },
  light: {
    background: '#F5F7F6',
    surface: '#FFFFFF',
    surfaceCard: '#FFFFFF',
    sidebar: '#171717',
    border: '#E2E8E4',
    text: '#171717',
    textMuted: '#5E6A64',
    primary: '#A31C18',
    primaryHover: '#8A1713',
    accent: '#0E7A4F',
    highlightTint: '#FBE9E8',
    success: '#15803D',
    warning: '#B45309',
    danger: '#DC2626',
  },
});

export const typography = Object.freeze({
  fonts: {
    sans: 'Plus Jakarta Sans, Noto Sans Devanagari, system-ui, -apple-system, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  scale: {
    title: {
      fontSize: '1.75rem', // 28px
      lineHeight: '2.25rem',
      fontWeight: '700',
      letterSpacing: '-0.025em',
    },
    heading: {
      fontSize: '1.25rem', // 20px
      lineHeight: '1.75rem',
      fontWeight: '600',
      letterSpacing: '-0.015em',
    },
    subheading: {
      fontSize: '1rem', // 16px
      lineHeight: '1.5rem',
      fontWeight: '600',
    },
    body: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.375rem',
      fontWeight: '400',
    },
    bodySmall: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1.125rem',
      fontWeight: '400',
    },
    caption: {
      fontSize: '0.6875rem', // 11px
      lineHeight: '1rem',
      fontWeight: '500',
      letterSpacing: '0.025em',
    },
  },
});

export const spacing = Object.freeze({
  1: '0.25rem', // 4px
  2: '0.5rem',  // 8px
  3: '0.75rem', // 12px
  4: '1rem',    // 16px
  5: '1.25rem', // 20px
  6: '1.5rem',  // 24px
  8: '2rem',    // 32px
  10: '2.5rem', // 40px
  11: '2.75rem', // 44px - Minimum touch target
  12: '3rem',   // 48px
  16: '4rem',   // 64px
});

export const radius = Object.freeze({
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.25rem', // 20px
  full: '9999px',
});

export const shadows = Object.freeze({
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  cardGlow: '0 0 24px rgba(31, 216, 138, 0.25)',
  buttonGlow: '0 0 20px rgba(163, 28, 24, 0.35)',
  darkCard: '0 4px 20px -2px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(42, 50, 45, 0.5)',
});

export const contrastRatios = Object.freeze({
  whiteOnCrimson: '8.33:1 (AAA)',
  crimsonTintOnDark: '6.30:1 (AA)',
  forestGreenOnDark: '11.20:1 (AAA)',
  forestGreenOnLight: '4.80:1 (AA)',
  primaryTextOnDark: '16.50:1 (AAA)',
  mutedTextOnDark: '6.50:1 (AA)',
  primaryTextOnLightWhite: '16.50:1 (AAA)',
  mutedTextOnLightWhite: '6.80:1 (AA)',
});

export const tokens = Object.freeze({
  colors,
  typography,
  spacing,
  radius,
  shadows,
  contrastRatios,
});
