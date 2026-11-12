# Valor Academy Middle School — Online Multiplayer PD Game

A browser-based, Habbo Hotel–style 3D multiplayer game used in teacher professional development.
The full specification lives in [PROJECT.md](PROJECT.md) — that file is the source of truth.

**Current status:** Milestone 2 — single-player prototype: walk a two-story campus (two L-shaped buildings around a grass field, parking lot to the west), climb exterior stairs to second floors with walkways to the upstairs classrooms, orbit the camera, click the compass to face north, sprint with Shift, zoom with the scroll wheel, and open/close the gate between the buildings with Spacebar.

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

**What you should see:** a 3D campus — an asphalt ground with a paved inner courtyard and a rectangular **grass field** in the middle, framed by **two buildings** forming an L (a west building and a north building). To the west of the buildings is a **parking lot** featuring compact stalls with painted divider stripes and concrete wheel stoppers, filled with diverse vehicles (sedans, SUVs, electric cars, compacts, and a white Ford double backdoor van) with **scattered empty spots** open for parking and driving. Facing the parking lot at the Main Office entrance, an official **"VALOR ACADEMY MIDDLE SCHOOL"** gold-framed dimensional sign with the lion crest and twin architectural spotlights is mounted on the second-floor facade directly above the glass double doors, with an architectural **"FRONT OFFICE"** transom plaque mounted above the double doors. Across the courtyard on the MPR building, a matching **"MPR"** header plaque is mounted above the MPR double doors. In the **south-west corner of the parking lot**, a **dumpster enclosure** features a beige brick masonry wall, east-facing steel service gates opening to the drive aisle, a concrete pad with yellow safety bollards, a **green trash dumpster** ("TRASH ONLY"), and a **blue recycling dumpster** ("RECYCLE ONLY") both facing east. In the inner breezeway between the Office and West building sits a **signature red double-door gate** with ornamental ironwork, pickets, spear finials, diagonal braces, cane bolts, and a slide latch that swings open and closed with **Spacebar**. Under the covered awning sit **round tables with umbrellas** where characters can sit.

Your blue character starts in the parking lot. Press **W A S D** (or the arrow keys) to walk; the camera follows you. Each building is **two stories**: walk up the **exterior stairs** (south side of the west building, east side of the north building) to the **second floor**, where a **walkway** leads to the 4 upstairs classrooms (railings stop you at the edge of the roof). A **table awning** and the hallway over the second floor overhang the ground-floor door area so they read as supporting structures.

**Controls:**

| Action | Control |
| --- | --- |
| Walk | **W A S D** or arrow keys |
| Sprint | Hold **Shift** (×2.5× speed while held) |
| Look around | **Right-click + drag** to orbit the camera around you (rotates / raises-lowers) |
| Clamp to north | Click the **compass** (top-left) to snap the view to north-up |
| Zoom | **Scroll wheel** zooms smoothly from a close-up of your character to a campus overview; right-drag up/down tilts the view |
| Open / close the gate | **Spacebar** when standing within ~3.5 units of the gate |
| Kick soccer ball | Walk or sprint into the ball on the grass field |
| Pick up basketball | Walk over the ball on the basketball court |
| Shoot basketball | Press **Spacebar** or **Click** (or **F** / **E**) while holding basketball |
| Reset balls | Step on the **water runoff vent** in the bottom-right corner of the grass (or press **B**) |
| Sit at table | Walk up to any outdoor chair under the awning and press **E** (press **E** or **WASD** to stand) |
| Enter & drive car | Walk up to any car in the parking lot and press **E** to enter |
| Drive car controls | **W** (gas), **S** (brake/reverse), **A/D** (steer), **Shift** (turbo boost), **E** (exit car) |

<!-- The camera stays locked to your character during orbit + zoom. The W A S D keys move you relative to the **screen** (W is always "up" the screen), so they work no matter what angle you are viewing the campus from or where the compass is pointing. -->

> Milestone 2 is **single-player only** — you will not see other players yet (that arrives in Milestone 3). The "second floor" is currently a walkable platform with walls and a marked walkway (a prototype; real furnished interiors arrive at Milestone 7). The campus shape is a placeholder built from `content/layout.json`; it will be reshaped to match the real school photos in a later milestone. Tabletops are included (with umbrellas and a covered awning), cars are split into two parking rows, and the gate between the buildings opens and closes on **Spacebar** when you are nearby. The camera stays locked to the player and can be zoomed with the scroll wheel.

### How to stop

Click inside the terminal and press `Ctrl + C`. Start it again any time with `npm run dev`.

### On a Mac

Open **Terminal** (⌘+Space, type "Terminal"), `cd` into the project folder, and use the same two commands (`npm install` once, then `npm run dev`). Visit <http://localhost:5173> in Safari or Chrome.

---

## Folder guide

| Folder / file | What it is |
| --- | --- |
| `PROJECT.md` | The full game spec (source of truth), including section 18 = all planning decisions |
| `README.md` | This file — plain-language instructions |
| `content/` | **All game content as editable JSON** — classrooms, NPCs, dialogue, quizzes, homerooms, character options, emojis, settings, and the campus `layout.json` (walls, doors, spawn, parking lot, cars, tables, gates) |
| `client/` | The browser part of the game (Three.js 3D + UI) — scene.ts builds the campus, terrain, cars, tables, gate, and walkways |
| `server/` | The Node + Socket.io server (serves the game, handles multiplayer) |
| `assets/` | Images — NPC portraits and reference photos (all placeholders for now; `npc-photos/` stays empty forever) |
| `dist/` | Built game files — created by `npm run build`, never edit by hand |
| `.env.example` | Template for secrets; copy to `.env` only when a milestone asks for it |

## Control summary

| Action | Control |
| --- | --- |
| Walk | **W A S D** or arrow keys |
| Sprint | Hold **Shift** (×2.5× speed while held) |
| Look around | **Right-click + drag** to orbit the camera around you (rotates / raises-lowers) |
| Clamp to north | Click the **compass** (top-left) to snap the view to north-up |
| Zoom | **Scroll wheel** zooms smoothly from a close-up of your character to a campus overview; right-drag up/down tilts the view |
| Shoot basketball | Press **Spacebar** or **Click** (or **F** / **E**) while holding basketball |
| Reset soccer & basketball | Walk onto the **water runoff vent** in the bottom-right corner of the grass (or press **B**) |
| Sit at table | Press **E** near any chair (press **E** or **WASD** to stand) |
| Drive car | Press **E** near car to enter; **W** gas, **S** brake/reverse, **A/D** steer, **Shift** boost, **E** exit |
| Reset cars | Press **E** or **Click** the **Car Reset Button** on the right side of the office double door |
| Chat | Press **Enter** to focus chat (bottom-right); type `@username` for private DMs; click **👍** or **❤️** to react |
| Enter / Exit MPR | Press **Spacebar** near the MPR double doors (`x = -14, z = 51.5`) or near the interior exit doors |

**Parking lot, cars & perimeter:**

| Item | Detail |
| --- | --- |
| Parking lot | Asphalt floor is dark (`#333`, black-ish) with compact parking stalls (`2.85m` step) and white stall divider markings across both rows |
| Parking stoppers | Heavy-duty concrete wheel stops with reflective safety-yellow stripes installed in front of every parking stall |
| Vehicle variations | Multiple realistic vehicle types: **Sedan** (classic 3-box with chrome/dark trim), **SUV** (lifted stance, 2-box body, rugged tires, roof rack & crossbars, rear spoiler), **Electric EV** (aerodynamic fastback, full-width front Cyber LED light bar, continuous panoramic glass canopy, full-width rear LED taillight blade, aero wheels, instant acceleration), and **Compact Car** (short wheelbase, upright hatchback, shark-fin antenna, tight agile turning) |
| Cars — Row 1 (near building) | Faces **east** (toward the west building) at `x = -36.8` with 16 parked cars and 1 open spot, mixing sedans, SUVs, electric EVs, compacts, and the Ford van |
| Cars — Row 2 (hedge side) | Moved closer to the western hedges at `x = -49.5`, packed with 25 parked cars and 2 open spots across varied models and colors (93% total lot occupancy across 44 compact spots) |
| Ford Double Backdoor Van | White commercial Ford van parked in the parking space closest to the MPR (`x = -36.8, z = 32.6`), facing east with its distinctive **50/50 vertical split double rear cargo doors** facing the parking lot aisle, split center seam, twin rear door windows with rubber weatherstripping, heavy-duty door handle & keyhole, exterior hinges, commercial matte black grille with centered **Ford blue oval badge**, high roof with reinforcement ribs, dual towing mirrors, rear step bumper, and commercial wheels (fully drivable!) |
| White brick perimeter wall | Replaces the red fence along the south and west boundaries, beginning at the south-eastern corner and extending all across the south side to the south-western corner, then continuing all across the west boundary to the north-west corner. Built to 3.88m with a stone coping cap reaching 4.0m (higher than the 3.6m red fence), featuring large-format architectural white bricks (~71cm x 22cm), pilaster buttresses, and corner piers |
| Hedge rows (East fence & West wall) | Organic living plant hedges with visible woody branches/trunks at the base, layered multi-cluster foliage mounds, detailed leaf textures with veins, and unique natural silhouettes per bush (East hedge: 2.7m; West hedge: 4.25m, rising slightly taller than the 4.0m wall) |
| Hedge planting beds & mulch | Continuous dark rich organic dirt/soil planting beds under both East and West hedge rows, complemented by individual root soil mounds under every bush and a concrete landscape curb bordering the parking lot asphalt |
| North One-Way Road | A one-way eastbound road (`z: [-35.5, -26.0]`, `x: [-62.0, 72.0]`) directly connected to the campus north sliding gate and merging into the East Road. Features painted white one-way arrows ("→"), parking stall boundary lines, concrete driveway apron, stop bar, STOP sign, cobra-head streetlights, and regulatory ONE WAY signs |
| Outside sidewalk parked cars | 5 distinct parked vehicles (sedan, SUV, EV, compact) along the north curb parallel parking lane bordering the outside sidewalk with individual stall markings and physical collision solids |
| 2-Story Apartment Buildings | Three distinct 2-story apartment complexes ("The Palms Apartments", "Nordhoff Gardens", and "Vista Del Sol") north of the outside sidewalk featuring stucco and cedar slat facades, balconies, exterior staircases, ribbon windows, entryway doors, mailboxes, and landscaped address monument plaques |
| MPR Room Interior | Dedicated separate instance room (`24m x 24m`) with polished terrazzo flooring, warm oak wainscoting, acoustic ceiling tiles with recessed LED lights. North wall features a massive projection screen with the ELD PD presentation slide, ceiling-mounted digital projector, presenter podium, and whiteboard. Furnished with 5 long white tables and 40 interactive teacher task chairs (press **E** to take a seat). Exit through the south double doors back to the campus |

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Terminal says a port is already in use | An earlier run is still open — close extra terminal tabs, or restart VS Code |
| `npm run dev` errors immediately | Delete the `node_modules` folder, then run `npm install` again |
| Page won't load, or the badge stays gray | Make sure `npm run dev` is still running, then refresh the page |
| Things look stale after code changes | Press `Ctrl+C`, then `npm run dev` again |

## Git (version control)

The project is a Git repository. A commit is made at the end of every working milestone. To see the history, type `git log --oneline` in the terminal.

## Safety notes

- Raw staff photos are never used or stored (PROJECT.md section 18).
- Secrets go in `.env` (never committed); `.env.example` lists what is needed.
