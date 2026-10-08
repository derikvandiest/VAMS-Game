# Valor Academy Middle School — Online Multiplayer PD Game

A browser-based, Habbo Hotel–style 3D multiplayer game used in teacher professional development.
The full specification lives in [PROJECT.md](PROJECT.md) — that file is the source of truth.

**Current status:** Milestone 2 — single-player prototype: you can walk a placeholder campus with WASD / arrow keys.

---

## What you need (one-time setup)

1. **Node.js** — already installed on this PC (`node --version` shows v25). On a Mac: install the LTS version from <https://nodejs.org>.
2. **VS Code** — already installed (this program).
3. That's it for Milestone 1. No accounts, no database, no other software.

---

## How to run the game (Windows)

1. Open the project folder in VS Code (**File → Open Folder…** → `C:\ELD_PD_Game`).
2. Open the built-in terminal: **View → Terminal** (or press `Ctrl` + `` ` `` — the key just left of the "1" key).
3. **First time only:** type `npm install` and press **Enter**. Wait about a minute until it finishes.
4. Type `npm run dev` and press **Enter**. Leave this window open — it starts the game.
5. Open Chrome or Edge and go to **<http://localhost:5173>**

**What you should see:** a 3D campus you can walk around — green grass, a U-shaped school building (tan walls) around an open courtyard with a fountain, a parking lot, and a gate to the north. Your blue character starts at the gate. Press **W A S D** (or the arrow keys) to walk; the camera follows you and you **cannot walk through walls**. A hint bar at the bottom reminds you of the controls, and a **green badge in the top-right corner says "Server: connected — players online: 1"**.

> Milestone 2 is **single-player only** — you will not see other players yet (that arrives in Milestone 3). The campus shape is a placeholder built from `content/layout.json`; it will be reshaped to match the real school photos in a later milestone.

### How to stop
Click inside the terminal and press `Ctrl + C`. Start it again any time with `npm run dev`.

### On a Mac
Open **Terminal** (⌘+Space, type "Terminal"), `cd` into the project folder, and use the same two commands (`npm install` once, then `npm run dev`). Visit <http://localhost:5173> in Safari or Chrome.

---

## Folder guide

| Folder / file | What it is |
|---|---|
| `PROJECT.md` | The full game spec (source of truth), including section 18 = all planning decisions |
| `README.md` | This file — plain-language instructions |
| `content/` | **All game content as editable JSON** — classrooms, NPCs, dialogue, quizzes, homerooms, character options, emojis, settings, and the campus `layout.json` (walls, doors, spawn, parking lot) |
| `client/` | The browser part of the game (Three.js 3D + UI) |
| `server/` | The Node + Socket.io server (serves the game, handles multiplayer) |
| `assets/` | Images — NPC portraits and reference photos (all placeholders for now; `npc-photos/` stays empty forever) |
| `dist/` | Built game files — created by `npm run build`, never edit by hand |
| `.env.example` | Template for secrets; copy to `.env` only when a milestone asks for it |

## Editing content

All editable content lives in `content/*.json`. Every file begins with a `_note` saying what it holds. Placeholders are clearly marked `TODO` or `PLACEHOLDER` — real content arrives at Milestone 16. **You never need to touch code to change content.**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Terminal says a port is already in use | An earlier run is still open — close extra terminal tabs, or restart VS Code |
| `npm run dev` errors immediately | Delete the `node_modules` folder, then run `npm install` again |
| Page won't load, or the badge stays gray | Make sure `npm run dev` is still running, then refresh the page |
| Things look stale after code changes | Press `Ctrl+C`, then `npm run dev` again |

## Git (version control)

The project is a Git repository. A commit is made at the end of every working milestone. To see the history, type `git log --oneline` in the terminal.

## Safety notes

- Raw staff photos are never used or stored (PROJECT.md section 18).
- Secrets go in `.env` (never committed); `.env.example` lists what is needed.
