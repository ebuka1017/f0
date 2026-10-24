---
version: alpha
name: Portfolio
description: A personal portfolio for a designer, developer or creative — a confident editorial hero with the person's name and role, a grid of selected work with real project names and outcomes, a short about section and contact links. Warm off-white canvas, near-black ink, one accent color chosen from the person's own brand.

colors:
  primary: "#111111"
  on-primary: "#ffffff"
  ink: "#111111"
  body: "#3d3d3d"
  mute: "#6b6b6b"
  hairline: "#e6e3de"
  canvas: "#faf8f5"
  canvas-soft: "#f1eee8"
  accent: "#ff5a36"
  accent-soft: "#ffe3dc"
  dark-canvas: "#121212"
  dark-ink: "#f2f0ec"
  dark-body: "#c4c0b8"

typography:
  display:
    fontFamily: "ui-serif, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(40px, 9vw, 88px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: -1.5px
  heading:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(22px, 4vw, 32px)"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12px
    fontWeight: 500
    letterSpacing: 0.8px

rounded:
  sm: 6px
  md: 12px
  lg: 20px
  full: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 20px
  lg: 32px
  xl: 56px
  section: "clamp(64px, 12vw, 128px)"

components:
  project-card:
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "12px 22px"
  tag:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

## Overview

A portfolio exists to get the visitor to one conclusion: "I want to work with this person." The name and role are the hero, set large in a serif. Selected work follows immediately, then a short about section, then contact. Nothing else.

## Layout

- Mobile first: one column at 360px, project grid becomes two columns at 720px and stays two or three at 1100px. Max content width 1120px.
- Order: header (name as wordmark, 2–4 anchor links) → hero (name, role, one-sentence pitch, primary link) → selected work (3–6 project cards) → about (photo optional, 2–3 short paragraphs) → experience or clients only if provided → contact (email as text, social links) → footer.
- Project cards: image or color block (4:3), project name, one-line outcome, 1–3 tags, link if provided.

## Do's and Don'ts

### Do
- Use the person's real projects, outcomes and links only. Mark anything missing as a placeholder.
- Let whitespace carry the design; one accent color, used sparingly on links and tags.
- Support prefers-color-scheme with the dark palette.

### Don't
- Invent clients, metrics, testimonials or awards.
- Use stock-photo hero banners, carousels or skill-percentage bars.
