# Putting the game on a website

The game is one Node server that does everything: it serves the game files to the browser **and** runs multiplayer
(Socket.io). So you deploy one thing, get one web address, and players just open it in Chrome, Edge, Safari or
Firefox. Nothing to install.

## 1. Try the website version on your own computer

```
npm install
npm run prod
```

Open <http://localhost:3001>. This is exactly what the website will run: the built game (`npm run build` → `dist/`)
served by the server (`npm start`).

Check it is healthy: <http://localhost:3001/api/health> shows `{"ok":true, "players":…}`.

## 2. Pick a host

Multiplayer needs a server that is **always on** and supports **WebSockets**. Static-only hosts (GitHub Pages,
Netlify, Vercel static) won't work for multiplayer.

| Host | How | Notes |
|---|---|---|
| **Render** (easiest) | Push the project to GitHub → Render dashboard → **New → Blueprint** → pick the repo. `render.yaml` sets it up. | Use a paid "Starter" instance: the free one sleeps after 15 min idle and drops players. |
| **Railway** | New project → Deploy from GitHub repo. It finds the `Dockerfile`. | Pay-as-you-go. |
| **Fly.io** | `fly launch` in the project folder (uses the `Dockerfile`). | Keep at least 1 machine running. |
| **Any VPS / school server** | Install Node 20+, then `npm ci && npm run build && npm start` (or `docker build` / `docker run`). | Put it behind HTTPS (e.g. Caddy or nginx). |

## 3. Settings (environment variables)

| Variable | What | Default |
|---|---|---|
| `PORT` | Port to listen on. Hosts set this for you. | `3001` |
| `NODE_ENV` | Set to `production` on the website (turns on browser caching). | – |
| `ADMIN_PASSWORD` | For the host/admin page (later milestone). Never commit it. | – |

Copy `.env.example` to `.env` for local use; on a host, set them in its dashboard.

## 4. What is already in place

- **One address for everything**: the browser connects to multiplayer on the same address the page came from, so
  there is nothing to configure per host. WebSockets fall back to long-polling on strict school networks.
- **Single player works everywhere**; multiplayer needs the server (it is the same server).
- **Caching**: game code files are cached by browsers for a year (their names change every build); 3D models for
  a week; the page itself is always re-checked, so a new release shows up right away.
- **Health check** at `/api/health` (hosts use it to restart a stuck server).
- **Graceful restarts**: when the host deploys a new version the server closes cleanly.
- **Smaller download**: unused 3D files were moved out of the website (to `assets/unused-public/`); the site is
  about 43 MB, mostly the character models, loaded once and then cached.
- **Security basics**: no-sniff / frame / referrer headers, works behind the host's HTTPS proxy.

## 5. Still to do before going public

- **A real domain + HTTPS** (most hosts give you `something.onrender.com` with HTTPS for free; add your own domain
  in the host's dashboard).
- **Saved progress is per browser** (localStorage). Players on another computer start over. Accounts or cloud
  saves would need a database.
- **One server instance**: all players share one server's memory (fine for a staff PD of dozens of players). Scaling
  to several instances later needs a shared store (e.g. Redis) for Socket.io.
- **Content**: replace every "(Sample text)" line and the survey QR placeholder.
- **Privacy**: no player data leaves the browser except names and positions while playing multiplayer. Review with
  your school before inviting students.
