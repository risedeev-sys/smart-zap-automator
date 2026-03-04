

## Plan: Restore Light/Dark Theme Toggle

The devvault has a complete pattern for this (slug: `theme-toggle-dark-light-system-preference`). I'll implement it using the devvault's recommended approach: ThemeProvider with localStorage persistence, toggle in the Topbar, and a FOUC-prevention script in `index.html`.

### Changes

**1. `src/components/ThemeProvider.tsx`** — Rewrite to support light/dark toggle with localStorage persistence:
- State initialized from `localStorage.getItem('theme-preference')`, defaulting to `'dark'`
- `useEffect` applies the class to `document.documentElement` and persists to localStorage
- `toggleTheme` switches between light and dark

**2. `src/components/layout/Topbar.tsx`** — Add theme toggle button:
- Import `Moon`, `Sun` from lucide-react
- Add a `Button` with the appropriate icon (Sun in dark mode, Moon in light mode) that calls `toggleTheme`
- Place it before the Settings popover

**3. `index.html`** — Add inline FOUC prevention script in `<head>`:
- Reads `localStorage('theme-preference')` synchronously before first paint
- Applies `dark` class if stored theme is dark (or defaults to dark if no preference)

### File Tree (affected)
```text
index.html                          ← FOUC script
src/components/ThemeProvider.tsx     ← full rewrite (localStorage + toggle)
src/components/layout/Topbar.tsx    ← add Sun/Moon toggle button
```

