# BrewFlow · Calibrador de Vertidos de Café

PWA para calibrar un café de filtro (pour-over). Con la dosis y el ratio calcula el agua total, la reparte en N vertidos (con bloom opcional), permite ajustar cada vertido a mano y guía la preparación con un temporizador con avisos sonoros. Funciona offline una vez instalada.

Stack: HTML + CSS + JavaScript sin framework, empaquetado con [Vite](https://vitejs.dev/) y desplegado en Vercel. Sin backend ni base de datos.

## Uso rápido

```bash
npm install
cp .env.example .env   # ver «Configuración»; si no existe, crea .env a mano
npm run dev            # http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Genera `dist/` (nombres de archivo sin hash, a propósito: ver «Service Worker») |
| `npm run preview` | Sirve `dist/` para probar el build |

> `server.py` (servidor estático en Python) **no sirve para ejecutar la app**: `index.js` usa `import.meta.env`, que solo existe con Vite. Usa siempre `npm run dev` o `npm run preview`.

## Configuración

El acceso está protegido por una pantalla de login. Las credenciales se leen de variables de entorno de Vite (`.env`, ignorado por git):

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `VITE_CORRECT_USER` | Usuario | `barista` |
| `VITE_CORRECT_PASS_HASH` | Hash **SHA-256 en hexadecimal** de la contraseña (64 caracteres). Si el valor no mide 64 caracteres se compara como texto plano. **Obligatoria.** | ninguno |

Hay una plantilla en `.env.example`: cópiala como `.env` y rellena el hash.

Generar el hash de una contraseña:

```bash
printf '%s' 'mi-contraseña' | shasum -a 256 | cut -d' ' -f1
```

**Sin `VITE_CORRECT_PASS_HASH` no se puede entrar:** la app no trae ninguna contraseña por defecto, el login rechaza cualquier contraseña y muestra el mensaje «Acceso no configurado: falta la variable VITE_CORRECT_PASS_HASH». Si ves ese mensaje en un despliegue, define la variable y vuelve a desplegar.

En Vercel, define las mismas variables en *Project Settings → Environment Variables* y vuelve a desplegar (Vite las incrusta en tiempo de build).

> **Aviso de seguridad:** es un control **del lado del cliente**. Las variables `VITE_*` terminan dentro del JavaScript público, así que el hash (o la contraseña, si usas texto plano) es visible para cualquiera que abra el bundle. Sirve para evitar accesos casuales, no como autenticación real. Para proteger algo sensible hace falta un backend.

## Cómo funciona

### Cálculo (`index.js`)

- **Agua total** = dosis (g) × ratio. Con 15 g y ratio 15 → 225 ml.
- **Bloom** (activo por defecto, solo si hay más de 1 vertido): el vertido 1 queda fijado en 3 × dosis (máx. el agua total) y el resto se reparte en partes iguales entre los demás.
- **Sin bloom:** reparto equitativo entre todos los vertidos.
- **Ajuste en cascada** (`recalculatePours`): al editar el vertido *i* (slider o número), los vertidos 1…*i* quedan «fijados» y lo que queda de agua se reparte en partes iguales entre los siguientes (que vuelven a ser automáticos). «Reiniciar distribución» lo deshace.
- Si la suma difiere del total en más de 0,5 ml, la insignia pasa a «Desequilibrado»; si se pasa, se muestra un aviso.
- Límites de entrada: dosis ≥ 1, ratio ≥ 1, vertidos ≥ 1 (los atributos `min`/`max` del HTML son orientativos; el código solo impone los mínimos).

### Temporizador

Máquina de estados `idle → pour → wait → pour … → completed` (tiempos de vertido y espera configurables, 30 s y 15 s por defecto; espera 0 la omite). Los avisos se sintetizan con Web Audio (sin archivos de audio): tres pitidos al empezar cada vertido, uno grave al pasar a espera y una melodía al terminar.

### PWA y Service Worker

- `public/manifest.json`: app instalable, `display: standalone`, orientación vertical.
- `public/sw.js`: cache-first con precache de los assets y caché dinámica (incluye Google Fonts). `vite.config.js` desactiva el hash de los nombres para que coincidan con la lista de precache.
- `vercel.json` sirve `sw.js` con `Cache-Control: no-cache` para que las actualizaciones lleguen.
- **Al cambiar cualquier archivo estático, sube la versión de `CACHE_NAME` en `public/sw.js`**; si no, los usuarios con la app instalada seguirán viendo la versión cacheada (cache-first).

## Estructura

```
index.html        UI (login + app en tres columnas: configuración, vertidos, temporizador)
index.js          Estado, cálculo, render, temporizador, login, registro del SW
index.css         Estilos (tema oscuro, responsive)
public/           manifest.json, sw.js, iconos (se copian tal cual a dist/)
vite.config.js    Build sin hashes
vercel.json       Cabeceras de sw.js
app.py            Script de consola: calcula líquido y vertidos iguales (prototipo original)
server.py         Servidor estático local en Python (obsoleto, ver arriba)
```

## Despliegue

Vercel detecta Vite: build `npm run build`, salida `dist/`. Repo: <https://github.com/gaelcadena5/appCalibradorCafe>.

## Desarrollo con worktrees

El trabajo se organiza por tickets del Hub de Proyectos, uno por rama y por worktree (`../calibracionCafe-wt/<n>-<slug>/`). Detalle del flujo, convenciones de rama y de commits en `CLAUDE.md`.

### Preparar un worktree

```bash
git worktree add -b <prefijo>/<n>-<slug> ../calibracionCafe-wt/<n>-<slug> main   # solo si aún no existe
cd ../calibracionCafe-wt/<n>-<slug>
cp ../../calibracionCafe/.env .env   # el .env no se versiona; ajusta la ruta si el repo principal está en otro sitio
npm ci
npm run dev -- --port 51xx           # un puerto distinto por worktree para correr varios a la vez
```

`git worktree list` muestra los activos y `git worktree remove ../calibracionCafe-wt/<n>-<slug>` elimina uno cuando su rama ya se fusionó.

## Limitaciones conocidas

- Login solo del lado del cliente (ver aviso de seguridad). La sesión se guarda en `localStorage` (`brewflow_session`) y no caduca.
- Sin tests ni linter.
- El texto del bloom en `index.html` muestra «45g» fijo aunque la dosis cambie.
- Si cambias la dosis o los vertidos durante el temporizador, la guía usa los valores nuevos al instante, sin reiniciarlo.
- El temporizador usa `setInterval` de 1 s: en segundo plano el navegador puede ralentizarlo.
