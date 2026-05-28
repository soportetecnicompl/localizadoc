# Tailwind CLI Build + SEO/OG Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3MB Tailwind CDN with a ~20KB compiled CSS file via Tailwind CLI, and fix/improve the existing SEO and OG meta tags in index.html and zeus.html.

**Architecture:** Tailwind CLI runs as a Vercel build step (`npm run build`) that generates `css/tailwind.css` from `css/input.css`, scaning all HTML and JS files for class names. The generated file is gitignored — Vercel regenerates it on every deploy. SEO tags already exist in index.html but use a broken image URL and weak descriptions; we update them in-place rather than adding duplicates.

**Tech Stack:** Tailwind CSS CLI v3, npm scripts, Vercel buildCommand, HTML meta tags

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Create | npm build + dev scripts |
| `tailwind.config.js` | Create | Content paths for class scanning |
| `css/input.css` | Create | Tailwind directives entry point |
| `css/tailwind.css` | Generated (gitignored) | Compiled output (~20KB) |
| `vercel.json` | Modify | Add buildCommand |
| `.gitignore` | Modify | Exclude generated CSS |
| `index.html` | Modify | Replace CDN script with `<link>`, fix OG tags |
| `zeus.html` | Modify | Replace CDN script with `<link>`, add noindex |

---

### Task 1: Create Tailwind CLI config files

**Files:**
- Create: `package.json`
- Create: `tailwind.config.js`
- Create: `css/input.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "localizadoc",
  "version": "1.0.0",
  "scripts": {
    "build": "tailwindcss -i ./css/input.css -o ./css/tailwind.css --minify",
    "dev": "tailwindcss -i ./css/input.css -o ./css/tailwind.css --watch"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

- [ ] **Step 2: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './js/**/*.js',
  ],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 3: Create css/input.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Verify the three files exist at the right paths**

Run: `ls package.json tailwind.config.js css/input.css`
Expected: all three files listed with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tailwind.config.js css/input.css
git commit -m "feat: add Tailwind CLI config files"
```

---

### Task 2: Update project config files

**Files:**
- Modify: `vercel.json`
- Modify: `.gitignore`

**Current vercel.json:**
```json
{ "rewrites": [{ "source": "/admin", "destination": "/zeus.html" }] }
```

**Current .gitignore** (relevant lines):
```
.vercel
node_modules
*.log
.claude
.superpowers
js/firebase-config.js
firestore.rules
```

- [ ] **Step 1: Update vercel.json to add buildCommand**

Replace the entire file with:
```json
{
  "buildCommand": "npm run build",
  "rewrites": [{ "source": "/admin", "destination": "/zeus.html" }]
}
```

- [ ] **Step 2: Add generated CSS and node_modules to .gitignore**

Append to the bottom of `.gitignore`:
```
css/tailwind.css
```

Note: `node_modules` is already present in .gitignore, no need to add again.

- [ ] **Step 3: Commit**

```bash
git add vercel.json .gitignore
git commit -m "feat: configure Vercel build command and gitignore generated CSS"
```

---

### Task 3: Run local build and wire HTML files

**Files:**
- Modify: `index.html` (line 26 — replace CDN script)
- Modify: `zeus.html` (line 7 — replace CDN script)

**Context:** index.html line 26 is `<script src="https://cdn.tailwindcss.com"></script>` and line 30 is `<link rel="stylesheet" href="css/styles.css">`. The Tailwind link goes between them. zeus.html line 7 is the CDN script and line 9 is the styles.css link.

- [ ] **Step 1: Install Tailwind CLI and run the build**

```bash
npm install && npm run build
```

Expected output: `Done in Xms` with no errors.
Expected result: `css/tailwind.css` is created (~15-25KB minified).

- [ ] **Step 2: Verify output file size**

```bash
wc -c css/tailwind.css
```

Expected: between 10000 and 40000 bytes. If > 100KB, the content paths are too broad.

- [ ] **Step 3: Replace Tailwind CDN in index.html**

Find (line 26):
```html
    <script src="https://cdn.tailwindcss.com"></script>
```

Replace with:
```html
    <link rel="stylesheet" href="css/tailwind.css">
```

The `<link>` for tailwind.css must come BEFORE the `<link rel="stylesheet" href="css/styles.css">` line so custom styles have precedence.

- [ ] **Step 4: Replace Tailwind CDN in zeus.html**

Find (line 7):
```html
    <script src="https://cdn.tailwindcss.com"></script>
```

Replace with:
```html
    <link rel="stylesheet" href="css/tailwind.css">
```

Same positioning rule: before the css/styles.css link.

- [ ] **Step 5: Open index.html in browser and verify visual appearance**

Open the file locally (or run a local server). Verify:
- The page renders with the dark theme intact
- Green neon accents appear
- Cards/modals have glass styling
- No bare unstyled HTML elements

- [ ] **Step 6: Commit**

```bash
git add index.html zeus.html css/tailwind.css
git commit -m "feat: replace Tailwind CDN with compiled CSS (~20KB)"
```

Note: `css/tailwind.css` is committed here only to verify the output — it's gitignored so this commit won't include it. If git add css/tailwind.css returns "nothing to add" because of gitignore, that's expected and correct. Vercel will regenerate it on deploy.

Actually: since css/tailwind.css is now in .gitignore, only commit the HTML changes:
```bash
git add index.html zeus.html
git commit -m "feat: replace Tailwind CDN with compiled CSS link"
```

---

### Task 4: Fix SEO/OG tags in index.html

**Files:**
- Modify: `index.html` (lines 8–20)

**Context:** index.html already has OG and Twitter meta tags pointing to `https://www.localizadoc.com`. The canonical URL and og:url use the real production domain — do NOT change these. Only fix:
1. `og:image` (line 15) — broken URL `https://www.localizadoc.com/social-image.png`
2. `twitter:image` (line 20) — same broken URL
3. `og:description` (line 14) — too short, improve copy
4. `og:title` (line 13) — improve copy
5. `twitter:title` (line 18) — improve copy
6. `twitter:description` (line 19) — improve copy
7. Add missing: `og:locale`, `og:site_name`

- [ ] **Step 1: Update og:image from broken URL to placeholder**

Find (line 15):
```html
    <meta property="og:image" content="https://www.localizadoc.com/social-image.png">
```
Replace with:
```html
    <meta property="og:image" content="https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc">
```

- [ ] **Step 2: Update twitter:image from broken URL to placeholder**

Find (line 20):
```html
    <meta name="twitter:image" content="https://www.localizadoc.com/social-image.png">
```
Replace with:
```html
    <meta name="twitter:image" content="https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc">
```

- [ ] **Step 3: Improve og:title**

Find (line 13):
```html
    <meta property="og:title" content="LocalizaDoc - Documentos Perdidos y Encontrados en Honduras">
```
Replace with:
```html
    <meta property="og:title" content="LocalizaDoc — Encuentra tu documento perdido">
```

- [ ] **Step 4: Improve og:description**

Find (line 14):
```html
    <meta property="og:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos.">
```
Replace with:
```html
    <meta property="og:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
```

- [ ] **Step 5: Improve twitter:title**

Find (line 18):
```html
    <meta name="twitter:title" content="LocalizaDoc - Documentos Perdidos y Encontrados en Honduras">
```
Replace with:
```html
    <meta name="twitter:title" content="LocalizaDoc — Encuentra tu documento perdido">
```

- [ ] **Step 6: Improve twitter:description**

Find (line 19):
```html
    <meta name="twitter:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos.">
```
Replace with:
```html
    <meta name="twitter:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
```

- [ ] **Step 7: Add og:locale and og:site_name after the og:image line**

After the updated og:image line, add:
```html
    <meta property="og:locale" content="es_HN">
    <meta property="og:site_name" content="LocalizaDoc">
```

- [ ] **Step 8: Verify the head block looks correct**

Read lines 8–22 of index.html. Expected result:
```html
    <meta name="description" content="Plataforma comunitaria en Honduras para reportar y encontrar documentos perdidos...">
    <meta name="keywords" content="...">
    <link rel="canonical" href="https://www.localizadoc.com">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.localizadoc.com">
    <meta property="og:title" content="LocalizaDoc — Encuentra tu documento perdido">
    <meta property="og:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
    <meta property="og:image" content="https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc">
    <meta property="og:locale" content="es_HN">
    <meta property="og:site_name" content="LocalizaDoc">
    <meta name="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://www.localizadoc.com">
    <meta name="twitter:title" content="LocalizaDoc — Encuentra tu documento perdido">
    <meta name="twitter:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
    <meta name="twitter:image" content="https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc">
```

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "fix: update OG/Twitter meta tags with correct image URL and improved copy"
```

---

### Task 5: Add noindex to zeus.html

**Files:**
- Modify: `zeus.html` (head section)

- [ ] **Step 1: Add robots noindex meta tag to zeus.html**

In zeus.html, after the `<title>` line (line 6), add:
```html
    <meta name="robots" content="noindex, nofollow">
```

The head should look like:
```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - LocalizaDoc</title>
    <meta name="robots" content="noindex, nofollow">
    <link rel="stylesheet" href="css/tailwind.css">
    ...
```

- [ ] **Step 2: Commit**

```bash
git add zeus.html
git commit -m "feat: add noindex meta tag to admin panel"
```

---

### Task 6: Push and verify Vercel deploy

- [ ] **Step 1: Push all commits to GitHub**

```bash
git push
```

- [ ] **Step 2: Monitor the Vercel build**

Go to the Vercel dashboard or check build logs. The build should:
1. Detect `package.json`
2. Run `npm install` (installs tailwindcss)
3. Run `npm run build` (generates `css/tailwind.css`)
4. Serve static files from root

Expected: Build succeeds in < 60 seconds.

- [ ] **Step 3: Verify the deployed site**

Open the production URL in a browser. Check:
- No "cdn.tailwindcss.com" CDN warning in browser console
- Tailwind styles load correctly (dark theme, green accents, glass cards)
- The page `<head>` source shows `<link rel="stylesheet" href="css/tailwind.css">` not the CDN script

- [ ] **Step 4: Verify OG preview**

Use WhatsApp or Facebook's sharing debugger to paste the production URL. Verify:
- The placehold.co image appears (dark background, green "LocalizaDoc" text)
- Title shows "LocalizaDoc — Encuentra tu documento perdido"
- Description shows the full Centroamérica copy

- [ ] **Step 5: Verify admin is noindexed**

Open the production `/admin` URL and view page source. Confirm:
```html
<meta name="robots" content="noindex, nofollow">
```
is present in the `<head>`.
