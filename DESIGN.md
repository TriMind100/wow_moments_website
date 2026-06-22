---
name: Luminous Gifting
colors:
  surface: '#fff8f8'
  surface-dim: '#eed4d8'
  surface-bright: '#fff8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0f2'
  surface-container: '#ffe8ec'
  surface-container-high: '#fde2e6'
  surface-container-highest: '#f7dce1'
  on-surface: '#26181b'
  on-surface-variant: '#594046'
  inverse-surface: '#3c2c30'
  inverse-on-surface: '#ffecef'
  outline: '#8d7076'
  outline-variant: '#e1bec5'
  surface-tint: '#b90a5a'
  primary: '#b90a5a'
  on-primary: '#ffffff'
  primary-container: '#ff4d8d'
  on-primary-container: '#5b0028'
  inverse-primary: '#ffb1c4'
  secondary: '#9b3f5a'
  on-secondary: '#ffffff'
  secondary-container: '#ff8fab'
  on-secondary-container: '#79243f'
  tertiary: '#006e18'
  on-tertiary: '#ffffff'
  tertiary-container: '#00a92a'
  on-tertiary-container: '#003306'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e0'
  primary-fixed-dim: '#ffb1c4'
  on-primary-fixed: '#3f001a'
  on-primary-fixed-variant: '#8f0043'
  secondary-fixed: '#ffd9e0'
  secondary-fixed-dim: '#ffb1c2'
  on-secondary-fixed: '#3f0018'
  on-secondary-fixed-variant: '#7d2742'
  tertiary-fixed: '#75ff75'
  tertiary-fixed-dim: '#57e15b'
  on-tertiary-fixed: '#002203'
  on-tertiary-fixed-variant: '#00530f'
  background: '#fff8f8'
  on-background: '#26181b'
  surface-variant: '#f7dce1'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 64px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  section-gap: 120px
---

## Brand & Style
The design system is centered on the concept of "The Reveal"—capturing the emotional crescendo of receiving a thoughtful gift. The brand personality is premium, celebratory, and deeply human, avoiding the sterile nature of traditional e-commerce in favor of a warm, editorial aesthetic.

The visual style blends **Apple-inspired minimalism** with **modern Glassmorphism**. It utilizes high-transparency layers, vibrant background blurs, and sophisticated gradients to create a sense of depth and tactile quality. Every interaction should feel like unwrapping a physical gift: smooth, intentional, and rewarding.

**Design Pillars:**
- **Emotional Resonance:** High-quality imagery combined with generous whitespace.
- **Luminous Depth:** Using light as a material through subtle glows and frosted glass surfaces.
- **Fluidity:** Soft transitions and organic shapes that guide the eye toward "Wow Moments."

## Colors
The palette is built around a "Blush Spectrum." The **Primary Pink (#FF4D8D)** is high-energy and celebratory, used for call-to-actions and brand-defining moments. The **Secondary and Accent** tones provide a soft supporting cast, used for secondary information and delicate background elements.

The background is a crisp **Pure White (#FFFFFF)** to ensure the photography and glass effects remain clear. Surfaces use a very light **Cool Grey (#F9FAFB)** to create subtle distinction between the page and floating UI containers. Gradients should be used sparingly but impactfully, primarily on buttons and hero illustrations to simulate light hitting a soft surface.

## Typography
This design system utilizes **Plus Jakarta Sans** for its friendly, modern, and open apertures. The type scale is intentionally dramatic to create an editorial feel. Large "Display" sizes use heavy weights and tight letter spacing to command attention, while body text remains airy and highly legible.

**Usage Guidelines:**
- **Display LG:** Reserved for hero sections and major announcement headers.
- **Headline XL/LG:** Used for section titles and product names.
- **Body LG:** Default for introductory paragraphs or long-form storytelling.
- **Label MD:** Used for navigation items, tags, and small meta-data to provide a clean, organized hierarchy.

## Layout & Spacing
The layout follows a **Fluid Grid** philosophy with a focus on generous negative space. A 12-column system is used for desktop (1280px max-width), while a 4-column system is used for mobile. 

The vertical rhythm is defined by a 120px "Section Gap" on desktop, which ensures that each "Wow Moment" has the visual room to breathe without distraction. Padding within components should be expansive—never crowd content. Use a base 8px increment for all internal spacing to maintain mathematical harmony.

## Elevation & Depth
Depth is the cornerstone of this design system. It is achieved through three specific layers:

1.  **The Base:** Flat background (#FFFFFF) or light surface (#F9FAFB).
2.  **Glass Containers:** Semi-transparent white layers (opacity 60-80%) with a `backdrop-filter: blur(20px)`. These must have a subtle 1px inner border of `rgba(255, 255, 255, 0.4)` to simulate a glass edge catching the light.
3.  **Soft Shadows:** Use large-spread, low-opacity shadows for floating elements. 
    *   *Shadow Definition:* `0px 20px 40px rgba(31, 41, 55, 0.05)`. 
    *   Avoid pure black shadows; always use a hint of the primary color or a dark navy to keep the shadows "alive."

## Shapes
The shape language is extremely soft and approachable. 
- **Small Elements (Inputs/Buttons):** Use `rounded-lg` (0.5rem) to 1rem.
- **Standard Cards:** Use `rounded-xl` (1.5rem).
- **Hero Containers & Featured Sections:** Use **2xl or 3xl** rounded corners (2rem to 3rem) to create a distinctive, premium feel that mirrors high-end physical packaging.
- **Icons:** Should feature rounded terminals and a consistent 2px stroke weight.

## Components

### Buttons
- **Primary:** Features a vibrant gradient background with a subtle outer glow of the same color. On hover, the button should lift slightly (translate -2px) and the glow should intensify.
- **Secondary:** Transparent with a thin primary-colored border. On hover, fills with a very light tint of the primary color.

### Gifting Cards
- Use a "Glassmorphic" base.
- Feature a high-resolution product image that slightly overlaps the card's edge (break-out effect).
- **Hover Effect:** The card should scale up (1.02x) and the glass blur should sharpen slightly to focus the user's attention.

### Input Fields
- Subtle grey background (#F9FAFB) with a 1px border that turns into a Primary Pink glow when focused.
- Labels sit above the input in the `Label MD` style.

### Progress & Steppers
- Use soft, rounded lines with the Secondary color as the track and the Primary color as the fill. 
- Ideal for the gift-customization flow.

### Glass Chips
- Small, pill-shaped tags used for categories. 
- Style: `backdrop-filter: blur(10px)` with a light pink tint and semi-bold text.