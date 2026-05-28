# LocalizaDoc Refactor & Mejoras — Plan de Implementación

> **Para agentes:** USA superpowers:subagent-driven-development o superpowers:executing-plans para ejecutar tarea por tarea.

**Goal:** Aplicar 5 fases de mejoras a LocalizaDoc: seguridad RLS, refactor modular, UX, nuevas funcionalidades y panel admin mejorado.

**Architecture:** app.js se divide en 8 módulos ES con responsabilidad única. La DB recibe columnas owner_uid/finder_uid para RLS seguro. Las fases 3-5 se construyen sobre la base modular de la fase 2.

**Tech Stack:** HTML, Tailwind CSS CDN, Font Awesome CDN, Supabase JS v2 ESM, Chart.js CDN, Vercel (deploy)

**Spec:** `docs/superpowers/specs/2026-05-26-localizadoc-refactor-design.md`

---

## FASE 1 — Seguridad (RLS Supabase)

### Task 1: Migración de DB — columnas owner_uid / finder_uid

**Files:**
- Modify: `supabase-schema.sql`

- [ ] **Step 1: Abrir SQL Editor en Supabase Dashboard y ejecutar**

```sql
-- Agregar columnas de UID
alter table documents add column if not exists owner_uid uuid;
alter table documents add column if not exists finder_uid uuid;

-- Reemplazar políticas de update y delete
drop policy if exists "Auth update" on documents;
drop policy if exists "Auth delete" on documents;

create policy "Owner or finder can update"
  on documents for update
  using (
    auth.uid() = owner_uid OR
    auth.uid() = finder_uid OR
    auth.jwt() ->> 'email' is not null
  );

create policy "Owner can delete"
  on documents for delete
  using (
    auth.uid() = owner_uid OR
    auth.jwt() ->> 'email' is not null
  );
```

- [ ] **Step 2: Verificar en Supabase Dashboard → Table Editor → documents**

Confirmar que aparecen las columnas `owner_uid` y `finder_uid` (tipo uuid, nullable).

- [ ] **Step 3: Actualizar supabase-schema.sql para documentar la migración**

Agregar al final de `supabase-schema.sql`:

```sql
-- MIGRACIÓN 2026-05-26: owner_uid / finder_uid para RLS seguro
alter table documents add column if not exists owner_uid uuid;
alter table documents add column if not exists finder_uid uuid;

drop policy if exists "Auth update" on documents;
drop policy if exists "Auth delete" on documents;

create policy "Owner or finder can update"
  on documents for update
  using (
    auth.uid() = owner_uid OR
    auth.uid() = finder_uid OR
    auth.jwt() ->> 'email' is not null
  );

create policy "Owner can delete"
  on documents for delete
  using (
    auth.uid() = owner_uid OR
    auth.jwt() ->> 'email' is not null
  );
```

- [ ] **Step 4: Commit**

```bash
git add supabase-schema.sql
git commit -m "feat: add owner_uid/finder_uid columns and tighten RLS policies"
```

---

### Task 2: Guardar owner_uid y finder_uid en app.js

**Files:**
- Modify: `js/app.js` (líneas del insert de lostForm y foundForm)

- [ ] **Step 1: Capturar el UID anónimo de Supabase al autenticar**

En `js/app.js`, localizar la línea:
```javascript
const { error: authError } = await supabase.auth.signInAnonymously();
```

Reemplazarla con:
```javascript
const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
if (authError) console.error('Supabase Auth Error:', authError);
const currentUserUid = authData?.user?.id || null;
```

- [ ] **Step 2: Incluir owner_uid en el insert del lostForm**

Localizar el insert dentro del listener del `lostForm`. Agregar `owner_uid: currentUserUid` al objeto:

```javascript
const { error } = await supabase.from('documents').insert({
    country, doc_type: docType, doc_number: docNumber,
    owner_name: document.getElementById('lostOwnerName').value.trim(),
    contact_phone: currentOwnerId,
    secondary_phone: document.getElementById('lostSecondaryPhone').value.trim() || null,
    has_reward: document.getElementById('hasReward').checked,
    status: 'lost',
    owner_id: currentOwnerId,
    owner_uid: currentUserUid   // <-- agregar esta línea
});
```

- [ ] **Step 3: Incluir finder_uid en el update de match y en el insert de found**

Localizar el `updateDoc` que cambia status a 'match' dentro del `foundForm`. Agregar `finder_uid: currentUserUid`:

```javascript
const { error } = await supabase.from('documents').update({
    status: 'match',
    finder_name: document.getElementById('finderName').value.trim(),
    finder_contact: currentOwnerId,
    hide_finder: document.getElementById('hideFinderContact').checked,
    location: document.getElementById('foundLocation').value.trim() || null,
    updated_at: new Date().toISOString(),
    finder_uid: currentUserUid   // <-- agregar esta línea
}).eq('id', report.id);
```

Y en el insert de documento found (sin match):
```javascript
const { error } = await supabase.from('documents').insert({
    country, doc_type: docType, doc_number: docNumber,
    owner_name: document.getElementById('foundOwnerName').value.trim(),
    status: 'found',
    owner_id: currentOwnerId,
    owner_uid: currentUserUid,   // <-- agregar
    finder_name: document.getElementById('finderName').value.trim(),
    finder_contact: currentOwnerId,
    finder_uid: currentUserUid,  // <-- agregar
    hide_finder: document.getElementById('hideFinderContact').checked,
    location: document.getElementById('foundLocation').value.trim() || null
});
```

- [ ] **Step 4: Verificar en browser**

Abrir `http://localhost:8080` (o servidor local), crear un reporte de pérdida, luego ir a Supabase → Table Editor → documents y confirmar que `owner_uid` tiene un UUID (no null).

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat: store owner_uid and finder_uid on document insert/update"
```

---

## FASE 2 — Refactor Modular

### Task 3: Crear js/constants.js

**Files:**
- Create: `js/constants.js`

- [ ] **Step 1: Crear el archivo**

```javascript
// js/constants.js
export const COUNTRIES = {
    'HN': { name: 'Honduras', prefix: '504', flag: '🇭🇳', docTypes: ['Tarjeta de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Carnet Residencia', 'Otro'] },
    'SV': { name: 'El Salvador', prefix: '503', flag: '🇸🇻', docTypes: ['DUI', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'GT': { name: 'Guatemala', prefix: '502', flag: '🇬🇹', docTypes: ['DPI', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'NI': { name: 'Nicaragua', prefix: '505', flag: '🇳🇮', docTypes: ['Cédula de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'CR': { name: 'Costa Rica', prefix: '506', flag: '🇨🇷', docTypes: ['Cédula de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'Otro': { name: 'Otro', prefix: '', flag: '🌎', docTypes: ['ID Nacional', 'Cédula de Ciudadanía', 'Licencia de Conducir', 'Pasaporte', 'Visa', 'Otro'] }
};

const DOC_ICONS = {
    'Tarjeta de Identidad': '🪪', 'DUI': '🪪', 'DPI': '🪪',
    'Cédula de Identidad': '🪪', 'Cédula de Ciudadanía': '🪪',
    'ID Nacional': '🪪', 'Carnet Residencia': '🪪',
    'Pasaporte': '📘', 'Visa': '📘',
    'Licencia de Conducir': '🚗',
};

export const getDocIcon = (docType) => DOC_ICONS[docType] || '📄';
export const DAYS_UNTIL_STALE = 180;
```

- [ ] **Step 2: Commit**

```bash
git add js/constants.js
git commit -m "feat: extract constants module with COUNTRIES, DOC_ICONS, getDocIcon"
```

---

### Task 4: Crear js/state.js

**Files:**
- Create: `js/state.js`

- [ ] **Step 1: Crear el archivo**

```javascript
// js/state.js
// Objeto mutable compartido entre módulos. Importar como: import { state } from './state.js'
export const state = {
    currentOwnerId: null,
    currentUserUid: null,
    allDocuments: [],
    myDocuments: [],
    thankedReportIds: new Set(),
    notifiedMatches: new Set(),
    viewingFinderInfo: new Set(),
};
```

- [ ] **Step 2: Commit**

```bash
git add js/state.js
git commit -m "feat: add shared state module"
```

---

### Task 5: Crear js/utils.js

**Files:**
- Create: `js/utils.js`

- [ ] **Step 1: Crear el archivo**

```javascript
// js/utils.js
import { COUNTRIES } from './constants.js';

export const openModal = (id) => { const m = document.getElementById(id); if (m) m.style.display = 'flex'; };
export const closeModal = (el) => {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.style.display = 'none';
};
export const copyToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
    });
};
export const showNotification = (title, messageHTML) => {
    const el = document.getElementById('notificationTitle');
    if (el) el.textContent = title;
    const msgEl = document.getElementById('notificationMessage');
    if (msgEl) msgEl.innerHTML = messageHTML;
    openModal('notificationModal');
};
export const showConfirmation = (message, onConfirm) => {
    const confirmMsg = document.getElementById('confirmationMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    if (!confirmMsg || !confirmOk || !confirmCancel) return;
    confirmMsg.innerHTML = message;
    confirmOk.addEventListener('click', () => { onConfirm(); closeModal('confirmationModal'); }, { once: true });
    confirmCancel.addEventListener('click', () => closeModal('confirmationModal'), { once: true });
    openModal('confirmationModal');
};
export const toggleButtonLoading = (formOrBtn, isLoading) => {
    const btn = formOrBtn.tagName === 'BUTTON' ? formOrBtn : formOrBtn.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.querySelector('.button-text')?.classList.toggle('hidden', isLoading);
    btn.querySelector('.button-loader')?.classList.toggle('hidden', !isLoading);
};
export const getCountryNameFromPhone = (phone) => {
    if (!phone) return '';
    for (const code in COUNTRIES) {
        if (COUNTRIES[code].prefix && phone.startsWith(COUNTRIES[code].prefix)) return COUNTRIES[code].name;
    }
    return '';
};
export const populateCountries = (selectId, defaultCountry) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    Object.keys(COUNTRIES).forEach(code => {
        const opt = document.createElement('option');
        opt.value = code; opt.textContent = COUNTRIES[code].name;
        select.appendChild(opt);
    });
    select.value = defaultCountry;
};
export const populateDocTypes = (selectEl, country) => {
    if (!selectEl || !COUNTRIES[country]) return;
    selectEl.innerHTML = '';
    (COUNTRIES[country].docTypes || []).forEach(type => {
        const opt = document.createElement('option');
        opt.value = type; opt.textContent = type;
        selectEl.appendChild(opt);
    });
};
export const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    return new Date(dateStr).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
export const obfuscateDocNumber = (num) => {
    if (!num) return '';
    return num.length > 7 ? `${num.substring(0,4)}...${num.substring(num.length-3)}` : `${num.substring(0,2)}...`;
};
export const isStaleReport = (dateStr, days = 180) => {
    if (!dateStr) return false;
    return (Date.now() - new Date(dateStr)) > days * 86400 * 1000;
};
```

- [ ] **Step 2: Commit**

```bash
git add js/utils.js
git commit -m "feat: extract utils module"
```

---

### Task 6: Crear js/api.js

**Files:**
- Create: `js/api.js`

- [ ] **Step 1: Crear el archivo**

```javascript
// js/api.js
import { supabase } from './supabase-config.js';

export const fetchAllDocuments = async () => {
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (error) { console.error('fetchAllDocuments:', error); return []; }
    return data || [];
};
export const fetchMyDocuments = async (ownerId) => {
    const { data, error } = await supabase.from('documents').select('*')
        .or(`owner_id.eq.${ownerId},finder_contact.eq.${ownerId}`)
        .order('created_at', { ascending: false });
    if (error) { console.error('fetchMyDocuments:', error); return []; }
    return data || [];
};
export const fetchHonestyWall = async () => {
    const { data, error } = await supabase.from('honesty_submissions').select('*')
        .eq('status', 'approved').order('created_at', { ascending: false });
    if (error) { console.error('fetchHonestyWall:', error); return []; }
    return data || [];
};
export const fetchSponsors = async () => {
    const { data, error } = await supabase.from('sponsors').select('*').order('created_at', { ascending: false });
    if (error) { console.error('fetchSponsors:', error); return []; }
    return data || [];
};
export const fetchThankedReports = async (ownerId) => {
    const { data, error } = await supabase.from('honesty_submissions').select('report_id').eq('owner_id', ownerId);
    if (error) { console.error('fetchThankedReports:', error); return new Set(); }
    return new Set((data || []).map(d => d.report_id));
};
export const insertLostReport = async (payload) => {
    const { error } = await supabase.from('documents').insert(payload);
    return error;
};
export const checkDuplicate = async (country, docType, docNumber) => {
    const { data } = await supabase.from('documents').select('id, status').eq('country', country)
        .eq('doc_type', docType).eq('doc_number', docNumber).in('status', ['lost', 'found', 'match']);
    return data || [];
};
export const updateMatch = async (reportId, payload) => {
    const { error } = await supabase.from('documents').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', reportId);
    return error;
};
export const insertFoundReport = async (payload) => {
    const { error } = await supabase.from('documents').insert(payload);
    return error;
};
export const deleteReport = async (reportId) => {
    const { error } = await supabase.from('documents').delete().eq('id', reportId);
    return error;
};
export const markAsRecovered = async (reportId) => {
    const { error } = await supabase.from('documents').update({ status: 'recovered', updated_at: new Date().toISOString() }).eq('id', reportId);
    return error;
};
export const incrementFinderView = async (reportId, ownerId, currentViews) => {
    const newViews = { ...currentViews, [ownerId]: (currentViews?.[ownerId] || 0) + 1 };
    const { error } = await supabase.from('documents').update({ finder_views: newViews }).eq('id', reportId);
    return error;
};
export const submitHonestyMessage = async (payload) => {
    const { error } = await supabase.from('honesty_submissions').insert(payload);
    return error;
};
export const updateFoundReport = async (reportId, finderName, location) => {
    const { error } = await supabase.from('documents').update({
        finder_name: finderName, location: location || null, updated_at: new Date().toISOString()
    }).eq('id', reportId);
    return error;
};
```

- [ ] **Step 2: Commit**

```bash
git add js/api.js
git commit -m "feat: extract api module with all Supabase calls"
```

---

### Task 7: Crear js/render.js

**Files:**
- Create: `js/render.js`

- [ ] **Step 1: Crear el archivo**

```javascript
// js/render.js
import { COUNTRIES, getDocIcon, DAYS_UNTIL_STALE } from './constants.js';
import { timeAgo, obfuscateDocNumber, getCountryNameFromPhone, isStaleReport } from './utils.js';

export const renderSkeletons = () => {
    const shimmer = `<div style="background:linear-gradient(90deg,#1a1a1a 25%,#2a2a2a 50%,#1a1a1a 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:6px;height:14px;margin-bottom:8px;"></div>`;
    if (!document.getElementById('skeleton-style')) {
        const s = document.createElement('style');
        s.id = 'skeleton-style';
        s.textContent = '@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}';
        document.head.appendChild(s);
    }
    ['stats-lost','stats-found','stats-recovered','stats-users'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div style="width:40px;height:28px;background:#2a2a2a;border-radius:4px;animation:shimmer 1.4s infinite;margin:0 auto;"></div>';
    });
    ['public-lost-list','public-found-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = [1,2,3].map(() => `<div class="glass-container p-3">${shimmer}${shimmer}</div>`).join('');
    });
};

export const renderStats = (docs) => {
    document.getElementById('stats-lost').textContent = docs.filter(r => r.status === 'lost' || r.status === 'match').length;
    document.getElementById('stats-found').textContent = docs.filter(r => r.status === 'found').length;
    document.getElementById('stats-recovered').textContent = docs.filter(r => r.status === 'recovered').length;
    const phones = new Set();
    docs.forEach(d => { if (d.owner_id) phones.add(d.owner_id); if (d.finder_contact) phones.add(d.finder_contact); });
    document.getElementById('stats-users').textContent = phones.size;
};

const emptyState = (emoji, title, subtitle) => `
    <div class="text-center py-8">
        <div class="text-4xl mb-2">${emoji}</div>
        <p class="text-gray-300 font-semibold">${title}</p>
        <p class="text-gray-500 text-sm mt-1">${subtitle}</p>
    </div>`;

export const renderPublicLists = (docs, filter = '') => {
    const cleanedFilter = filter.replace(/[-\s]/g, '').toLowerCase();
    const lostDocs = docs.filter(r => r.status === 'lost');
    const foundDocs = docs.filter(r => r.status === 'found');

    const renderList = (listId, items, isLostList) => {
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        const filtered = items.filter(r => !filter || [r.doc_type, r.country, COUNTRIES[r.country]?.name, r.owner_name]
            .some(v => v?.toLowerCase().includes(filter)) ||
            r.doc_number?.replace(/[-\s]/g,'').includes(cleanedFilter));

        if (filtered.length === 0) {
            listEl.innerHTML = filter
                ? emptyState('🔍', 'Sin resultados', `No hay documentos que coincidan con "${filter}"`)
                : isLostList
                    ? emptyState('✅', 'Sin reportes activos', '¡Buenas noticias! No hay pérdidas registradas.')
                    : emptyState('📭', 'Sin hallazgos', 'Nadie ha reportado documentos encontrados aún.');
            return;
        }
        listEl.innerHTML = '';
        filtered.forEach(r => {
            const icon = getDocIcon(r.doc_type);
            const flag = COUNTRIES[r.country]?.flag || '🌎';
            const stale = isStaleReport(r.created_at, DAYS_UNTIL_STALE);
            const waText = encodeURIComponent(`Encontré este documento en LocalizaDoc: ${r.doc_type} en ${COUNTRIES[r.country]?.name || r.country} — https://localizadoc.com`);
            const btn = isLostList
                ? `<button data-action="found-it" data-country="${r.country}" data-doctype="${r.doc_type}" data-docnumber="${r.doc_number}" class="btn-primary text-sm py-2 px-3 rounded-lg whitespace-nowrap">Yo lo encontré</button>`
                : `<button data-action="claim-it" data-country="${r.country}" data-doctype="${r.doc_type}" data-docnumber="${r.doc_number}" style="background-color:var(--brand-lime-green);" class="hover:opacity-90 text-white text-sm font-bold py-2 px-3 rounded-lg whitespace-nowrap">¡Es mío!</button>`;
            const el = document.createElement('div');
            el.className = 'glass-container p-3 flex justify-between items-center gap-2';
            el.innerHTML = `
                <div class="flex gap-3 items-start min-w-0">
                    <div class="text-2xl flex-shrink-0 mt-1">${icon}</div>
                    <div class="min-w-0">
                        <p class="font-bold text-sm truncate">${r.doc_type}</p>
                        <p class="text-gray-400 text-xs">${flag} ${COUNTRIES[r.country]?.name || r.country} · <span class="font-mono">${obfuscateDocNumber(r.doc_number)}</span></p>
                        ${r.has_reward ? `<p class="text-xs font-bold text-[var(--brand-glow-green)]">💰 ${r.reward_amount ? `Recompensa: ${r.reward_amount}` : 'Ofrece Recompensa'}</p>` : ''}
                        ${stale ? `<p class="text-xs text-yellow-600 mt-1">⚠️ Reporte de hace más de 6 meses</p>` : `<p class="text-gray-500 text-xs mt-1">${timeAgo(r.created_at)}</p>`}
                    </div>
                </div>
                <div class="flex flex-col gap-1 flex-shrink-0 items-end">
                    ${btn}
                    <a href="https://wa.me/?text=${waText}" target="_blank" class="text-green-400 hover:text-green-300 text-xs flex items-center gap-1"><i class="fab fa-whatsapp"></i> Compartir</a>
                </div>`;
            listEl.appendChild(el);
        });
    };
    renderList('public-lost-list', lostDocs, true);
    renderList('public-found-list', foundDocs, false);
};

export const renderHonestyWall = (entries) => {
    const list = document.getElementById('honesty-list');
    const countEl = document.getElementById('honesty-count');
    if (!list || !countEl) return;
    countEl.textContent = entries.length;
    list.innerHTML = entries.length === 0 ? emptyState('💝', 'Aún no hay agradecimientos', 'Cuando alguien recupere su documento, aparecerá aquí.') : '';
    entries.forEach(entry => {
        const countryName = getCountryNameFromPhone(entry.finder_contact);
        const el = document.createElement('div');
        el.className = 'glass-container p-4 border-l-4 border-cyan-400';
        el.innerHTML = `<p class="italic text-gray-200">"${entry.owner_message}"</p><p class="text-right text-sm font-bold mt-2 text-cyan-300">— Agradecimiento a ${entry.finder_name}${countryName ? ` (${countryName})` : ''}</p>`;
        list.appendChild(el);
    });
};

export const renderSponsors = (sponsors) => {
    const logoTrack = document.querySelector('.logo-track');
    if (!logoTrack) return;
    logoTrack.innerHTML = '';
    if (sponsors.length === 0) { logoTrack.innerHTML = '<p class="text-gray-400 text-center w-full">Colaboradores aparecerán aquí.</p>'; return; }
    [...sponsors, ...sponsors].forEach(sponsor => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.innerHTML = `<img src="${sponsor.logo_url}" alt="${sponsor.name}" title="${sponsor.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x80/1a1a1a/ffffff?text=Error';">`;
        slide.onclick = () => window.showSponsorInfo(sponsor);
        logoTrack.appendChild(slide);
    });
    const old = document.getElementById('dynamic-slider-style');
    if (old) old.remove();
    const s = document.createElement('style');
    s.id = 'dynamic-slider-style';
    s.textContent = `.logo-track{display:flex;width:calc(200px * ${sponsors.length * 2});animation:scroll ${sponsors.length * 5}s linear infinite}@keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(calc(-200px * ${sponsors.length}))}}`;
    document.head.appendChild(s);
};

export const renderMyReportsList = (myDocs, ownerId, thankedReportIds, notifiedMatches, viewingFinderInfo) => {
    const list = document.getElementById('reports-list');
    if (!list || !ownerId) return;
    const seen = new Set();
    const unique = myDocs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    list.innerHTML = unique.length === 0 ? emptyState('📋', 'Sin reportes', 'Aún no has reportado ningún documento.') : '';

    unique.forEach(report => {
        const reportId = report.id;
        const isOwner = report.owner_id === ownerId;
        const isFinder = report.finder_contact === ownerId;
        let statusHTML = '', actionsHTML = '';

        if (isOwner && (!isFinder || report.status === 'lost')) {
            switch (report.status) {
                case 'lost':
                    statusHTML = `<p class="text-sm text-red-400 font-semibold">Perdido</p>`;
                    actionsHTML = `<button data-action="delete-report" data-id="${reportId}" class="text-red-500 hover:text-red-400 font-semibold text-sm">Eliminar</button>`;
                    break;
                case 'match': {
                    if (!notifiedMatches.has(reportId)) {
                        if ('Notification' in window && Notification.permission === 'granted')
                            new Notification('¡Coincidencia!', { body: `Alguien encontró tu ${report.doc_type}.` });
                        notifiedMatches.add(reportId);
                    }
                    const viewCount = report.finder_views?.[ownerId] || 0;
                    let finderInfo = '';
                    if (viewCount >= 2) {
                        finderInfo = `<p class="text-xs text-yellow-400 mt-1">Límite de vistas excedido. <a href="mailto:soporte@localizadoc.com" class="underline">Contacta soporte</a>.</p>`;
                    } else if (viewCount > 0) {
                        finderInfo = report.hide_finder
                            ? `<p class="text-xs text-cyan-300 mt-1">El samaritano es anónimo.</p>`
                            : `<a href="https://wa.me/${report.finder_contact}?text=${encodeURIComponent(`Hola ${report.finder_name}, te escribo desde LocalizaDoc sobre mi ${report.doc_type}. ¡Gracias!`)}" target="_blank" class="inline-block mt-1 bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-lg"><i class="fab fa-whatsapp mr-1"></i>${report.finder_contact}</a>`;
                    } else {
                        finderInfo = `<button data-action="view-finder-info" data-id="${reportId}" class="mt-1 bg-cyan-600 text-white text-xs font-bold py-1 px-3 rounded-lg">Ver contacto del Samaritano</button>`;
                    }
                    statusHTML = `<p class="text-sm text-yellow-400 font-semibold">¡Coincidencia!</p><p class="text-xs text-gray-300">Encontrado por: <strong>${report.finder_name || 'Samaritano'}</strong></p>${report.location ? `<p class="text-xs text-gray-400">📍 ${report.location}</p>` : ''}${finderInfo}`;
                    actionsHTML = `<button data-action="mark-as-recovered" data-id="${reportId}" class="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-3 rounded-lg">Ya lo recuperé</button>`;
                    break;
                }
                case 'recovered':
                    statusHTML = `<p class="text-sm text-gray-400 font-semibold">✅ Recuperado</p>`;
                    if (report.finder_name && !thankedReportIds.has(reportId))
                        actionsHTML = `<button data-action="open-honesty-modal" data-id="${reportId}" data-finder-name="${report.finder_name}" data-finder-contact="${report.finder_contact||''}" class="bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold py-1 px-3 rounded-lg">Agradecer</button>`;
                    else if (thankedReportIds.has(reportId))
                        actionsHTML = `<p class="text-xs text-cyan-400 font-semibold">¡Agradecido! 💝</p>`;
                    break;
            }
        } else if (isFinder) {
            switch (report.status) {
                case 'found':
                    statusHTML = `<p class="text-sm text-green-400 font-semibold">Tú lo encontraste</p><p class="text-xs text-gray-400">Esperando reporte del dueño.</p>`;
                    actionsHTML = `<div class="flex flex-col items-end gap-1"><button data-action="edit-found-report" data-id="${reportId}" class="text-yellow-400 text-xs font-semibold">Editar</button><button data-action="delete-report" data-id="${reportId}" class="text-red-500 text-xs font-semibold">Eliminar</button></div>`;
                    break;
                case 'match': {
                    const waMsg = encodeURIComponent(`Hola ${report.owner_name}, te escribo desde LocalizaDoc. ¡Encontré tu ${report.doc_type}!`);
                    statusHTML = `<p class="text-sm text-cyan-400 font-semibold">¡Hiciste una Coincidencia!</p><p class="text-xs text-gray-300">Dueño: <strong>${report.owner_name}</strong></p><a href="https://wa.me/${report.contact_phone}?text=${waMsg}" target="_blank" class="inline-block mt-1 bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-lg"><i class="fab fa-whatsapp mr-1"></i>${report.contact_phone}</a>${report.secondary_phone ? `<a href="https://wa.me/${report.secondary_phone}?text=${waMsg}" target="_blank" class="inline-block mt-1 ml-1 bg-green-700 text-white text-xs font-bold py-1 px-2 rounded-lg">Alt: ${report.secondary_phone}</a>` : ''}`;
                    break;
                }
                case 'recovered':
                    statusHTML = `<p class="text-sm text-gray-400 font-semibold">Devuelto ✅</p><p class="text-xs text-gray-400">¡Gracias por tu ayuda!</p>`;
                    break;
            }
        }
        if (!statusHTML) return;
        const el = document.createElement('div');
        el.className = 'glass-container p-4 flex justify-between items-start gap-2';
        el.innerHTML = `<div class="flex-grow"><p class="font-bold text-sm">${getDocIcon(report.doc_type)} ${report.doc_type} — <span class="font-mono">${report.doc_number}</span></p>${statusHTML}${report.has_reward && isOwner ? `<p class="text-xs font-bold text-[var(--brand-glow-green)] mt-1">💰 ${report.reward_amount || 'Ofrece Recompensa'}</p>` : ''}</div><div class="text-right flex-shrink-0">${actionsHTML}</div>`;
        list.appendChild(el);
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add js/render.js
git commit -m "feat: extract render module with skeletons, improved cards, empty states, whatsapp share"
```

---

### Task 8: Crear js/api.js, js/auth.js y js/handlers.js

**Files:**
- Create: `js/auth.js`
- Create: `js/handlers.js`

> `js/api.js` ya fue creado en Task 6.

- [ ] **Step 1: Crear js/auth.js**

```javascript
// js/auth.js
import { supabase } from './supabase-config.js';
import { state } from './state.js';
import { COUNTRIES } from './constants.js';
import { populateCountries, populateDocTypes } from './utils.js';
import { fetchMyDocuments, fetchThankedReports } from './api.js';
import { renderMyReportsList } from './render.js';

export const handleLogin = (countryCode, phoneNumber, isAutoLogin = false) => {
    if ('Notification' in window && Notification.permission !== 'denied') Notification.requestPermission();
    const prefix = COUNTRIES[countryCode]?.prefix || '';
    const fullPhone = `${prefix}${phoneNumber}`;
    localStorage.setItem('userPhone', fullPhone);
    localStorage.setItem('userCountry', countryCode);
    state.currentOwnerId = fullPhone;

    const userPhoneEl = document.getElementById('userPhone');
    if (userPhoneEl) userPhoneEl.textContent = `+${fullPhone}`;
    if (!isAutoLogin) {
        if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) grecaptcha.reset();
        const btn = document.getElementById('loginButton');
        if (btn) btn.disabled = true;
    }
    document.getElementById('user-info')?.classList.remove('hidden');
    document.getElementById('logged-in-content')?.classList.remove('hidden');
    import('./utils.js').then(({ closeModal }) => closeModal('loginModal'));

    loadUserData();
    startUserListeners();
};

export const handleLogout = () => {
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userCountry');
    window.location.reload();
};

export const loadUserData = async () => {
    const ownerId = state.currentOwnerId;
    state.myDocuments = await fetchMyDocuments(ownerId);
    state.thankedReportIds = await fetchThankedReports(ownerId);
    renderMyReportsList(state.myDocuments, ownerId, state.thankedReportIds, state.notifiedMatches, state.viewingFinderInfo);
};

export const startUserListeners = () => {
    const ownerId = state.currentOwnerId;
    supabase.channel(`user-owner-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `owner_id=eq.${ownerId}` }, loadUserData)
        .subscribe();
    supabase.channel(`user-finder-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `finder_contact=eq.${ownerId}` }, loadUserData)
        .subscribe();
    supabase.channel(`user-honesty-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions', filter: `owner_id=eq.${ownerId}` }, loadUserData)
        .subscribe();
};
```

- [ ] **Step 2: Crear js/handlers.js**

```javascript
// js/handlers.js
import { state } from './state.js';
import { showNotification, showConfirmation, toggleButtonLoading, populateCountries, populateDocTypes } from './utils.js';
import { closeModal, openModal } from './utils.js';
import { checkDuplicate, insertLostReport, insertFoundReport, updateMatch, deleteReport, markAsRecovered as apiMarkAsRecovered, incrementFinderView, submitHonestyMessage, updateFoundReport } from './api.js';
import { loadUserData } from './auth.js';
import { renderMyReportsList } from './render.js';

export const setupFormHandlers = () => {
    setupLostForm();
    setupFoundForm();
    setupHonestyForm();
    setupEditFoundReportForm();
};

const setupLostForm = () => {
    document.getElementById('lostForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        const docNumber = document.getElementById('lostDocNumber').value.trim().replace(/[-\s]/g,'').toUpperCase();
        const country = document.getElementById('lostCountrySelect').value;
        const docType = document.getElementById('lostDocType').value;
        try {
            const existing = await checkDuplicate(country, docType, docNumber);
            if (existing.length > 0) { showNotification('Reporte Duplicado', 'Este documento ya ha sido reportado.'); return; }
            const hasReward = document.getElementById('hasReward').checked;
            const error = await insertLostReport({
                country, doc_type: docType, doc_number: docNumber,
                owner_name: document.getElementById('lostOwnerName').value.trim(),
                contact_phone: state.currentOwnerId,
                secondary_phone: document.getElementById('lostSecondaryPhone').value.trim() || null,
                has_reward: hasReward,
                reward_amount: hasReward ? (document.getElementById('rewardAmount')?.value.trim() || null) : null,
                status: 'lost', owner_id: state.currentOwnerId, owner_uid: state.currentUserUid
            });
            if (error) throw error;
            showNotification('¡Reporte Exitoso!', 'Tu reporte ha sido creado.');
            closeModal('lostModal'); e.target.reset();
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo crear el reporte.');
        } finally { toggleButtonLoading(button, false); }
    });

    document.getElementById('hasReward')?.addEventListener('change', (e) => {
        const rewardField = document.getElementById('rewardAmountField');
        if (rewardField) rewardField.classList.toggle('hidden', !e.target.checked);
    });
};

const setupFoundForm = () => {
    document.getElementById('foundForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        const docNumber = document.getElementById('foundDocNumber').value.trim().replace(/[-\s]/g,'').toUpperCase();
        const country = document.getElementById('foundCountrySelect').value;
        const docType = document.getElementById('foundDocType').value;
        try {
            const existing = await checkDuplicate(country, docType, docNumber);
            const finderPayload = {
                finder_name: document.getElementById('finderName').value.trim(),
                finder_contact: state.currentOwnerId,
                finder_uid: state.currentUserUid,
                hide_finder: document.getElementById('hideFinderContact').checked,
                location: document.getElementById('foundLocation').value.trim() || null,
            };
            if (existing.length > 0 && existing[0].status === 'lost') {
                const error = await updateMatch(existing[0].id, { status: 'match', ...finderPayload });
                if (error) throw error;
                showNotification('¡Coincidencia Encontrada!', 'Hemos notificado al dueño.');
            } else if (existing.length > 0) {
                showNotification('Reporte Duplicado', 'Este documento ya fue encontrado y reportado.');
            } else {
                const error = await insertFoundReport({
                    country, doc_type: docType, doc_number: docNumber,
                    owner_name: document.getElementById('foundOwnerName').value.trim(),
                    status: 'found', owner_id: state.currentOwnerId, owner_uid: state.currentUserUid,
                    ...finderPayload
                });
                if (error) throw error;
                showNotification('¡Hallazgo Registrado!', 'Guardaremos tu reporte.');
            }
            closeModal('foundModal'); e.target.reset();
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo crear el reporte.');
        } finally { toggleButtonLoading(button, false); }
    });
};

const setupHonestyForm = () => {
    document.getElementById('honestyForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        try {
            const error = await submitHonestyMessage({
                report_id: document.getElementById('honestyReportId').value,
                owner_id: state.currentOwnerId,
                finder_name: document.getElementById('honestyFinderName').value,
                finder_contact: document.getElementById('honestyFinderContact').value,
                owner_message: document.getElementById('honestyMessage').value.trim(),
                status: 'pending'
            });
            if (error) throw error;
            showNotification('¡Gracias!', 'Tu agradecimiento fue enviado para revisión.');
            closeModal('honestyModal'); e.target.reset();
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo enviar tu agradecimiento.');
        } finally { toggleButtonLoading(button, false); }
    });
};

const setupEditFoundReportForm = () => {
    document.getElementById('editFoundReportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        const reportId = document.getElementById('editFoundReportId').value;
        try {
            const error = await updateFoundReport(
                reportId,
                document.getElementById('editFinderName').value.trim(),
                document.getElementById('editFoundLocation').value.trim()
            );
            if (error) throw error;
            showNotification('Éxito', 'Reporte actualizado.');
            closeModal('editFoundReportModal');
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo actualizar.');
        } finally { toggleButtonLoading(button, false); }
    });
};

export const handleClickActions = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const { action, modalId, id, finderName, finderContact, text, country, doctype, docnumber } = target.dataset;

    const openLostModal = () => {
        if (!state.currentOwnerId) { openModal('loginModal'); return; }
        const userCountry = localStorage.getItem('userCountry') || 'HN';
        populateCountries('lostCountrySelect', userCountry);
        populateDocTypes(document.getElementById('lostDocType'), userCountry);
        document.getElementById('lostContactPhone').value = state.currentOwnerId;
        openModal('lostModal');
    };
    const openFoundModal = () => {
        if (!state.currentOwnerId) { openModal('loginModal'); return; }
        const userCountry = localStorage.getItem('userCountry') || 'HN';
        populateCountries('foundCountrySelect', userCountry);
        populateDocTypes(document.getElementById('foundDocType'), userCountry);
        document.getElementById('finderContact').value = state.currentOwnerId;
        openModal('foundModal');
    };

    switch (action) {
        case 'open-modal': openModal(modalId); break;
        case 'close-modal': closeModal(target.closest('.modal-backdrop')); break;
        case 'open-lost-modal': openLostModal(); break;
        case 'open-found-modal': openFoundModal(); break;
        case 'copy': import('./utils.js').then(({ copyToClipboard }) => copyToClipboard(text, target)); break;
        case 'delete-report':
            showConfirmation('¿Eliminar este reporte?', async () => {
                const error = await deleteReport(id);
                if (error) showNotification('Error', 'No se pudo eliminar.'); else showNotification('Eliminado', 'Reporte eliminado.');
            }); break;
        case 'mark-as-recovered':
            showConfirmation('¿Confirmas que recuperaste tu documento?', async () => {
                const error = await apiMarkAsRecovered(id);
                if (error) showNotification('Error', 'No se pudo actualizar.'); else showNotification('¡Felicidades!', 'Nos alegra que lo recuperaras.');
            }); break;
        case 'open-honesty-modal':
            document.getElementById('honestyReportId').value = id;
            document.getElementById('honestyFinderName').value = finderName;
            document.getElementById('honestyFinderContact').value = finderContact;
            openModal('honestyModal'); break;
        case 'edit-found-report': {
            const report = state.myDocuments.find(r => r.id === id);
            if (report) {
                document.getElementById('editFoundReportId').value = id;
                document.getElementById('editFinderName').value = report.finder_name || '';
                document.getElementById('editFoundLocation').value = report.location || '';
                openModal('editFoundReportModal');
            } break;
        }
        case 'view-finder-info': {
            if (state.viewingFinderInfo.has(id)) return;
            state.viewingFinderInfo.add(id);
            const report = state.myDocuments.find(r => r.id === id);
            if (!report) { state.viewingFinderInfo.delete(id); return; }
            incrementFinderView(id, state.currentOwnerId, report.finder_views).then(err => {
                if (err) { showNotification('Error', 'No se pudo mostrar la información.'); state.viewingFinderInfo.delete(id); }
            }); break;
        }
        case 'claim-it': {
            openLostModal();
            setTimeout(() => {
                const sel = document.getElementById('lostCountrySelect');
                if (sel) sel.value = country;
                populateDocTypes(document.getElementById('lostDocType'), country);
                const t = document.getElementById('lostDocType'); if (t) t.value = doctype;
                const n = document.getElementById('lostDocNumber'); if (n) n.value = docnumber;
            }, 100); break;
        }
        case 'found-it': {
            openFoundModal();
            setTimeout(() => {
                const sel = document.getElementById('foundCountrySelect');
                if (sel) sel.value = country;
                populateDocTypes(document.getElementById('foundDocType'), country);
                const t = document.getElementById('foundDocType'); if (t) t.value = doctype;
                const n = document.getElementById('foundDocNumber'); if (n) n.value = docnumber;
            }, 100); break;
        }
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add js/auth.js js/handlers.js
git commit -m "feat: extract auth and handlers modules"
```

---

### Task 9: Reescribir js/app.js como entry point

**Files:**
- Modify: `js/app.js` (reescribir completo)

- [ ] **Step 1: Reemplazar el contenido completo de js/app.js**

```javascript
// js/app.js — entry point
import { supabase } from './supabase-config.js';
import { state } from './state.js';
import { COUNTRIES } from './constants.js';
import { populateCountries, populateDocTypes, showNotification } from './utils.js';
import { openModal } from './utils.js';
import { fetchAllDocuments, fetchHonestyWall, fetchSponsors } from './api.js';
import { renderSkeletons, renderStats, renderPublicLists, renderHonestyWall, renderSponsors } from './render.js';
import { handleLogin, handleLogout, loadUserData, startUserListeners } from './auth.js';
import { setupFormHandlers, handleClickActions } from './handlers.js';

window.onCaptchaSuccess = () => { const btn = document.getElementById('loginButton'); if (btn) btn.disabled = false; };
window.onCaptchaExpired = () => { const btn = document.getElementById('loginButton'); if (btn) btn.disabled = true; };
window.showSponsorInfo = (sponsor) => {
    const details = [
        sponsor.phone ? `<p><i class="fas fa-phone mr-2 text-gray-400"></i>${sponsor.phone}</p>` : '',
        sponsor.email ? `<p><i class="fas fa-envelope mr-2 text-gray-400"></i>${sponsor.email}</p>` : '',
        sponsor.address ? `<p><i class="fas fa-map-marker-alt mr-2 text-gray-400"></i>${sponsor.address}</p>` : '',
    ].filter(Boolean).join('');
    showNotification(sponsor.name, details || '<p>Empresa colaboradora de LocalizaDoc.</p>');
};

const loadPublicData = async () => {
    const filter = document.getElementById('searchInput')?.value || '';
    state.allDocuments = await fetchAllDocuments();
    renderStats(state.allDocuments);
    renderPublicLists(state.allDocuments, filter);
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        renderSkeletons();

        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) console.error('Auth Error:', authError);
        state.currentUserUid = authData?.user?.id || null;

        await Promise.all([loadPublicData(), fetchHonestyWall().then(renderHonestyWall), fetchSponsors().then(renderSponsors)]);

        supabase.channel('global-documents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, async () => {
                await loadPublicData();
                if (state.currentOwnerId) loadUserData();
            }).subscribe();
        supabase.channel('global-honesty')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions' },
                () => fetchHonestyWall().then(renderHonestyWall)).subscribe();
        supabase.channel('global-sponsors')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' },
                () => fetchSponsors().then(renderSponsors)).subscribe();

        const savedPhone = localStorage.getItem('userPhone');
        const savedCountry = localStorage.getItem('userCountry');
        if (savedPhone && savedCountry && COUNTRIES[savedCountry]) {
            const prefix = COUNTRIES[savedCountry].prefix || '';
            const phone = prefix && savedPhone.startsWith(prefix) ? savedPhone.substring(prefix.length) : savedPhone;
            handleLogin(savedCountry, phone, true);
        } else {
            openModal('loginModal');
        }

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('loginPhone').value.trim();
            const country = document.getElementById('loginCountry').value;
            if (phone && country) handleLogin(country, phone, false);
        });
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.getElementById('searchInput')?.addEventListener('input', () =>
            renderPublicLists(state.allDocuments, document.getElementById('searchInput').value));

        const loginCountrySelect = document.getElementById('loginCountry');
        if (loginCountrySelect) {
            populateCountries('loginCountry', 'HN');
            const phonePrefix = document.getElementById('phonePrefix');
            if (phonePrefix) phonePrefix.textContent = `+${COUNTRIES['HN'].prefix}`;
            loginCountrySelect.addEventListener('change', (e) => {
                if (phonePrefix) phonePrefix.textContent = `+${COUNTRIES[e.target.value]?.prefix || ''}`;
            });
        }
        document.getElementById('lostCountrySelect')?.addEventListener('change', (e) => populateDocTypes(document.getElementById('lostDocType'), e.target.value));
        document.getElementById('foundCountrySelect')?.addEventListener('change', (e) => populateDocTypes(document.getElementById('foundDocType'), e.target.value));

        setupFormHandlers();
        document.body.addEventListener('click', handleClickActions);

    } catch (err) {
        console.error('Error crítico:', err);
        document.body.innerHTML = '<div style="color:white;padding:2rem;text-align:center;">Error grave al cargar. Revisa la consola (F12).</div>';
    }
});
```

- [ ] **Step 2: Iniciar servidor local y verificar que la app carga sin errores en consola**

```bash
python -m http.server 8080
```

Abrir `http://localhost:8080`. Verificar en consola (F12) que no hay errores de módulos ni de Supabase.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "refactor: app.js rewritten as clean entry point, split into 8 modules"
```

---

### Task 10: Refactor del Admin (zeus)

**Files:**
- Create: `js/admin/api.js`
- Create: `js/admin/render.js`
- Create: `js/admin/handlers.js`
- Modify: `js/admin.js` → renombrar a `js/admin/admin.js` y actualizar referencia en zeus.html

- [ ] **Step 1: Crear carpeta y js/admin/api.js**

```javascript
// js/admin/api.js
import { supabase } from '../supabase-config.js';

export const fetchAllReports = async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    return data || [];
};
export const fetchAllSponsors = async () => {
    const { data } = await supabase.from('sponsors').select('*').order('created_at', { ascending: false });
    return data || [];
};
export const fetchPendingHonesty = async () => {
    const { data } = await supabase.from('honesty_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
};
export const deleteSponsor = async (id) => supabase.from('sponsors').delete().eq('id', id);
export const deleteReport = async (id) => supabase.from('documents').delete().eq('id', id);
export const approveHonesty = async (id) => supabase.from('honesty_submissions').update({ status: 'approved' }).eq('id', id);
export const deleteHonesty = async (id) => supabase.from('honesty_submissions').delete().eq('id', id);
export const getSponsor = async (id) => { const { data } = await supabase.from('sponsors').select('*').eq('id', id).single(); return data; };
export const getReport = async (id) => { const { data } = await supabase.from('documents').select('*').eq('id', id).single(); return data; };
export const updateSponsor = async (id, payload) => supabase.from('sponsors').update(payload).eq('id', id);
export const insertSponsor = async (payload) => supabase.from('sponsors').insert(payload);
export const updateReport = async (id, payload) => supabase.from('documents').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
```

- [ ] **Step 2: Crear js/admin/render.js**

```javascript
// js/admin/render.js
import { deleteSponsor, deleteReport, approveHonesty, deleteHonesty, getSponsor, getReport } from './api.js';

const fmt = (d) => d ? new Date(d).toLocaleString('es-HN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';
const statusColor = { lost:'bg-red-900 text-red-300', match:'bg-orange-900 text-orange-300', found:'bg-yellow-900 text-yellow-300', recovered:'bg-green-900 text-green-300' };

export const renderMetrics = (reports, pendingHonesty) => {
    document.getElementById('metric-total').textContent = reports.length;
    document.getElementById('metric-lost').textContent = reports.filter(r => r.status === 'lost' || r.status === 'match').length;
    document.getElementById('metric-found').textContent = reports.filter(r => r.status === 'found').length;
    document.getElementById('metric-recovered').textContent = reports.filter(r => r.status === 'recovered').length;
    document.getElementById('metric-honesty-pending').textContent = pendingHonesty;
    const total = reports.length;
    const recovered = reports.filter(r => r.status === 'recovered').length;
    const rate = total > 0 ? Math.round((recovered / total) * 100) : 0;
    const rateEl = document.getElementById('metric-recovery-rate');
    if (rateEl) rateEl.textContent = `${rate}%`;
};

export const renderSponsors = (sponsors) => {
    const list = document.getElementById('sponsors-list');
    list.innerHTML = sponsors.length ? '' : '<p class="text-gray-400">No hay empresas.</p>';
    sponsors.forEach(s => {
        const el = document.createElement('div');
        el.className = 'glass-container p-3 flex justify-between items-center';
        el.innerHTML = `<div class="flex items-center gap-4"><img src="${s.logo_url}" alt="${s.name}" class="w-16 h-10 object-contain bg-white/10 rounded" onerror="this.src='https://placehold.co/64x40/1a1a1a/fff?text=Error'"><span class="font-bold">${s.name}</span></div><div class="flex gap-4"><button onclick="window.openEditSponsorModal('${s.id}')" class="text-yellow-400 hover:text-yellow-200">Editar</button><button onclick="window.deleteSponsorHandler('${s.id}')" class="text-red-400 hover:text-red-200">Eliminar</button></div>`;
        list.appendChild(el);
    });
};

export const renderHonestyPending = (submissions) => {
    const list = document.getElementById('honesty-submissions-list');
    list.innerHTML = submissions.length ? '' : '<p class="text-gray-400">No hay solicitudes pendientes.</p>';
    submissions.forEach(sub => {
        const el = document.createElement('div');
        el.className = 'glass-container p-3';
        el.innerHTML = `<p class="italic">"${sub.owner_message}"</p><p class="text-xs text-gray-400 mt-2">Por: ${sub.owner_id} | Samaritano: ${sub.finder_name || 'N/A'}</p><div class="flex justify-end gap-4 mt-2"><button onclick="window.deleteHonestyHandler('${sub.id}')" class="text-red-400 hover:text-red-200 text-sm font-bold">Eliminar</button><button onclick="window.approveHonestyHandler('${sub.id}')" class="text-green-400 hover:text-green-200 text-sm font-bold">Aprobar</button></div>`;
        list.appendChild(el);
    });
};

export const renderReportsTable = (reports, searchFilter, dateFilter, countryFilter) => {
    const tableBody = document.getElementById('reports-table-body');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = reports.filter(doc => {
        const docDate = new Date(doc.updated_at || doc.created_at);
        const dateMatch = dateFilter === 'all' || (dateFilter === 'today' && docDate >= today) || (dateFilter === 'week' && docDate >= startOfWeek) || (dateFilter === 'month' && docDate >= startOfMonth);
        const terms = [doc.doc_type, doc.doc_number, doc.owner_name, doc.owner_id, doc.status, doc.country, doc.finder_name].filter(Boolean).join(' ').toLowerCase();
        const searchMatch = !searchFilter || terms.includes(searchFilter);
        const countryMatch = !countryFilter || countryFilter === 'all' || doc.country === countryFilter;
        return dateMatch && searchMatch && countryMatch;
    });

    tableBody.innerHTML = '';
    filtered.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><span class="px-2 py-1 text-xs font-bold rounded-full ${statusColor[doc.status]||'bg-gray-700'}">${doc.status}</span></td><td>${doc.doc_type||'N/A'}</td><td>${doc.doc_number||'N/A'}</td><td>${fmt(doc.updated_at||doc.created_at)}</td><td>${doc.owner_name||'N/A'}</td><td>${doc.owner_id||'N/A'}</td><td class="flex gap-4"><button onclick="window.openEditReportModal('${doc.id}')" class="text-yellow-400 hover:text-yellow-200">Editar</button><button onclick="window.deleteReportHandler('${doc.id}')" class="text-red-400 hover:text-red-200">Eliminar</button></td>`;
        tableBody.appendChild(row);
    });
    return filtered;
};

export const renderActivityChart = (reports) => {
    const canvas = document.getElementById('activityChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const days = 30;
    const labels = [], lostData = [], foundData = [], recoveredData = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit' });
        labels.push(label);
        const dayStr = d.toISOString().split('T')[0];
        lostData.push(reports.filter(r => (r.created_at||'').startsWith(dayStr) && r.status === 'lost').length);
        foundData.push(reports.filter(r => (r.created_at||'').startsWith(dayStr) && r.status === 'found').length);
        recoveredData.push(reports.filter(r => (r.updated_at||'').startsWith(dayStr) && r.status === 'recovered').length);
    }
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Perdidos', data: lostData, backgroundColor: '#ef4444' },
            { label: 'Encontrados', data: foundData, backgroundColor: '#facc15' },
            { label: 'Recuperados', data: recoveredData, backgroundColor: '#22c55e' },
        ]},
        options: { responsive: true, plugins: { legend: { labels: { color: '#d1d5db' } } }, scales: { x: { ticks: { color: '#6b7280' } }, y: { ticks: { color: '#6b7280' }, beginAtZero: true } } }
    });
};
```

- [ ] **Step 3: Crear js/admin/handlers.js**

```javascript
// js/admin/handlers.js
import { deleteSponsor, deleteReport, approveHonesty, deleteHonesty, getSponsor, getReport, updateSponsor, insertSponsor, updateReport } from './api.js';

export const setupAdminGlobals = () => {
    window.openModal = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
    window.closeModal = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

    window.deleteSponsorHandler = async (id) => {
        if (!confirm('¿Eliminar esta empresa?')) return;
        await deleteSponsor(id);
    };
    window.deleteReportHandler = async (id) => {
        if (!confirm('¿Eliminar este reporte?')) return;
        await deleteReport(id);
    };
    window.approveHonestyHandler = async (id) => await approveHonesty(id);
    window.deleteHonestyHandler = async (id) => {
        if (!confirm('¿Eliminar esta solicitud?')) return;
        await deleteHonesty(id);
    };
    window.openEditSponsorModal = async (id) => {
        const data = await getSponsor(id);
        if (!data) return;
        document.getElementById('editSponsorId').value = id;
        document.getElementById('editSponsorName').value = data.name || '';
        document.getElementById('editSponsorLogoUrl').value = data.logo_url || '';
        document.getElementById('editSponsorPhone').value = data.phone || '';
        document.getElementById('editSponsorEmail').value = data.email || '';
        document.getElementById('editSponsorAddress').value = data.address || '';
        window.openModal('editSponsorModal');
    };
    window.openEditReportModal = async (id) => {
        const data = await getReport(id);
        if (!data) return;
        document.getElementById('editReportId').value = id;
        document.getElementById('editReportStatus').value = data.status || 'lost';
        document.getElementById('editReportDocType').value = data.doc_type || '';
        document.getElementById('editReportDocNumber').value = data.doc_number || '';
        document.getElementById('editReportOwnerName').value = data.owner_name || '';
        document.getElementById('editReportOwnerId').value = data.owner_id || '';
        window.openModal('editReportModal');
    };
};

export const setupAdminForms = () => {
    document.getElementById('addSponsorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await insertSponsor({ name: f.sponsorName.value.trim(), logo_url: f.sponsorLogoUrl.value.trim(), phone: f.sponsorPhone.value.trim()||null, email: f.sponsorEmail.value.trim()||null, address: f.sponsorAddress.value.trim()||null });
        f.reset(); window.closeModal('addSponsorModal');
    });
    document.getElementById('editSponsorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editSponsorId').value;
        await updateSponsor(id, { name: document.getElementById('editSponsorName').value.trim(), logo_url: document.getElementById('editSponsorLogoUrl').value.trim(), phone: document.getElementById('editSponsorPhone').value.trim()||null, email: document.getElementById('editSponsorEmail').value.trim()||null, address: document.getElementById('editSponsorAddress').value.trim()||null });
        window.closeModal('editSponsorModal');
    });
    document.getElementById('editReportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editReportId').value;
        await updateReport(id, { status: document.getElementById('editReportStatus').value, doc_type: document.getElementById('editReportDocType').value, doc_number: document.getElementById('editReportDocNumber').value, owner_name: document.getElementById('editReportOwnerName').value, owner_id: document.getElementById('editReportOwnerId').value });
        window.closeModal('editReportModal');
    });
};
```

- [ ] **Step 4: Crear js/admin/admin.js (entry point del admin)**

```javascript
// js/admin/admin.js
import { supabase } from '../supabase-config.js';
import { fetchAllReports, fetchAllSponsors, fetchPendingHonesty } from './api.js';
import { renderMetrics, renderSponsors, renderHonestyPending, renderReportsTable, renderActivityChart } from './render.js';
import { setupAdminGlobals, setupAdminForms } from './handlers.js';

let allReports = [];
let searchFilter = '';
let dateFilter = 'all';
let countryFilter = 'all';

const refresh = async () => {
    const [reports, sponsors, honesty] = await Promise.all([fetchAllReports(), fetchAllSponsors(), fetchPendingHonesty()]);
    allReports = reports;
    renderMetrics(reports, honesty.length);
    renderSponsors(sponsors);
    renderHonestyPending(honesty);
    renderReportsTable(allReports, searchFilter, dateFilter, countryFilter);
    renderActivityChart(allReports);
};

const setupFilters = () => {
    document.getElementById('reportSearch')?.addEventListener('input', (e) => { searchFilter = e.target.value.toLowerCase().trim(); renderReportsTable(allReports, searchFilter, dateFilter, countryFilter); });
    document.getElementById('date-filters')?.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('#date-filters .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        dateFilter = e.target.dataset.filter;
        renderReportsTable(allReports, searchFilter, dateFilter, countryFilter);
    });
    document.getElementById('countryFilter')?.addEventListener('change', (e) => { countryFilter = e.target.value; renderReportsTable(allReports, searchFilter, dateFilter, countryFilter); });
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
        const rows = renderReportsTable(allReports, searchFilter, dateFilter, countryFilter);
        const headers = ['id','status','doc_type','doc_number','country','owner_name','owner_id','created_at','updated_at'];
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `localizadoc-${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorEl = document.getElementById('login-error');
        errorEl?.classList.add('hidden');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { errorEl?.classList.remove('hidden'); return; }
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel')?.classList.remove('hidden');
        setupAdminGlobals();
        setupAdminForms();
        setupFilters();
        await refresh();
        supabase.channel('admin-all').on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, refresh).subscribe();
        supabase.channel('admin-sponsors').on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, refresh).subscribe();
        supabase.channel('admin-honesty').on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions' }, refresh).subscribe();
    });
});
```

- [ ] **Step 5: Actualizar zeus.html — cambiar src del script**

Localizar al final de `zeus.html`:
```html
<script type="module" src="js/admin.js"></script>
```
Cambiar a:
```html
<script type="module" src="js/admin/admin.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add js/admin/ zeus.html
git commit -m "refactor: split admin into modular structure under js/admin/"
```

---

## FASE 3 — UX

### Task 11: Actualizar index.html — placeholder búsqueda y campo reward_amount

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Actualizar placeholder del searchInput**

Localizar en `index.html`:
```html
placeholder="Buscar por tipo, país o número de documento..."
```
Cambiar a:
```html
placeholder="Buscar por tipo, número, país o nombre..."
```

- [ ] **Step 2: Agregar campo reward_amount en lostModal**

Localizar en `index.html` dentro del `lostForm`:
```html
<div class="flex items-center pt-2"><input id="hasReward" type="checkbox" ...
```
Reemplazar ese bloque con:
```html
<div class="flex items-center pt-2">
    <input id="hasReward" type="checkbox" class="h-4 w-4 text-[var(--brand-glow-green)] border-gray-500 rounded focus:ring-[var(--brand-glow-green)]">
    <label for="hasReward" class="ml-2 block text-sm">Ofreceré recompensa</label>
</div>
<div id="rewardAmountField" class="hidden">
    <label for="rewardAmount" class="block text-sm font-medium text-gray-300">Monto de Recompensa (Opcional)</label>
    <input type="text" id="rewardAmount" class="mt-1 block w-full px-3 py-2" placeholder="Ej: L. 500">
</div>
```

- [ ] **Step 3: Verificar en browser**

Abrir `http://localhost:8080`. Verificar que al marcar "Ofreceré recompensa" aparece el campo de monto.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add reward amount field and update search placeholder"
```

---

## FASE 4 — Panel Admin: Zeus mejorado

### Task 12: Actualizar zeus.html — Chart.js, CSV, tasa de recuperación, filtro país

**Files:**
- Modify: `zeus.html`

- [ ] **Step 1: Agregar Chart.js CDN en el `<head>` de zeus.html**

Antes de `</head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

- [ ] **Step 2: Agregar métrica de tasa de recuperación en metrics-section**

Localizar la sección `metrics-section` en `zeus.html` y agregar una card más:
```html
<div class="glass-container p-4 text-center rounded-lg col-span-2 lg:col-span-1">
    <p id="metric-recovery-rate" class="text-3xl font-bold text-purple-400">0%</p>
    <p class="text-sm text-gray-400">Recuperados</p>
</div>
```

- [ ] **Step 3: Agregar sección de gráfica de actividad**

Después de la sección `metrics-section` y antes de la sección de sponsors:
```html
<section class="glass-container p-6 mb-12">
    <h2 class="text-2xl font-bold mb-4">Actividad — Últimos 30 días</h2>
    <canvas id="activityChart" height="80"></canvas>
</section>
```

- [ ] **Step 4: Agregar botón CSV y filtro de país en sección de reportes**

Localizar el div de filtros en zeus.html:
```html
<div class="flex flex-wrap gap-4 mb-4">
    <input type="text" id="reportSearch" ...>
    <div id="date-filters" ...>
```
Agregar dentro del mismo div, después de `#date-filters`:
```html
    <select id="countryFilter" class="px-3 py-2 rounded-lg">
        <option value="all">Todos los países</option>
        <option value="HN">🇭🇳 Honduras</option>
        <option value="SV">🇸🇻 El Salvador</option>
        <option value="GT">🇬🇹 Guatemala</option>
        <option value="NI">🇳🇮 Nicaragua</option>
        <option value="CR">🇨🇷 Costa Rica</option>
        <option value="Otro">🌎 Otro</option>
    </select>
    <button id="exportCsvBtn" class="btn-primary font-bold py-2 px-4 rounded-lg">
        <i class="fas fa-download mr-2"></i>Exportar CSV
    </button>
```

- [ ] **Step 5: Verificar en browser**

Abrir `http://localhost:8080/zeus.html`, autenticarse, verificar que aparecen la gráfica, el filtro de país, el botón CSV y la tasa de recuperación.

- [ ] **Step 6: Commit**

```bash
git add zeus.html
git commit -m "feat: add activity chart, CSV export, recovery rate and country filter to admin"
```

---

## Deploy final

### Task 13: Push y verificación en producción

**Files:** ninguno nuevo

- [ ] **Step 1: Push a GitHub**

```bash
git push
```

- [ ] **Step 2: Esperar deploy automático en Vercel** (~1 minuto)

- [ ] **Step 3: Verificar en producción**

Abrir la URL de Vercel y confirmar:
- [ ] Los skeletons aparecen brevemente al cargar
- [ ] Las tarjetas muestran íconos y banderas
- [ ] El botón "Compartir" abre WhatsApp
- [ ] El campo de recompensa aparece al marcar el checkbox
- [ ] La búsqueda funciona en tiempo real
- [ ] El admin muestra gráfica, CSV y filtro de país
- [ ] El admin muestra tasa de recuperación

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "chore: verify production deploy complete"
git push
```

---

## Resumen de archivos

| Archivo | Acción |
|---------|--------|
| `supabase-schema.sql` | Modificar — migraciones Fase 1 |
| `js/constants.js` | Crear nuevo |
| `js/state.js` | Crear nuevo |
| `js/utils.js` | Crear nuevo |
| `js/api.js` | Crear nuevo |
| `js/render.js` | Crear nuevo |
| `js/auth.js` | Crear nuevo |
| `js/handlers.js` | Crear nuevo |
| `js/app.js` | Reescribir como entry point |
| `js/admin/api.js` | Crear nuevo |
| `js/admin/render.js` | Crear nuevo |
| `js/admin/handlers.js` | Crear nuevo |
| `js/admin/admin.js` | Crear nuevo |
| `js/admin.js` | Ya no se usa (reemplazado por js/admin/admin.js) |
| `index.html` | Modificar — reward field, placeholder |
| `zeus.html` | Modificar — Chart.js, CSV, filtros, gráfica |
