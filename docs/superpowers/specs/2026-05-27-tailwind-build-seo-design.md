# LocalizaDoc — Tailwind CLI Build + SEO/OG Tags

**Fecha:** 2026-05-27
**Estado:** Aprobado
**Stack:** HTML, Tailwind CSS CLI, Vercel

---

## Contexto

El sitio usa Tailwind CSS vía CDN (~3MB), lo cual genera una advertencia en consola y degrada el performance en conexiones lentas (Honduras). Tampoco tiene meta tags para SEO ni OG tags para preview en WhatsApp/redes.

---

## Fase 1 — Tailwind CLI Build

### Objetivo
Reemplazar el CDN de Tailwind por un CSS generado (~20KB) mediante Tailwind CLI, integrado al pipeline de Vercel.

### Archivos

| Archivo | Acción |
|---------|--------|
| `package.json` | Crear — script de build |
| `tailwind.config.js` | Crear — content paths |
| `css/input.css` | Crear — directivas @tailwind |
| `css/tailwind.css` | Generado (gitignoreado) |
| `vercel.json` | Modificar — agregar buildCommand |
| `index.html` | Modificar — reemplazar CDN por link local |
| `zeus.html` | Modificar — reemplazar CDN por link local |
| `.gitignore` | Modificar — agregar css/tailwind.css |

### Contenidos exactos

**package.json:**
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

**tailwind.config.js:**
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

**css/input.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "rewrites": [{ "source": "/admin", "destination": "/zeus.html" }]
}
```

**En index.html y zeus.html** — reemplazar:
```html
<script src="https://cdn.tailwindcss.com"></script>
```
por:
```html
<link rel="stylesheet" href="css/tailwind.css">
```
El `<link>` de `tailwind.css` va **antes** del de `css/styles.css` para que los estilos custom tengan precedencia.

**En .gitignore** — agregar:
```
css/tailwind.css
node_modules
```
(node_modules ya puede estar presente, agregar si no está)

### Comportamiento de Vercel
Vercel detecta `package.json`, ejecuta `npm install` + `npm run build`, genera `css/tailwind.css`, luego sirve los archivos estáticos desde el directorio raíz.

### Nota sobre clases dinámicas en render.js
`render.js` asigna clases Tailwind mediante strings estáticos en template literals (e.g. `'glass-container p-3 flex justify-between'`). Tailwind CLI los detecta correctamente. No hay clases construidas dinámicamente (e.g. `p-${n}`) que requieran safelist.

---

## Fase 2 — SEO / OG Tags

### Objetivo
Añadir meta tags para mejorar el posicionamiento en buscadores y el preview al compartir en WhatsApp, Facebook y Twitter.

### index.html — agregar en `<head>`

```html
<meta name="description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
<link rel="canonical" href="https://localizadoc.vercel.app">

<meta property="og:type" content="website">
<meta property="og:url" content="https://localizadoc.vercel.app">
<meta property="og:title" content="LocalizaDoc — Encuentra tu documento perdido">
<meta property="og:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
<meta property="og:image" content="https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc">
<meta property="og:locale" content="es_HN">
<meta property="og:site_name" content="LocalizaDoc">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LocalizaDoc — Encuentra tu documento perdido">
<meta name="twitter:description" content="Plataforma comunitaria para reportar y encontrar documentos perdidos en Honduras y Centroamérica.">
<meta name="twitter:image" content="https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc">
```

### zeus.html — agregar en `<head>`
```html
<meta name="robots" content="noindex, nofollow">
```
El panel admin no debe indexarse en buscadores.

### og:image
Temporal: `https://placehold.co/1200x630/0a0a0a/39ff14?text=LocalizaDoc` (texto sobre fondo oscuro, verde lima).
Cuando exista imagen real: reemplazar ambas URLs (`og:image` y `twitter:image`) en index.html.

---

## Lo que NO cambia
- `css/styles.css` — sin modificaciones
- Lógica JS — sin modificaciones
- Estructura HTML — solo cambios en `<head>`
- `zeus.html` — solo el script CDN y el meta robots
