---
version: alpha
name: Minimal blog
description: A minimal personal blog — a quiet, text-first home page with the author's name, a short intro and a dated list of posts, plus a beautifully set article layout. Generous line height, a narrow measure, a serif for reading and a sans for UI.

colors:
  primary: "#1a1a1a"
  on-primary: "#ffffff"
  ink: "#1a1a1a"
  body: "#2e2e2e"
  mute: "#737373"
  hairline: "#ececec"
  canvas: "#fffefb"
  accent: "#0b6e4f"
  code-bg: "#f4f2ee"
  dark-canvas: "#161513"
  dark-ink: "#ecebe8"
  dark-body: "#d4d2cc"
  dark-accent: "#5fd3a5"

typography:
  site-title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 18px
    fontWeight: 600
  post-title:
    fontFamily: "ui-serif, Charter, Georgia, serif"
    fontSize: "clamp(28px, 6vw, 42px)"
    fontWeight: 600
    lineHeight: 1.15
  prose:
    fontFamily: "ui-serif, Charter, Georgia, serif"
    fontSize: "clamp(18px, 2.4vw, 20px)"
    fontWeight: 400
    lineHeight: 1.7
  meta:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    color: "{colors.mute}"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 15px

rounded:
  sm: 4px
  md: 8px

spacing:
  sm: 12px
  md: 20px
  lg: 36px
  xl: 64px
  measure: 68ch

components:
  post-list-item:
    layout: "date (meta) then title (link), one per row, hairline between"
  blockquote:
    borderLeft: "3px solid {colors.accent}"
    padding: "0 0 0 {spacing.md}"
  code-block:
    backgroundColor: "{colors.code-bg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

## Overview

Reading is the product. A single column limited to about 68 characters, centered, with plenty of space above headings. No sidebars, no widgets.

## Layout

- Home: site title (author name) and 2–4 nav links → one-paragraph intro → list of posts (date, title, optional one-line summary) → footer with social links.
- Because the site is one HTML file, each post is a section with an id; the list links to #post-slug and each post links back to #top. Show the first post expanded only if the user asks.
- Use <article>, <time datetime>, and <header> for each post.

## Do's and Don'ts

### Do
- Use only post titles, dates and text the user provides; if none, ask, or show clearly marked sample posts the user can replace.
- Style prose elements: h2/h3, lists, blockquote, inline code, code blocks, images with captions.

### Don't
- Add comment sections, newsletter forms, view counts or tag clouds.
- Justify text or use body text under 17px.
