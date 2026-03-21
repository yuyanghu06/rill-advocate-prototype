
---
name: Rill Advocate UI Design
description: Use this skill whenever building, updating, or scaffolding any UI component or page for the Rill Advocate prototype.
---

## Aesthetic

Light, clean, and calm. The interface should feel like a thoughtful productivity tool — not flashy, not corporate. Whitespace is intentional. Nothing should feel cluttered or urgent.

---

## Color Palette

```css
--background:     #f9f9f9;   /* page background */
--surface:        #ffffff;   /* cards, panels, inputs */
--border:         #e8e8e8;   /* dividers, input borders */
--text-primary:   #1a1a1a;   /* headings, body */
--text-secondary: #6b7280;   /* labels, placeholders, metadata */
--accent:         #4f6ef7;   /* primary actions, links, focus rings */
--accent-light:   #eef1fe;   /* accent backgrounds, hover states */
--success:        #22c55e;   /* confirmed blocks, ranking badge */
--error:          #ef4444;   /* validation, warnings */
```

Never use pure black (`#000`) or pure white (`#fff`) for surfaces or text.

---

## Typography

- **Font:** Inter (Google Fonts) — load via `next/font/google`
- **Base size:** 14px
- **Scale:**
  - Page title: `text-xl font-semibold`
  - Section label: `text-sm font-medium text-secondary`
  - Body / chat text: `text-sm font-normal`
  - Metadata / timestamps: `text-xs text-secondary`
- Line height: `leading-relaxed` for chat bubbles, `leading-snug` for labels

---

## Border Radius

Soft and rounded throughout. Never sharp corners.

```
--radius-sm:   6px;    /* inputs, tags, badges */
--radius-md:   12px;   /* cards, message bubbles */
--radius-lg:   16px;   /* panels, modals */
--radius-full: 9999px; /* pills, avatar circles, send button */
```

In Tailwind: prefer `rounded-lg`, `rounded-xl`, `rounded-full`. Never use `rounded-none`.

---

## Chat Interface Rules

The onboarding UI is a chat window. Follow these rules strictly:

### Layout
- Full-height chat panel, vertically scrollable message list
- Fixed input bar pinned to the bottom
- Max width of chat container: `max-w-2xl mx-auto`
- Subtle top bar showing onboarding step progress (e.g., "Step 2 of 5")

### Message Bubbles
- **Advocate (agent) messages:** left-aligned, `bg-surface border border-border`, `rounded-xl rounded-tl-sm`
- **User messages:** right-aligned, `bg-accent text-white`, `rounded-xl rounded-tr-sm`
- Padding: `px-4 py-3`
- Max bubble width: `max-w-[75%]`
- Small avatar or "A" icon next to Advocate messages, no avatar for user

### Input Bar
- Full-width text input, `rounded-full`, `border border-border`, `bg-surface`
- Send button: circular, `bg-accent text-white`, `rounded-full`, icon only (arrow or paper plane)
- Input padding: `px-5 py-3`
- Subtle shadow on the input bar container: `shadow-sm`

### Typing Indicator
- Three animated dots inside an Advocate bubble when waiting for a response
- Same styling as agent bubbles

---

## Components

### Experience Block Card
- `bg-surface border border-border rounded-xl p-4`
- Pin emoji or colored left border (`border-l-4 border-accent`) to distinguish block type
- Title in `font-medium`, date range in `text-xs text-secondary`
- Helper URL chips: small `rounded-full bg-accent-light text-accent text-xs px-2 py-0.5`
- Subtle hover state: `hover:shadow-sm transition`

### Buttons
- **Primary:** `bg-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90`
- **Secondary:** `bg-surface border border-border text-primary rounded-full px-5 py-2 text-sm hover:bg-accent-light`
- **Ghost:** `text-accent text-sm hover:underline` — for inline actions only
- No button should have square corners

### Inputs & Textareas
- `bg-surface border border-border rounded-lg px-4 py-2.5 text-sm`
- Focus: `outline-none ring-2 ring-accent/30 border-accent`
- Placeholder: `text-secondary`

### Badges / Tags
- Ranking badge: `bg-success/10 text-success text-xs font-medium rounded-full px-2.5 py-0.5`
- Source tag (resume / LinkedIn / GitHub): `bg-accent-light text-accent text-xs rounded-full px-2.5 py-0.5`

---

## Spacing & Layout

- Use an 8px base grid. All spacing should be multiples of 8 (`p-2`, `p-4`, `p-8`, etc.)
- Page padding: `px-6 py-8` on desktop, `px-4 py-6` on mobile
- Gap between cards/blocks: `gap-3`
- Never use arbitrary Tailwind values (e.g., `p-[13px]`) unless absolutely necessary

---

## General Rules

- Always use Tailwind utility classes — no inline styles, no custom CSS unless defining CSS variables in `globals.css`
- All CSS variables should be defined in `:root` inside `globals.css`
- Components should be responsive by default — design mobile-first
- No drop shadows heavier than `shadow-sm` — keep it flat and light
- No gradients on interactive elements
- Animations should be subtle: `transition duration-150 ease-in-out` for hover/focus states only
- Icons: use `lucide-react` exclusively, size `16px` or `20px`