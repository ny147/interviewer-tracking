web application/stitch/projects/10192477097902651317/screens/f84012c7de434a11a835519858f4edf9
# Design Specification: Sanctuary HR (Curated Candidate Evaluation)

## 1. Creative North Star: "The Curated Sanctuary"
In the saturated world of recruitment, this design system provides a "Curated Sanctuary" for decision-makers. It trades the raw energy of neo-brutalism for a sophisticated, calm, and airy aesthetic inspired by modern health and wellness platforms.

- **Soft & Serene:** A palette of stone, emerald, and mint creates a sense of trust and focused calm.
- **Organic Precision:** Large border radii (ROUND_FULL) and generous whitespace make the interface feel approachable yet highly organized.
- **Editorial Clarity:** High-quality typography (Epilogue) and a focus on visual hierarchy ensure that critical data points are easy to digest.

---

## 2. Design Tokens (Theme)

### Color Palette
- **Background (Base):** `#FAFAF9` (Stone 50) - A warm, off-white for a clean look.
- **Background (Dark):** `#0F172A` (Slate 950) - Used for deep contrast in dark mode or sidebars.
- **Primary (Action):** `#10B981` (Emerald 500) - Represents growth and vitality.
- **Secondary (Accent):** `#34D399` (Emerald 400) - For hover states and subtle highlights.
- **Text:** `#44403C` (Stone 700) for body; `#064E3B` (Emerald 900) for headers.

### Typography
- **Primary Font:** Epilogue
- **Headings:** Semi-Bold (600), tracking-tight, with a focus on clear information grouping.
- **Body:** Regular (400) to Medium (500) for comfortable reading.
- **Accents:** Small-caps or bold emerald text for labels.

### Borders & Shadows
- **Borders:** Subtle 1px borders in `Stone 200` to define sections without adding visual weight.
- **Shadows:** Very soft, blurred shadows (e.g., `shadow-sm` or `shadow-md` with low opacity) to create depth.
- **Rounding:** `24px` to `Full` (pill-shaped) for a soft, modern feel.

---

## 3. Component Architecture

### TopNavBar
- **Style:** Glassmorphism effect with `backdrop-blur-xl`, floating or docked with no hard borders.
- **Interactive:** Active links feature a soft emerald underline.

### SideNavBar
- **Style:** Large corner radius (rounded-r-[3rem]), contrasting background for a "docked" feel.
- **Navigation:** Pill-shaped active states with a soft emerald background.

### Evaluation Card / Form
- **Sliders:** Soft, rounded tracks with emerald thumbs for a tactile experience.
- **Pills:** Highly rounded status badges with soft background colors (e.g., Mint for 'Interviewing').

---

## 4. Key User Flows & UX Patterns

### Candidate Discovery
- **Pattern:** Clean, airy card grid with ample whitespace.
- **Focus:** Quick access to 'Evaluate' and clear status visualization.

### Scoring Experience
- **Focus:** Reducing cognitive load. Sliders are large and easy to interact with.
- **Feedback:** Success messages use soft green tones to reinforce positive actions.

### Summary Analytics
- **Visuals:** Minimalist charts with soft color transitions.
- **Recommendations:** Prominent but softly styled badges (e.g., 'Strong Hire' in a pill-shaped emerald badge).

---

## 5. Implementation Notes for Development
- Use Tailwind CSS with a focus on `rounded-3xl` and `rounded-full`.
- Implement `backdrop-filter: blur()` for top navigation.
- Prioritize whitespace; sections should feel "breathable" and never cramped.
