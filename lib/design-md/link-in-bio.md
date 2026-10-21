---
version: alpha
name: Link in bio
description: A single-screen link-in-bio page for creators and professionals — avatar, name, a one-line bio and a stack of large, thumb-friendly link buttons, centered in a narrow column on a soft gradient. Built for phones first; on desktop it stays a centered card.

colors:
  primary: "#1b1b1f"
  on-primary: "#ffffff"
  ink: "#1b1b1f"
  body: "#4a4a55"
  mute: "#7a7a88"
  canvas-from: "#fdf2f8"
  canvas-to: "#eef2ff"
  surface: "#ffffff"
  hairline: "#e7e5f0"
  accent: "#7c3aed"
  dark-canvas-from: "#14111c"
  dark-canvas-to: "#0d1220"
  dark-surface: "#1d1a27"
  dark-ink: "#f4f3f8"

typography:
  name:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
  bio:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  link:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 600

rounded:
  md: 14px
  lg: 20px
  full: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 40px

components:
  avatar:
    size: 96px
    rounded: "{rounded.full}"
  link-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.link}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
    minHeight: 56px
  link-button-featured:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  social-icon:
    size: 44px
    rounded: "{rounded.full}"
---

## Overview

One column, max 480px wide, centered on a full-height gradient canvas. The visitor arrived from a social profile on a phone; they should find the link they came for within one thumb scroll.

## Layout

- Order: avatar (user photo or initials monogram) → name → one-line bio → optional featured link → 3–8 link buttons → row of social icons (inline SVG) → small footer.
- Each link button is a full-width https anchor with a short label and optional emoji or icon on the left; minimum 56px tall, 12px apart.
- The page must fit the first viewport on a 360×740 phone when there are five or fewer links.

## Do's and Don'ts

### Do
- Use exactly the links the user gave, in their order, with their labels. Ask for links if there are none.
- Give each button a visible focus ring and a subtle hover lift that respects prefers-reduced-motion.
- Use og:type=profile and the person's name in og:title.

### Don't
- Add fake follower counts, sponsors or newsletter forms.
- Use more than one accent color or tiny text below 14px.
