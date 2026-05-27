# LocalizaDoc — Diseño de Refactorización y Mejoras

**Fecha:** 2026-05-26  
**Estado:** Aprobado  
**Stack:** HTML + Tailwind CSS + Font Awesome + Supabase + Vercel

---

## Contexto

LocalizaDoc es una plataforma comunitaria para reportar documentos perdidos y encontrados en Honduras y Centroamérica. Fue migrada de Firebase a Supabase. El código actual funciona pero tiene deuda técnica acumulada: `app.js` monolítico, RLS permisivo, sin estados de carga, y sin varias funcionalidades clave para los usuarios.

---

## Fase 1 — Seguridad (RLS Supabase)

### Problema
Las reglas RLS actuales solo verifican `auth.role() = 'authenticated'` para `update` y `delete`. Cualquier usuario anónimo puede modificar o borrar el reporte de otra persona.

### Solución
Agregar columnas de UID a `documents` para vincular cada fila al usuario de Supabase que la creó.

### Cambios en Supabase (SQL)
```sql
alter table documents add column owner_uid uuid;
alter table documents add column finder_uid uuid;

-- RLS: update solo si eres el dueño, el finder, o admin
drop policy "Auth update" on documents;
create policy "Owner or finder can update"
  on documents for update
  using (
    auth.uid() = owner_uid OR
    auth.uid() = finder_uid OR
    auth.jwt() ->> 'email' is not null
  );

-- RLS: delete solo si eres el dueño o admin
drop policy "Auth delete" on documents;
create policy "Owner can delete"
  on documents for delete
  using (
    auth.uid() = owner_uid OR
    auth.jwt() ->> 'email' is not null
  );
```

### Cambios en app.js
- Al insertar reporte de pérdida: incluir `owner_uid: currentUser.id`
- Al insertar/actualizar reporte de hallazgo (match): incluir `finder_uid: currentUser.id`
- Guardar el `user.id` en una variable de estado al hacer `signInAnonymously`

---

## Fase 2 — Refactor de Código

### Problema
`app.js` (~350 líneas densas) mezcla estado global, llamadas a Supabase, funciones de render, autenticación, handlers de formularios y suscripciones en tiempo real.

### Estructura de módulos propuesta

```
js/
├── constants.js     — COUNTRIES, DOC_ICONS
├── state.js         — variables globales exportadas (currentOwnerId, allDocuments, etc.)
├── utils.js         — openModal, closeModal, showNotification, showConfirmation,
│                      toggleButtonLoading, copyToClipboard, timeAgo,
│                      obfuscateDocNumber, populateCountries, populateDocTypes,
│                      getCountryNameFromPhone
├── api.js           — fetchAllDocuments, fetchMyDocuments, fetchHonestyWall,
│                      fetchSponsors, fetchThankedReports,
│                      insertLostReport, insertFoundReport, updateMatch,
│                      deleteReport, markAsRecovered, incrementFinderView,
│                      submitHonestyMessage, updateFoundReport
├── render.js        — renderStats, renderPublicLists, renderMyReportsList,
│                      renderHonestyWall, renderSponsors, renderSkeletons
├── auth.js          — handleLogin, handleLogout, startUserListeners
├── handlers.js      — listeners de formularios: lostForm, foundForm,
│                      honestyForm, editFoundReportForm
└── app.js           — entry point: DOMContentLoaded, conecta módulos,
                       global click handler, inicialización
```

### Principios
- Cada módulo exporta funciones puras o con dependencias explícitas
- `api.js` es el único que importa `supabase` directamente
- `render.js` recibe datos como parámetros, no los fetcha
- `app.js` no contiene lógica — solo importa y conecta

### Admin (zeus)
Mismo patrón en `js/admin/`:
```
js/admin/
├── api.js
├── render.js
├── handlers.js
└── admin.js
```

---

## Fase 3 — UX

### A. Skeleton Loaders
- Al cargar la página, antes de que lleguen datos de Supabase, mostrar placeholders animados (shimmer effect) en lugar de "0" en stats y "Sin resultados" en listas
- Implementación: función `renderSkeletons()` en `render.js` que se llama antes del primer fetch; se reemplaza con datos reales en el primer render

### B. Tarjetas de Reporte Mejoradas
- Ícono por tipo de documento:
  - 🪪 Tarjeta de Identidad, DUI, DPI, Cédula
  - 📘 Pasaporte
  - 🚗 Licencia de Conducir
  - 📄 Otros
- Bandera emoji del país (🇭🇳 🇸🇻 🇬🇹 🇳🇮 🇨🇷)
- Fecha relativa visible (`timeAgo`) ya implementada, se mantiene
- Layout: ícono a la izquierda, info en el centro, botón a la derecha

### C. Estados Vacíos Contextuales
Reemplazar `<p class="text-gray-400">Sin resultados.</p>` con:
```html
<div class="text-center py-8">
  <div class="text-4xl mb-2">{emoji}</div>
  <p class="text-gray-300 font-semibold">{título}</p>
  <p class="text-gray-500 text-sm">{subtítulo}</p>
</div>
```
Variantes: lista vacía de perdidos, lista vacía de encontrados, sin resultados de búsqueda, sin mis reportes.

### D. Placeholder de búsqueda actualizado
`"Buscar por tipo, número, país o nombre..."`

---

## Fase 4 — Nuevas Funcionalidades

### A. Compartir por WhatsApp
- Botón en cada tarjeta de la lista pública
- Texto generado: `"Encontré este documento en LocalizaDoc: [tipo] en [país] — [URL]"`
- URL: `https://wa.me/?text=...` (sin número, abre WhatsApp para elegir contacto)
- Sin cambios en DB

### B. Monto de Recompensa
- El checkbox "Ofreceré recompensa" se reemplaza por un input opcional:
  - Checkbox: "Ofreceré recompensa"
  - Si está marcado: aparece campo de texto `"Monto (ej: L. 500)"` 
- Nueva columna en Supabase: `reward_amount text`
- Se muestra en tarjeta pública como badge: `💰 Recompensa: L. 500`

### C. Búsqueda por Nombre
- Ya implementada en `renderPublicLists` — filtra por `owner_name`
- Solo actualizar placeholder del input

### D. Badge de Reporte Antiguo
- Si `created_at` tiene más de 180 días, mostrar badge en la tarjeta:
  `⚠️ Reporte de hace más de 6 meses — puede no estar activo`
- Color: amarillo/naranja
- Sin cambios en DB ni lógica del servidor

---

## Fase 5 — Panel Admin (Zeus)

### A. Exportar CSV
- Botón "Exportar CSV" en sección de reportes
- Exporta los reportes actualmente filtrados (fecha + búsqueda)
- Campos: id, status, doc_type, doc_number, country, owner_name, owner_id, created_at, updated_at
- Generado en cliente con `Blob` + `URL.createObjectURL`

### B. Gráfica de Actividad (últimos 30 días)
- Librería: **Chart.js** via CDN (`https://cdn.jsdelivr.net/npm/chart.js`)
- Tipo: barras agrupadas
- Series: Perdidos (rojo), Encontrados (amarillo), Recuperados (verde)
- Datos: agrupados por día desde `allReports` (ya disponible en memoria)

### C. Métrica de Tasa de Recuperación
- Nueva card en métricas del admin
- Cálculo: `(recovered / total_active) * 100`
- Donde `total_active = lost + match + found + recovered`
- Muestra: `"42% recuperados"`

### D. Filtro por País
- Dropdown adicional en filtros de tabla
- Opciones: Todos, Honduras, El Salvador, Guatemala, Nicaragua, Costa Rica, Otro
- Filtra `allReports` localmente (sin nueva query a Supabase)

---

## Cambios en DB (resumen de migraciones)

```sql
-- Fase 1
alter table documents add column owner_uid uuid;
alter table documents add column finder_uid uuid;
-- (+ drop/create policies detalladas arriba)

-- Fase 4B
alter table documents add column reward_amount text;
```

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase-schema.sql` | Migraciones de Fase 1 y 4B |
| `js/app.js` | Reescrito como entry point |
| `js/constants.js` | Nuevo |
| `js/state.js` | Nuevo |
| `js/utils.js` | Nuevo (extraído de app.js) |
| `js/api.js` | Nuevo (extraído de app.js) |
| `js/render.js` | Nuevo (extraído de app.js) |
| `js/auth.js` | Nuevo (extraído de app.js) |
| `js/handlers.js` | Nuevo (extraído de app.js) |
| `js/admin/api.js` | Nuevo (extraído de admin.js) |
| `js/admin/render.js` | Nuevo (extraído de admin.js) |
| `js/admin/handlers.js` | Nuevo (extraído de admin.js) |
| `js/admin/admin.js` | Reescrito como entry point |
| `index.html` | Placeholder búsqueda, campo reward_amount |
| `zeus.html` | Chart.js CDN, botón CSV, filtro país |
| `.gitignore` | Agregar `.superpowers/` |

---

## Lo que NO cambia
- `css/styles.css` — sin cambios
- `index.html` estructura general — solo cambios puntuales
- `zeus.html` estructura general — solo cambios puntuales
- `js/supabase-config.js` — sin cambios
- Lógica de negocio principal — solo reorganización
