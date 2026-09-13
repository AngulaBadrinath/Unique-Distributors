# UI Neo-Dark Executive Design System Report
**Document Version:** 2.0  
**Effective Date:** September 2026  
**Status:** IMPLEMENTATION COMPLETE  
**Primary Reference:** `unique_distributors_deep_dark_erp_1789295223823.jpg` (60% Neo-Dark Executive Glass)  
**Secondary Reference:** `dark_neumorphic_erp_1789295750409.jpg` (25% Subtle Dark Neumorphism + 15% Swiss Data Discipline)

---

## 1. Visual Philosophy & Synthesis

The Unique Distributors enterprise ERP presentation layer has been rebuilt from ground zero, strictly adopting the user's locked visual direction:
- **60% Neo-Dark Executive Glass:** Midnight obsidian base canvas (`#07090E`), deep navy frosted glass containers (`#0F1626` / `#131B2E`), subtle translucent structural rim borders (`rgba(255, 255, 255, 0.08)`), floating navigation dock, and luminous cyan/electric blue chart sparklines.
- **25% Subtle Dark Neumorphic Depth:** Tactile inset well inputs (`shadow-neu-inset`), dual-tone extruded button elevations (`shadow-neu-dark` with top ambient highlight and deep drop shadow), and smooth interactive scale feedback.
- **15% Swiss Data Discipline:** Mathematical grid alignment, high-contrast monospace financial readouts, dense tabular layouts, and clear typographic hierarchy prior to color decoration.

### Dual-Surface Foundation
- **Dark Executive Surfaces:** Core application shell, navigation rails, executive command dashboards, metric cards, floating docks, and operational queues.
- **Light Data Surfaces Available:** Dedicated invoice print layouts, formal financial document exports, and high-density legal statements where white paper readability is paramount.

---

## 2. Authoritative Design Tokens (`resources/css/app.css`)

### Dark Foundation
- `--dark-base`: `#07090E`
- `--dark-canvas`: `#0A0E17`
- `--dark-surface`: `#0F1626`
- `--dark-surface-elevated`: `#131B2E`
- `--dark-rail`: `#0A0E1A`

### Light Foundation (Dual-surface system)
- `--light-base`: `#FFFFFF`
- `--light-canvas`: `#F5F7FA`
- `--light-surface`: `#FFFFFF`
- `--light-surface-muted`: `#EEF2F6`

### Text & Contrast
- Dark Surface Primary: `#F8FAFC` (Pure Crisp White)
- Dark Surface Secondary: `#94A3B8` (Cool Silver Slate)
- Light Surface Primary: `#0F172A`
- Light Surface Secondary: `#64748B`

### Brand & Action Accents
- Action Accent: `#06B6D4` (Luminous Cyan) / `#2563EB` (Electric Blue)
- Brand Surface: `rgba(6, 182, 212, 0.12)`
- Brand Surface Text: `#67E8F9`
- Brand Surface Border: `rgba(6, 182, 212, 0.28)`

### Semantic Invariants
- Success: `#10B981` (Emerald Glow: `bg-emerald-500/15 text-emerald-400 border-emerald-500/30`)
- Warning: `#F59E0B` (Amber Glow: `bg-amber-500/15 text-amber-300 border-amber-500/30`)
- Destructive: `#EF4444` (Rose Glow: `bg-rose-500/15 text-rose-300 border-rose-500/30`)

---

## 3. Primitives & Shell Upgrades

1. **`card.tsx`**: Added variants `default`, `elevated`, `interactive`, `glass`, `inset`, `brand`, `executive`, `metric`, and `light`. Equipped with `rounded-2xl` and `.shadow-neu-dark`.
2. **`button.tsx`**: Upgraded variants `default` (elevated dark navy), `secondary`, `action` (luminous cyan with `glow-cyan-subtle`), `brand`, `outline`, `ghost`, `destructive`, and `link`.
3. **`badge.tsx`**: Implemented glowing neon-pill badges matching reference widgets (`default`, `brand`, `action`, `success`, `warning`, `destructive`, `neutral`).
4. **`input.tsx`**: Inset tactile well (`bg-dark-canvas/80 shadow-neu-inset border-white/10 text-white focus:border-cyan-400`).
5. **`ResponsiveTable.tsx` & `MobileListCard.tsx`**: Rebuilt with dark slate/navy table bodies (`bg-dark-surface border-white/8`), subtle headers, and cyan active selection rows.
6. **`AppLayout.tsx`**: Floating obsidian rail (`bg-brand border-brand-border`), dark frosted glass top header (`glass-header-dark`), and dark workspace canvas.
7. **`SalesmanLayout.tsx` & `DeliveryLayout.tsx`**: Dark obsidian shells with floating glowing action docks and high-contrast status tags.
8. **`Admin/Dashboard.tsx` & `Salesman/Dashboard.tsx`**: Authored executive command composition with featured revenue sparklines, warehouse capacity rings, and operational queue cards.

---

## 4. Verification Evidence

- **TypeScript Compilation:** `tsc --noEmit` passed with 0 errors.
- **Production Build:** Vite built cleanly in 7.80s (`app-9M0jt0SJ.js`, `app-C3-y51W-.css`).
- **Backend Integrity:** 0 PHP files, migrations, models, or database queries modified.
- **Playwright & Browser Automation:** 0 instances executed (strictly omitted per policy).
