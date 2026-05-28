# LocalizaDoc — Plan de Mejoras y Correcciones

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir bugs críticos de funcionalidad, eliminar vulnerabilidades de seguridad y refactorizar el código en archivos separados y mantenibles.

**Architecture:** Frontend estático (HTML + Vanilla JS) con Firebase Firestore/Auth. Sin bundler ni build system — los archivos JS externos se cargan como ES modules vía `<script type="module" src="...">`. Los cambios de Firebase Security Rules se aplican manualmente en la consola de Firebase.

**Tech Stack:** HTML5 · Vanilla JS (ES modules) · Firebase 11.6.1 (CDN) · Tailwind CSS (CDN) · Firebase Auth email/password (admin)

---

## Estructura de archivos resultante

```
localizadoc/
  index.html              ← Modificado: sin JS/CSS inline, sin GA duplicado
  zeus.html               ← Modificado: sin JS inline, auth por Firebase
  ads.txt                 ← Sin cambios
  firestore.rules         ← NUEVO: Security Rules para Firebase
  js/
    firebase-config.js    ← NUEVO: Config Firebase compartida
    app.js                ← NUEVO: Lógica de index.html (extraída)
    admin.js              ← NUEVO: Lógica de zeus.html (extraída)
  css/
    styles.css            ← NUEVO: Estilos compartidos (extraídos)
  docs/superpowers/plans/
    2026-05-21-localizadoc-fixes.md
```

---

## Task 1: Agregar modales faltantes en index.html

**CRÍTICO** — `showNotification()` y `showConfirmation()` referencian `#notificationModal` y `#confirmationModal` que no existen en el HTML. Esto hace que eliminar reportes y marcar como recuperado no funcionen en absoluto (la función retorna inmediatamente al no encontrar los elementos).

**Files:**
- Modify: `index.html` — agregar después de línea 134 (después de `editFoundReportModal`)

- [ ] **Step 1: Agregar notificationModal y confirmationModal**

Insertar el siguiente bloque en `index.html` inmediatamente después del cierre del div de `editFoundReportModal` (después de la línea que termina con `</div></div>` del editFoundReportModal, antes de `<script type="module">`):

```html
<div id="notificationModal" class="modal-backdrop flex">
    <div class="glass-container p-8 w-11/12 md:w-1/3 text-center modal-content">
        <h3 id="notificationTitle" class="text-xl font-bold mb-4"></h3>
        <p id="notificationMessage" class="text-gray-300 mb-6"></p>
        <button data-action="close-modal" class="btn-primary font-bold py-2 px-6 rounded-lg">Aceptar</button>
    </div>
</div>
<div id="confirmationModal" class="modal-backdrop flex">
    <div class="glass-container p-8 w-11/12 md:w-1/3 text-center modal-content">
        <p id="confirmationMessage" class="text-gray-300 mb-6"></p>
        <div class="flex justify-center gap-4">
            <button id="confirmCancel" class="btn-secondary font-bold py-2 px-6 rounded-lg">Cancelar</button>
            <button id="confirmOk" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Confirmar</button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Verificar que funciona**

Abrir `index.html` en el navegador, iniciar sesión, ir a "Mi Historial" y hacer clic en "Eliminar" sobre un reporte. Debe aparecer el modal de confirmación con los botones "Cancelar" y "Confirmar". Confirmar que al hacer clic en "Confirmar" el reporte se elimina y aparece el modal de notificación con "Reporte Eliminado".

---

## Task 2: Eliminar Google Analytics duplicado

`index.html` tiene GTM (línea 23) Y GA4 directo (líneas 24-25). GTM ya trackea GA4 internamente, así que se duplican todos los eventos.

**Files:**
- Modify: `index.html` líneas 24-25

- [ ] **Step 1: Eliminar las líneas de GA4 directo**

Eliminar de `index.html` estas dos líneas (mantener solo el GTM de línea 23):

```html
<!-- ELIMINAR estas dos líneas: -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-H6EHYEEVMQ"></script>
<script> window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-H6EHYEEVMQ'); </script>
```

Mantener solo:
```html
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src= 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f); })(window,document,'script','dataLayer','GTM-PJ5PJ5B2');</script>
```

---

## Task 3: Reemplazar contraseña hardcodeada con Firebase Auth

`zeus.html` línea 117 tiene `const ADMIN_PASSWORD = "admin2025!";` visible en el código fuente del navegador.

**Files:**
- Modify: `zeus.html`

**Paso manual requerido ANTES de ejecutar el código:**
1. Ir a [Firebase Console](https://console.firebase.google.com) → proyecto `encuentramiid`
2. Authentication → Sign-in method → habilitar **Email/Password**
3. Authentication → Users → Add user → crear: `admin@localizadoc.com` con contraseña segura
4. Guardar la contraseña en un lugar seguro (LastPass, 1Password, etc.)

- [ ] **Step 1: Actualizar los imports en zeus.html**

Reemplazar en zeus.html la línea:
```js
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
```

Con:
```js
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
```

- [ ] **Step 2: Eliminar ADMIN_PASSWORD y signInAnonymously**

Eliminar la línea:
```js
const ADMIN_PASSWORD = "admin2025!"; // Cambia la contraseña aquí.
```

Eliminar la línea dentro de `DOMContentLoaded`:
```js
signInAnonymously(getAuth(app));
```

- [ ] **Step 3: Actualizar el formulario de login admin en el HTML**

Reemplazar el formulario de login en zeus.html:
```html
<!-- ANTES -->
<form id="adminLoginForm">
    <input type="password" id="adminPassword" required class="mt-1 block w-full px-3 py-2 rounded-md shadow-sm" placeholder="Contraseña">
    <p id="login-error" class="text-red-400 text-sm mt-2 hidden">Contraseña incorrecta.</p>
    <button type="submit" class="btn-primary font-bold py-2 px-4 rounded-lg w-full mt-6">Ingresar</button>
</form>
```

```html
<!-- DESPUÉS -->
<form id="adminLoginForm">
    <input type="email" id="adminEmail" required class="mt-1 block w-full px-3 py-2 rounded-md shadow-sm mb-3" placeholder="Correo electrónico">
    <input type="password" id="adminPassword" required class="mt-1 block w-full px-3 py-2 rounded-md shadow-sm" placeholder="Contraseña">
    <p id="login-error" class="text-red-400 text-sm mt-2 hidden">Credenciales incorrectas.</p>
    <button type="submit" class="btn-primary font-bold py-2 px-4 rounded-lg w-full mt-6">Ingresar</button>
</form>
```

- [ ] **Step 4: Reemplazar el handler del login en zeus.html**

Reemplazar:
```js
document.getElementById('adminLoginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.getElementById('adminPassword').value === ADMIN_PASSWORD) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        startAdminListeners();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
});
```

Con:
```js
const auth = getAuth(app);
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        startAdminListeners();
    } catch (err) {
        errorEl.classList.remove('hidden');
        console.error('Admin login error:', err.code);
    }
});
```

- [ ] **Step 5: Verificar login**

Abrir `zeus.html`, ingresar `admin@localizadoc.com` y la contraseña creada en Firebase. Debe mostrar el panel de administración. Verificar que una contraseña incorrecta muestra "Credenciales incorrectas." sin revelar ningún detalle.

---

## Task 4: Firebase Security Rules

Sin reglas, cualquier persona puede leer y escribir toda la base de datos directamente mediante peticiones HTTP a la API de Firestore.

**Files:**
- Create: `localizadoc/firestore.rules`

**Paso manual requerido para aplicar:** Firebase Console → Firestore Database → Rules → pegar el contenido → Publish.

- [ ] **Step 1: Crear firestore.rules**

Crear el archivo `firestore.rules` con el siguiente contenido:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Función helper: usuario autenticado (incluye anónimos)
    function isAuth() {
      return request.auth != null;
    }

    // Función helper: usuario admin (autenticado con email, no anónimo)
    function isAdmin() {
      return request.auth != null && request.auth.token.email != null;
    }

    match /artifacts/encuentramiid/public/data/documents/{docId} {
      // Lectura pública
      allow read: if true;

      // Crear reporte: requiere auth + campos obligatorios + estado válido
      allow create: if isAuth()
        && request.resource.data.keys().hasAll(['country', 'docType', 'docNumber', 'status', 'ownerId', 'createdAt'])
        && request.resource.data.status in ['lost', 'found']
        && request.resource.data.docNumber is string
        && request.resource.data.docNumber.size() > 0
        && request.resource.data.docNumber.size() < 50;

      // Actualizar: requiere auth (el owner puede actualizar su propio doc o el finder puede hacer match)
      allow update: if isAuth();

      // Eliminar: requiere auth
      allow delete: if isAuth();
    }

    match /artifacts/encuentramiid/public/data/sponsors/{docId} {
      // Lectura pública
      allow read: if true;

      // Escribir: solo admin (usuario con email, no anónimo)
      allow write: if isAdmin();
    }

    match /artifacts/encuentramiid/public/data/honestySubmissions/{docId} {
      // Lectura pública (para mostrar el muro)
      allow read: if true;

      // Crear: requiere auth + campos obligatorios + estado inicial pending
      allow create: if isAuth()
        && request.resource.data.keys().hasAll(['reportId', 'ownerId', 'ownerMessage', 'status', 'createdAt'])
        && request.resource.data.status == 'pending'
        && request.resource.data.ownerMessage.size() > 0
        && request.resource.data.ownerMessage.size() < 1000;

      // Actualizar/eliminar: solo admin (aprobar o rechazar desde zeus.html)
      allow update, delete: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Aplicar las reglas**

1. Ir a [Firebase Console](https://console.firebase.google.com) → proyecto `encuentramiid`
2. Firestore Database → pestaña **Rules**
3. Reemplazar el contenido con el de `firestore.rules`
4. Hacer clic en **Publish**
5. Esperar el mensaje de confirmación

- [ ] **Step 3: Verificar que el admin puede escribir**

Abrir `zeus.html`, iniciar sesión como admin, agregar una empresa colaboradora de prueba. Debe funcionar. Intentar hacer la misma operación desde la consola del navegador en modo anónimo — debe ser rechazada con `permission-denied`.

---

## Task 5: Normalizar números de documento con toUpperCase

Para evitar que `"0801abc"` y `"0801ABC"` no hagan match, normalizar a mayúsculas al guardar Y al buscar.

**Files:**
- Modify: `index.html` — dentro de los handlers de lostForm y foundForm

- [ ] **Step 1: Actualizar lostForm handler**

En el handler del `lostForm` (dentro de `DOMContentLoaded`), cambiar la línea:
```js
const docNumber = document.getElementById('lostDocNumber').value.trim().replace(/[-\s]/g, '');
```
Por:
```js
const docNumber = document.getElementById('lostDocNumber').value.trim().replace(/[-\s]/g, '').toUpperCase();
```

- [ ] **Step 2: Actualizar foundForm handler**

En el handler del `foundForm`, cambiar la línea:
```js
const docNumber = document.getElementById('foundDocNumber').value.trim().replace(/[-\s]/g, '');
```
Por:
```js
const docNumber = document.getElementById('foundDocNumber').value.trim().replace(/[-\s]/g, '').toUpperCase();
```

---

## Task 6: Extraer Firebase config compartida

La misma `firebaseConfig` está hardcodeada en `index.html` y `zeus.html`. Si cambia algún valor hay que actualizarlo en dos lugares.

**Files:**
- Create: `js/firebase-config.js`

- [ ] **Step 1: Crear js/firebase-config.js**

```js
export const firebaseConfig = {
  apiKey: "AIzaSyDXJKtkIpHlt2gEthRPPbdNLoiwhKb-4ec",
  authDomain: "encuentramiid.firebaseapp.com",
  projectId: "encuentramiid",
  storageBucket: "encuentramiid.firebasestorage.app",
  messagingSenderId: "135387215000",
  appId: "1:135387215000:web:90288ee479172466684ced",
};

export const COLLECTIONS = {
  documents: `/artifacts/encuentramiid/public/data/documents`,
  sponsors: `/artifacts/encuentramiid/public/data/sponsors`,
  honestySubmissions: `/artifacts/encuentramiid/public/data/honestySubmissions`,
};
```

---

## Task 7: Extraer JS de index.html a js/app.js

Todo el `<script type="module">` de `index.html` (líneas 136–330) pasa a un archivo externo.

**Files:**
- Create: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Crear js/app.js**

Crear `js/app.js` con el contenido del `<script type="module">` de `index.html`, con estos cambios al inicio:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, deleteDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig, COLLECTIONS } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const reportsCollection = collection(db, COLLECTIONS.documents);
const sponsorsCollection = collection(db, COLLECTIONS.sponsors);
const honestySubmissionsCollection = collection(db, COLLECTIONS.honestySubmissions);
```

El resto del código es idéntico al inline actual (mover sin cambios, excepto eliminar la declaración de `firebaseConfig` y las líneas de `initializeApp`/`getFirestore`/`getAuth`/collections que se reemplazan por las de arriba).

- [ ] **Step 2: Reemplazar el script inline en index.html**

Eliminar el bloque completo `<script type="module">...</script>` (líneas 136–330) de `index.html` y reemplazar con:

```html
<script type="module" src="js/app.js"></script>
```

- [ ] **Step 3: Verificar que index.html funciona**

Abrir `index.html` en el navegador (debe estar servido por un servidor HTTP, no file://). Verificar: login funciona, lista de reportes carga, crear reporte funciona, eliminar muestra modal de confirmación.

**Nota:** Para probar localmente usar `npx serve .` o `python -m http.server 8080` desde la carpeta `localizadoc/`. Los ES modules no funcionan desde `file://`.

---

## Task 8: Extraer JS de zeus.html a js/admin.js

**Files:**
- Create: `js/admin.js`
- Modify: `zeus.html`

- [ ] **Step 1: Crear js/admin.js**

Crear `js/admin.js` con el contenido del `<script type="module">` de `zeus.html`, con estos cambios al inicio:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, deleteDoc, query, orderBy, addDoc, serverTimestamp, getDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig, COLLECTIONS } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sponsorsCollection = collection(db, COLLECTIONS.sponsors);
const reportsCollection = collection(db, COLLECTIONS.documents);
const honestySubmissionsCollection = collection(db, COLLECTIONS.honestySubmissions);
```

Eliminar la declaración de `firebaseConfig` y las líneas de inicialización de Firebase que se reemplazan por las de arriba. El resto del código (funciones, listeners, handlers de formularios) es idéntico al inline actual.

- [ ] **Step 2: Reemplazar el script inline en zeus.html**

Eliminar el bloque completo `<script type="module">...</script>` de `zeus.html` y reemplazar con:

```html
<script type="module" src="js/admin.js"></script>
```

- [ ] **Step 3: Verificar que zeus.html funciona**

Abrir `zeus.html`, iniciar sesión, verificar que sponsors cargan, métricas muestran datos, y los formularios de edición funcionan.

---

## Task 9: Extraer CSS compartido a css/styles.css

Los estilos de `index.html` y `zeus.html` tienen ~60% de reglas idénticas (aurora-background, glass-container, btn-primary, btn-secondary, modal-backdrop, inputs/selects).

**Files:**
- Create: `css/styles.css`
- Modify: `index.html`
- Modify: `zeus.html`

- [ ] **Step 1: Crear css/styles.css**

Crear `css/styles.css` con los estilos compartidos entre ambos archivos:

```css
body { font-family: 'Inter', sans-serif; background-color: #101010; color: #f0f0f0; overflow-x: hidden; }
:root { --brand-glow-green: #39FF14; --brand-dark-bg: #101010; --text-primary: #ffffff; --text-secondary: #a0a0a0; --container-bg: rgba(255, 255, 255, 0.05); --border-color: rgba(255, 255, 255, 0.1); --brand-lime-green: #85A60D; }
.aurora-background { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; overflow: hidden; }
.aurora-background::before, .aurora-background::after { content: ''; position: absolute; width: 600px; height: 600px; border-radius: 50%; opacity: 0.15; filter: blur(100px); animation: moveAurora 20s infinite alternate; }
.aurora-background::before { background: radial-gradient(circle, var(--brand-glow-green), transparent 60%); top: -20%; left: -20%; }
.aurora-background::after { background: radial-gradient(circle, #72C1F2, transparent 60%); bottom: -20%; right: -20%; animation-duration: 25s; animation-delay: -5s; }
@keyframes moveAurora { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(100px, 50px) scale(1.2); } 100% { transform: translate(-50px, -100px) scale(0.9); } }
.glass-container { background-color: rgba(20, 20, 20, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 1rem; }
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(16, 16, 16, 0.6); display: none; justify-content: center; align-items: center; z-index: 50; }
.modal-content { max-height: 90vh; overflow-y: auto; }
.btn-primary { background-color: var(--brand-glow-green); color: #000; font-weight: bold; transition: all 0.2s; border: 1px solid var(--brand-glow-green); }
.btn-primary:hover { background-color: transparent; color: var(--brand-glow-green); box-shadow: 0 0 15px var(--brand-glow-green); }
.btn-primary:disabled { background-color: #4a4a4a; color: #888; border-color: #4a4a4a; cursor: not-allowed; box-shadow: none; opacity: 0.5; }
.btn-secondary { background-color: transparent; color: var(--text-secondary); border: 1px solid var(--border-color); }
.btn-secondary:hover { background-color: var(--container-bg); color: var(--text-primary); }
input, select, textarea { background-color: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 0.5rem; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--brand-glow-green); box-shadow: 0 0 10px var(--brand-glow-green); }
```

- [ ] **Step 2: Actualizar index.html**

En `index.html`, reemplazar el bloque `<style>` completo con:

```html
<link rel="stylesheet" href="css/styles.css">
<style>
    /* Estilos exclusivos de index.html */
    .logo-slider { overflow: hidden; padding: 20px 0; position: relative; width: 100%; max-width: 1200px; margin: auto; }
    .logo-slider::before, .logo-slider::after { content: ''; position: absolute; top: 0; width: 100px; height: 100%; z-index: 2; }
    .logo-slider::before { left: 0; background: linear-gradient(to left, rgba(16, 16, 16, 0), #101010); }
    .logo-slider::after { right: 0; background: linear-gradient(to right, rgba(16, 16, 16, 0), #101010); }
    .logo-track { display: flex; }
    .logo-slider:hover .logo-track { animation-play-state: paused; }
    .slide { width: 200px; padding: 0 25px; flex-shrink: 0; cursor: pointer; }
    .slide img { width: 150px; height: 80px; object-fit: contain; filter: grayscale(100%) opacity(0.7); transition: all 0.3s; }
    .slide:hover img { filter: grayscale(0%) opacity(1); transform: scale(1.1); }
    .copy-btn { background-color: rgba(255,255,255,0.1); padding: 2px 8px; font-size: 10px; border-radius: 4px; margin-left: 8px; transition: all 0.2s; }
    .copy-btn:hover { background-color: rgba(255,255,255,0.2); }
</style>
```

- [ ] **Step 3: Actualizar zeus.html**

En `zeus.html`, reemplazar el bloque `<style>` completo con:

```html
<link rel="stylesheet" href="css/styles.css">
<style>
    /* Estilos exclusivos de zeus.html */
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.875rem; }
    th { font-weight: bold; color: #a0a0a0; text-transform: uppercase; }
    tbody tr:hover { background-color: rgba(255, 255, 255, 0.05); }
    .filter-btn { padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; }
    .filter-btn.active { background-color: var(--brand-glow-green); color: #000; }
    .filter-btn:not(.active) { background-color: rgba(255, 255, 255, 0.05); }
</style>
```

- [ ] **Step 4: Verificar ambas páginas visualmente**

Abrir `index.html` y `zeus.html`. Verificar que los estilos se ven idénticos a antes: fondo oscuro, aurora, botones verdes, inputs con borde sutil.

---

## Resumen de cambios manuales requeridos en Firebase Console

Antes de deployar, completar estos pasos en Firebase:

1. **Habilitar Email/Password auth:** Authentication → Sign-in method → Email/Password → Enable
2. **Crear usuario admin:** Authentication → Users → Add user → `admin@localizadoc.com` + contraseña segura
3. **Publicar Security Rules:** Firestore Database → Rules → pegar contenido de `firestore.rules` → Publish

---

## Orden de ejecución recomendado

Ejecutar las tareas en este orden para minimizar riesgo:

1. Task 1 (modales faltantes) — fix funcional inmediato, no rompe nada
2. Task 2 (Analytics duplicado) — simple, independiente
3. Task 3 (admin auth) — requiere pasos manuales en Firebase primero
4. Task 4 (Security Rules) — después de que admin auth funciona
5. Task 5 (normalizar números) — independiente
6. Task 6 (extraer config) — base para Tasks 7 y 8
7. Task 7 (app.js) — depende de Task 6
8. Task 8 (admin.js) — depende de Task 6
9. Task 9 (CSS) — independiente, al final
