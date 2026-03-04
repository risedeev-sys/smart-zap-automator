

## Plan: Redesign Extension Login — Black & Blue Theme

The current popup uses a WhatsApp-green color scheme (#00a884, #111b21). The user wants it shifted to a **black and blue** palette, aligned with the RiseZap SaaS brand (primary blue from the dashboard: `hsl(220, 80%, 40%)` ≈ `#1447b3`).

### Color Palette

| Element | Current | New |
|---------|---------|-----|
| Background | `#111b21` (dark green-gray) | `#0a0e17` (near-black blue) |
| Input bg | `#1f2c34` | `#111827` (dark navy) |
| Input border | `#2a3942` | `#1e3a5f` (subtle blue) |
| Input focus | `#00a884` (green) | `#3b82f6` (bright blue) |
| Button primary | `#00a884` (green) | `#2563eb` (blue-600) |
| Button hover | `#00c896` | `#3b82f6` (blue-500) |
| Logo title | `#00a884` | `#3b82f6` |
| Subtitle | `#8696a0` | `#64748b` |
| Labels | `#8696a0` | `#94a3b8` |
| Success status | `#00a884` | `#3b82f6` |
| Logged-in email | `#00a884` | `#60a5fa` |
| Button text | `#111b21` | `#ffffff` |

### Visual Enhancements
- Subtle blue glow on the card area with a border (`border: 1px solid rgba(59,130,246,0.15)`)
- Slightly larger popup width (340px) for breathing room
- Input fields with subtle inner shadow for depth
- Button with subtle box-shadow glow on hover

### File Changed
**`extensao/popup/popup.html`** — Update all CSS color values from green-teal to black-blue palette. No structural HTML changes needed.

