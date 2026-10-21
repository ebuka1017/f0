---
version: alpha
name: Resume
description: An online resume / CV — a clean, print-friendly single page with a header of name, title, location and contact links, followed by summary, experience, projects, skills and education in a strict typographic hierarchy. Reads like a well-set document; prints cleanly to A4 and Letter.

colors:
  primary: "#0f172a"
  on-primary: "#ffffff"
  ink: "#0f172a"
  body: "#334155"
  mute: "#64748b"
  hairline: "#e2e8f0"
  canvas: "#ffffff"
  canvas-soft: "#f8fafc"
  accent: "#2563eb"
  dark-canvas: "#0b1120"
  dark-ink: "#e2e8f0"
  dark-body: "#94a3b8"

typography:
  name:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(30px, 6vw, 44px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.5px
  section-label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 13px
    fontWeight: 700
    letterSpacing: 1.2px
    textTransform: uppercase
  role:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 17px
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  meta:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 13px

rounded:
  sm: 4px
  md: 8px

spacing:
  xs: 6px
  sm: 10px
  md: 16px
  lg: 28px
  xl: 48px

components:
  section:
    borderTop: "1px solid {colors.hairline}"
    padding: "{spacing.lg} 0"
  entry:
    layout: "role and organisation left, dates right (stacked on mobile)"
  skill-chip:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
---

## Overview

A resume is scanned in seconds. Hierarchy does the work: name, then title, then section labels, then roles. One accent color for links only. Max width 820px.

## Layout

- Header: name, current title, location, and contact (email as selectable text, https links to LinkedIn, GitHub, website).
- Sections in this order unless the user says otherwise: Summary (2–3 sentences) → Experience (reverse chronological; role, organisation, dates, 2–4 achievement bullets) → Projects → Skills (chips grouped by kind) → Education → optional Certifications, Languages.
- On screens ≥ 720px, dates sit right-aligned on the role line; on mobile they stack under it.
- Include @media print rules: white background, no shadows, 11pt body, sections avoid page breaks inside entries, link URLs shown after link text.

## Do's and Don'ts

### Do
- Use only employers, dates, titles, degrees and achievements the user supplied; ask for missing ones in one batch.
- Use real <time> elements and a semantic structure (h2 per section, h3 per role).

### Don't
- Add skill-level bars, photos (unless provided), or invented metrics.
- Use multiple columns on mobile.
