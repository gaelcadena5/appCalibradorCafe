# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

BrewFlow: PWA calibradora de vertidos de café (dosis × ratio → agua total repartida en N vertidos, con bloom y temporizador). JavaScript plano + Vite, sin framework ni backend, desplegada en Vercel. Detalle funcional en `README.md`. Está registrado en el Hub de Proyectos (`hub-proyectos-sepia.vercel.app`) como «Calibrador de Café (BrewFlow)», id `6e589b58-4fe2-4f37-9c0d-d46d6917cdbf`, con su documentación.

## Comandos

```bash
npm run dev       # Vite en http://localhost:5173
npm run build     # genera dist/ (ignorado por git)
npm run preview   # sirve dist/
```

No hay tests ni linter. `server.py` y `app.py` son restos del prototipo en Python: `server.py` no ejecuta la app (falta `import.meta.env` sin Vite); no lo uses para verificar cambios.

## Arquitectura

Todo el código de la app está en un solo archivo, `index.js`, dentro de un `DOMContentLoaded`: objeto `state` (dosis, ratio, vertidos, `pours[]` con `{value, locked}`, y `timer`), `initializePours()` (reparto inicial), `recalculatePours()` (cascada al editar), `renderUI()` (reconstruye la lista de vertidos con `innerHTML` en cada cambio) y el temporizador (`startTimer`/`tick`/`goToNextPour`). El HTML tiene ids que `index.js` consulta al arrancar; si renombras uno, actualiza ambos.

## Cosas que no son obvias

- **Service Worker cache-first** (`public/sw.js`): al cambiar cualquier asset hay que subir `CACHE_NAME`, o los clientes instalados no verán el cambio. `vite.config.js` desactiva los hashes a propósito para que los nombres coincidan con la lista de precache; no lo cambies sin actualizar el SW.
- **Login del lado del cliente:** `VITE_CORRECT_USER` / `VITE_CORRECT_PASS_HASH` se incrustan en el bundle público. No es seguridad real: no lo presentes como tal ni pongas secretos en variables `VITE_*`. Si el valor del hash no mide 64 caracteres se compara en texto plano. `.env` está en `.gitignore`; no lo imprimas ni lo comitees. `.env.example` fue borrado del árbol de trabajo (sigue en el historial); las variables están documentadas en el README.
- `renderUI()` recrea los inputs de los vertidos, así que un `input` dispara re-render completo. Mantén eso en mente si añades foco o animaciones por vertido.
- Textos de UI y comentarios de usuario final en español; comentarios de código existentes en inglés.

## Flujo de trabajo (tickets y worktrees)

Desarrollo individual con Claude Code. Cada tarea es un **ticket del Hub** (proyecto `6e589b58-4fe2-4f37-9c0d-d46d6917cdbf`) y se trabaja en su propio **git worktree**:

- Los worktrees viven fuera del repo, en `../calibracionCafe-wt/<n>-<slug>/`, uno por ticket; la rama está registrada en el campo `rama_git` del ticket. Para ver los activos: `git worktree list`.
- Ramas: `<prefijo>/<n>-<slug>` con `feature/` (feat), `fix/`, `refactor/` o `chore/` (task). Salen de `main` (no existe `develop`). Nunca commits directos en `main`.
- Un worktree nuevo no trae `.env` ni `node_modules`: copia el `.env` del repo principal y ejecuta `npm ci` (ver README, «Preparar un worktree»).
- Ciclo: lee el ticket (descripción y criterios) → márcalo `En curso` → implementa solo lo del ticket → `npm run build` y prueba en `npm run dev` → marca cada criterio solo cuando esté comprobado → `Completada` → PR/merge a `main`.
- Hub: usa el MCP `hub` si está conectado (`/mcp`); si no, la API REST `https://hub-proyectos-sepia.vercel.app/api/v1` con el token del Llavero de macOS (`security find-generic-password -s hub-token -w`, sin imprimirlo). Los tickets no llevan estimaciones, etiquetas ni sprints.
- Casi todos los tickets tocan `index.js`: mantén los cambios acotados al ticket para minimizar conflictos. Orden de merge sugerido: #10, #11, #14, #6, luego #7 y #9, y al final #12, #13 y #8 (#12 reorganiza el código).
- Si no puedes probar algo en un navegador real (no hay tests automatizados todavía), dilo en el resumen en lugar de darlo por verificado.

## Convenciones

- **Conventional Commits** en español, imperativo y minúscula inicial, sin punto final: `fix(auth): quitar el hash por defecto del bundle`. Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`. Alcances útiles: `auth`, `timer`, `calculo`, `ui`, `pwa`, `build`. Un commit = un cambio lógico.
- Referencia al ticket con un pie `Ticket: <n>` (no uses `#<n>`: GitHub lo enlazaría con un issue/PR ajeno).
- No hagas `push`, abras PRs ni despliegues sin que el usuario lo pida. Antes de borrar archivos o datos, míralos.
- No imprimas ni commitees `.env` ni el token del hub.
