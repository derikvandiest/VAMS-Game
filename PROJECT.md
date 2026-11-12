# PROJECT.md — Valor Academy Middle School: Online Multiplayer Game

> **Read this whole file before doing anything.** This is the source of truth for the project.
> Items marked **[DEFAULT]** are my assumptions and can be changed. Items marked **[OPEN]** are unanswered questions — do NOT guess; use a clearly labeled placeholder and ask me.
> Section 15 lists decisions already made and the few items still open.

---

## 0. How you (the AI agent) must work

1. **Plan first, code second.** Your first response must be an implementation plan, not code. Break it into milestones (see Section 14). Wait for my approval before starting each milestone.
2. **Build in small slices.** After each milestone, the game must run and be testable by me. Stop and tell me exactly how to run it and what to check.
3. **Do not invent content.** All teacher names, dialogue, quiz questions, school layout, and photos come from me later. Use obvious placeholders (e.g., `Classroom 07 — PLACEHOLDER`, dialogue clearly marked `TODO`). Never fabricate real people's names or dialogue.
4. **Keep content out of code.** All classrooms, NPCs, dialogue, and quiz questions must live in editable data files (JSON) so I can change them without touching game logic (Section 11).
5. **Keep it simple.** Use plain, well-known tools. No exotic frameworks. Comment code clearly. I am a teacher, not a developer, so explain setup/run/deploy steps in plain language.
6. **Use Git.** Initialize a repo and commit after every working milestone with a clear message.
7. **Do not add features I did not ask for.** If you think something is needed, propose it and wait.
8. **Ask when unsure.** If a requirement here is ambiguous or marked [OPEN], ask me instead of choosing silently.
9. **Ask me for images and content at the right time.** I will provide school layout images, classroom interior images, NPC images, and any other assets when you ask. Before starting any milestone that needs them (see Section 17), **stop and prompt me with an exact list** of what to upload, the file names to use, and the folder to put them in. Until I provide them, use clearly labeled placeholders. Do not guess what the real school or the real people look like.

---

## 1. Project summary

A browser-based, online multiplayer game with a **top-down / isometric 3D** view in the style of **Habbo Hotel**. The setting is **Valor Academy Middle School**. The game is used in a **professional development (PD) presentation for teachers**, delivered by me, **Mr. Van Diest** (ELD teacher). Participants open a website, create a character, and play together in a shared school. The PD content is split across 16 classrooms; completing each classroom earns a stamp. Collect all 16 stamps, turn in the report card to me in the ELD classroom, then leave school through the parking lot to finish the game and receive a certificate.

### Real-world conditions (design around these)
- **Who:** adult teachers, **up to about 50 players at the same time**, all in **one single shared world** (one map, one school, no separate rooms/shards).
- **Where:** everyone is physically together in our school’s **MPR (multi-purpose room)**, all on the **same Wi-Fi network**, so they share **one public IP address** and the venue Wi-Fi may be busy.
- **Devices:** **MacBook laptops with keyboards only** (Safari and Chrome on macOS). **Phones and tablets are not supported and must not be assumed.**
- **Length:** the full game must be completable in **about 40 minutes maximum** (see Section 5.14).
- **No accounts or logins.** Anyone with the URL can play.

---

## 2. Tech stack **[DEFAULT]**

| Layer | Choice | Why |
|---|---|---|
| 3D rendering | **Three.js** (WebGL2) | Runs in Safari and Chrome on Mac, large community |
| Client build | **Vite** (plain JavaScript or TypeScript — your choice, tell me which) | Simple, fast |
| Multiplayer | **Node.js + Socket.io** (WebSockets with automatic long-polling fallback) | Works on restrictive school Wi-Fi |
| Server | One Node server that serves the game files AND handles multiplayer | One thing to deploy |
| Hosting | A host that supports long-running Node servers (Render, Railway, or Fly.io), in a **US West region** (we are in Los Angeles). **Not** a static-only host. | WebSockets need a live server; low latency |
| Email | A transactional email service called from the server (see Section 5.11) | Keeps API keys secret |
| Certificate | Generated as a PDF | Easy to email/download |

Do not put any secret keys in client code. Use environment variables, and provide a `.env.example`.

---

## 3. Visual style and characters **[DECIDED]**

- Fixed **isometric / top-down 3D camera** (no free camera rotation in v1; optional zoom limits).
- **Polished low-poly, flat/toon-shaded** look: soft shadows, anti-aliasing, pleasant lighting, a cohesive color palette. Because everyone is on MacBooks, it should look **good, not bare-bones**, while staying lightweight enough for 50 avatars (see Section 9).
- **Retina displays:** cap the render pixel ratio at 2 so it looks sharp but stays fast. Target **60 fps on an M-series MacBook** and a **smooth 30+ fps on older Intel MacBooks**. Provide an automatic quality setting (high/low) that lowers shadows/effects if frame rate drops.
- **Players:** low-poly 3D avatars built from swappable parts (body, head, hair, shirt) so skin tone, hairstyle, and gender presentation change at runtime. **The shirt color is set by the player’s homeroom (Section 5.2).**
- **NPCs (teachers/admin):** the **same low-poly 3D body style as players**, but with a **stylized, cartoon-style face texture made from the uploaded photo** applied to the head (so they are recognizable but look like game characters, not photographs), plus hair/clothes colors set in the NPC data. See Section 8.
- Fonts: clear, large, highly readable.
- Must work in **Safari and Chrome on macOS** (test both). Use `event.code` (e.g., `KeyW`) for movement keys so WASD works on non-US keyboard layouts. Prevent the Space and arrow keys from scrolling the page.

---

## 4. Light and dark mode

- Add a **light/dark mode toggle** available on every screen (character creation, game HUD, dialogue, map, game over).
- Applies to **all UI** (menus, HUD, dialogue boxes, quiz screens, map) **and** the 3D scene (bright day-style lighting for light mode, dim night-style lighting for dark mode, with lit windows/lamps as a nice touch).
- **[DEFAULT]** Start with the user’s system preference (`prefers-color-scheme`), and remember their choice (localStorage).
- Both modes must keep text contrast readable. Homeroom colors (yellow/green/blue/red) must stay clearly distinguishable in both modes.

---

## 5. Screens and game flow

### 5.1 Title / Character Creation (first screen)
The player creates a character before entering. Fields:

- **Name** — text input (max ~16 characters). Apply a basic profanity/inappropriate-name filter. Required.
- **Look** (replaces "Haircut") — choose from several pre-made characters **[DEFAULT: 3 per gender, 6 total; I will review]**. Quaternius models have hair baked in, so each look is one model (outfit + hairstyle + face), plus a separate **hair color** picker.
- **Skin color** — a palette **[DEFAULT: 6–8 tones]**.
- **Gender** — body/appearance options **[DECIDED: Masculine and Feminine; no neutral option; labels editable]**.
- **There is NO shirt-color picker.** Shirt color comes from the homeroom chosen next.
- A **live 3D preview** of the character that updates as choices change (rotatable or auto-turning).
- Be careful that typing a name does not trigger game hotkeys (WASD, M, R, E, Space). Note: E is also the action key, so the emoji hotkey (5.13) needs a different key.

### 5.2 Homeroom selection
After creating the look, the player picks **one homeroom**:

| Homeroom | Color |
|---|---|
| CSUN | Yellow |
| LMU | Green |
| UCLA | Blue |
| USC | Red |

- **The homeroom is purely a colored name tag + shirt color (no scoreboard, no competition).**
- **Naming rule:** the four names are always written in all capitals exactly as **CSUN, LMU, UCLA, USC** everywhere (UI, files, certificate, emails, code strings). Never “Csun”, “Ucla”, “Usc”, etc.
- The player’s **shirt is colored in their homeroom color**, and their **floating name tag is also in the homeroom color**, so players can tell each other’s homerooms at a glance.
- The name tag also shows the **homeroom abbreviation as text** (e.g., “Maria · UCLA”), so it does not rely on color alone (accessibility for color-blind users).
- Choose clear, distinct hex values for the four colors that work in both light and dark mode; put them in `homerooms.json`.
- The live preview should show the shirt changing color as the player highlights each homeroom.
- Still store the homeroom per player on the server (needed for name tags, results, and the host page).

### 5.3 Arrival animation and entering the school **[DECIDED]**
After the player confirms their homeroom, a short **arrival animation** plays before they can move:

1. A **car pulls into the parking lot** and parks.
2. **The player’s own character** (with their chosen hair, skin tone, gender look, and homeroom-colored shirt) **steps out of the car** (the door opens and the character exits).
3. The character **walks onto campus toward the gate**.
4. Control is handed to the player **at the gate**, which is their **starting position** in the game. The HUD (objectives, report card, map, emoji buttons) fades in at that moment.

Details:
- **Length:** about 6–8 seconds. **[DEFAULT]** The player can skip it with E or a click (after the first second). Keep it in the time budget (Section 5.14).
- **Local only:** the animation plays on each player’s own screen and uses no server traffic (same idea as the car-exit animation in 5.10). Other players do not see the car. **[DEFAULT]** The player connects to the server during character creation/the animation but stays **hidden from other players and non-interactive** until the animation ends; then they appear at the gate for everyone.
- **Car:** a generic low-poly car in a random color from a neutral palette **[DEFAULT]** (not the four homeroom colors, to avoid confusion). After the character steps out, the car drives away or fades out of that player’s local view. Reuse the same car and driving code as the ending animation where possible.
- **Camera:** the normal fixed isometric camera, framed on the parking lot first and then following the character to the gate, ending in the normal gameplay view.
- **No other input** during the animation (except skip). It must look right in both light and dark mode.
- **Preload** the assets needed for the animation (car, parking lot, the player’s character) while the player is still on the character-creation screens so the animation does not stutter. Show a short loading indicator if assets are not ready.
- **Not replayed** when a returning player resumes after a refresh or reconnect (they resume where they were).
- **Data-driven:** the gate position, the parking spot used for the arrival, and the car’s path waypoints live in the layout config (Section 7), so they can be changed when I upload the real layout pictures.
- **Spawn point:** every player starts at the gate. Add small position offsets so many players arriving close together do not overlap exactly (there is no collision between players, so slight overlap is fine).

### 5.4 Core gameplay
- **Movement:** **WASD** keys (also allow arrow keys as a convenience).
- **Collision:** players cannot walk through walls, furniture, or NPCs. They enter classrooms through doors. **No collision between players** (so nobody can block a doorway) **[DEFAULT]**.
- **Multiplayer:** all players in the same shared school; see other players walk in real time, with name tags colored by homeroom.
- **50 players at once:** up to ~50 players must be in the school **at the same time**, walking around and interacting with NPCs simultaneously, with no one being blocked or queued. Specifically:
  - Any number of players can talk to the **same NPC at the same moment**. Dialogue and quizzes are **per-player** (one player talking to a teacher never locks, freezes, or interrupts that teacher for anyone else). An NPC turning to face a player is a local visual effect for that player only.
  - Many players can be inside the **same classroom** at once. Entry positions must be spread out so avatars don’t stack on one spot, and rooms must be big enough to look reasonable with 10+ players.
  - Wandering/patrolling NPCs, if any, must appear in the **same place for everyone** (server-driven or deterministic), not different per player.
  - The game must stay smooth with 50 avatars on screen (see Section 9).
- **Action key = E** (talk, doors, gate, sit, drive). **Spacebar jumps.**
- **Interact:** when near an NPC, show a prompt (“Press E to talk”). **E** starts the conversation and **E** advances each line of dialogue. The player cannot move while in dialogue.
- **No free-text chat between players [DEFAULT].** Players communicate only through **emojis** (Section 5.13).

### 5.5 Classrooms (20 total) **[DECIDED]**
There are **20 enterable classrooms**, each mapped to a real classroom or space at Valor Academy:

- **16 stamp-station classrooms** (PD topics), each with a teacher NPC, dialogue, and a quiz. They are the grade-level classes listed in the table below.
- **4 non-stamp rooms:** the **ELD classroom** (Mr. Van Diest), the **Music Room**, the **Learning Center**, and the **Theater**. These contain NPCs and short flavor dialogue but no stamp. (Only the ELD classroom has a gameplay role: turning in the report card.)
#### The 16 stamp classes **[DECIDED]**
Each grade (5th through 8th) has **four classes**, one for each of CSUN, LMU, UCLA, and USC, and each class has a subject:

| Grade | CSUN | LMU | UCLA | USC |
|---|---|---|---|---|
| 5th Grade | History | Math | English | Science |
| 6th Grade | Math | Science | History | English |
| 7th Grade | Math | History | Science | English |
| 8th Grade | English | History | Math | Science |

- Class display name format **[DEFAULT]**: `5th Grade USC (Science)`. Short label for the map: `5 USC`. Use one shared helper so the format is identical everywhere (classroom door signs, report card, map, objectives, certificate/results email).
- **The subject of each class has nothing to do with the PD content.** Treat the subject only as a label (shown on the report card, map, and door signs). I may connect subjects to the PD content in the future, so store each class’s PD topic in its own separate field in `classrooms.json` (do not derive it from the subject).
- These are the names of the classes. They are **separate from the player’s own homeroom choice**: every player must visit and complete all 16 classes no matter which homeroom they chose.
- Each of the 16 classes is mapped to a real classroom at Valor Academy (real room numbers come from me later; use placeholders).
- Add a simple automated check that fails if the table in `classrooms.json` does not contain exactly 4 grades × 4 homerooms (16 classes), or if any homeroom name is not spelled CSUN, LMU, UCLA, or USC.

#### Entering rooms
- Entering a classroom: walk through the door (a short fade or camera transition is fine). Interior is a simple room with desks/furniture and the NPC(s). The Theater and Music Room should look distinct (stage, instruments).

### 5.6 Stamp station flow (the 16 PD classrooms) **[DECIDED]**
1. Player talks to the classroom teacher NPC (E).
2. A **short** dialogue about the PD topic plays (E to advance).
3. At the end of the dialogue, the quiz appears: one or more multiple-choice questions, answered by clicking or number keys.
4. **If the answer is correct:** continue; after the last question is correct, the teacher “stamps” the report card (short stamp animation + message), the stamp is saved, and the objective list updates.
5. **If the answer is wrong:**
   - **Never reveal the correct answer** (not on screen, and the correct answers must never be sent to the browser — see Section 12).
   - Show a gentle message such as “Not quite — let’s go over it again!”, then **restart the dialogue from the beginning** so the player can re-read it, and then return to the quiz so they can **pick a different answer**.
   - **Unlimited retries.** No lockout and no penalty.
   - **[DEFAULT]** For stations with multiple questions: questions already answered correctly stay answered; after the dialogue restarts the player returns to the question they missed.
   - **[DEFAULT]** On a replay of the dialogue, lines the player has already read can be advanced quickly with E (no slow text animation).
6. A completed station can be revisited but does not award a second stamp. The teacher shows a short “You already have this stamp” line.
- Stations can be completed in **any order**.
- Keep each station short (see time budget, Section 5.14).

### 5.7 Report card
- A **Report Card button is always visible in the UI** (plus hotkey `R`). **Clicking it opens the report card.** Clicking the button again, a close button, or Esc closes it. Works in light and dark mode.
- The report card shows **all 16 classes** in a grid that mirrors the school: **4 rows (5th, 6th, 7th, 8th Grade) × 4 columns (CSUN, LMU, UCLA, USC)**. Each cell shows the class name and subject (e.g., “USC · Science”) with an empty stamp slot.
- **Every time the player earns a stamp, it appears in that class’s cell** (with a short ink-stamp animation the first time it is opened after earning it). Classes without a stamp stay empty. A stamped class must be clearly different from an empty one without relying on color alone.
- A header shows the count (e.g., “7 / 16 stamps”). Each cell may use its class’s homeroom color as an accent **[DEFAULT]**.
- Stamp state comes from the server (the real, validated progress).
- Also shows the player’s name and homeroom.

### 5.8 Objectives list (HUD, top-left)
Always visible in the **top-left corner**. Shows:
1. “Complete all 16 classrooms and earn a stamp” — with progress (e.g., 7 / 16).
2. After 16 stamps: “Bring your report card to the ELD classroom and turn it in to Mr. Van Diest.”
3. After turn-in: “Go to the parking lot and leave school.”
- Completed objectives show as checked. The list updates live as the player progresses.

### 5.9 Turning in the report card (ELD classroom)
- The player talks to **Mr. Van Diest** (NPC) in the ELD classroom.
- **Before 16 stamps:** he says (placeholder text) that they are not done yet and hints at what remains.
- **At 16 stamps:** dialogue plays, the report card is “turned in,” and he directs them to the parking lot. The objective updates. This is validated on the server.

### 5.10 Parking lot and ending
- The **parking lot** is an outdoor area with several parked **cars** (clickable).
- **[DEFAULT]** The parking lot is always walkable. Before turn-in, clicking a car shows a message like “You can’t leave yet — finish your report card first.” After turn-in, clicking **any car** plays an **animation**: the car pulls out of its space, drives out of the parking lot, and leaves the school.
- **The car animation is per-player (local to that player’s screen).** Many players can click cars at the same time without interfering with each other. Other players do not see someone else’s “escape” animation, and cars are never “used up.”
- Then a **Game Over / “You made it!” screen** appears.

### 5.11 Game Over: results and certificate **[DECIDED]**
- Player enters their **email address** (validate the format; required to receive the certificate).
- **[DEFAULT]** The form also has a **“Name on certificate”** field, pre-filled with the character name and editable (because character names may be nicknames).
- The server **emails them**: (a) a **certificate of completion** (PDF) and (b) a **short results summary** (stamps earned, topics completed).
- **Certificate content:** states that the person **completed the ELD Professional Development (Valor Academy Middle School)** and shows the **date of completion** (use the America/Los_Angeles time zone) and their name. Nothing else is required. Layout/wording template goes in `settings.json`; I will finalize wording and design later.
- Also offer a **Download certificate** button as a fallback in case email fails.
- Show clear success/error messages. Do not lose the player’s progress if email fails; allow retry.
- **Privacy [DECIDED]:** **delete the email address immediately after sending.** Do not store it in a database, do not write it to logs, do not use it for anything else. Show a one-line notice on the form (“Your email is used only to send your certificate and is not saved.”).
- **Email provider:** **[OPEN]** I have not chosen one yet. Build the email sender behind a simple interface so the provider can be swapped, and explain the setup steps. With 50 players finishing around the same time, sending must be **queued** so it never slows the game.

### 5.12 School map (button + M key)
- A **Map** button in the UI **and** the **M key** open and close a full-screen (or large overlay) **map of the school**. Pressing **M** again or **Esc** closes it.
- The map panel shows two things together:
  1. **The school map:** a clean top-down 2D map showing the campus layout, all 20 classrooms (labeled), the ELD classroom, the office, the parking lot, and a **“You are here”** marker showing the player’s current position. **It shows only the player’s own position, not other players.**
  2. **Objectives:** the full objectives list with **completed** objectives (checked) and **remaining** ones, including which of the 16 classrooms still need a stamp and which are done.
- On the map, **classrooms are visually marked by status**: stamp earned (checkmark/filled), stamp still needed, and non-stamp rooms (neutral). Do not rely on color alone (also use icons/checkmarks).
- **[DEFAULT]** The map shows each classroom’s label and topic title and status. Clicking a classroom shows those details. No fast-travel/teleporting.
- **[DEFAULT]** While the map is open, the player’s avatar stands still, but the game and other players continue as normal. The M key must be ignored while the player is typing in a text field (name, email).
- **Single source of truth:** generate the map from the same campus layout/config data used to build the 3D school (Section 7), so when I upload real layout pictures and the layout changes, the map updates automatically. Do not hand-draw a separate map.
- Works in both light and dark mode. The persistent objectives list in the HUD (5.8) stays as is.

### 5.13 Emojis
- An **Emoji button** in the UI (and hotkey **`E`**) opens a small picker of **preset emojis** **[DEFAULT: about 12–16 school-appropriate options, e.g., 👋 😀 😂 👍 👏 ❤️ 🤔 😮 🎉 🔥 😢 🙌 — I will review the list]**. Number keys can select quickly while the picker is open. Esc closes it.
- When a player picks an emoji, it **floats above their avatar for about 3–4 seconds** and **all other players can see it**.
- **Presets only** (no free-text), so there is nothing to moderate.
- **Anti-spam [DEFAULT]:** a short cooldown per player (about 1–2 seconds). The server enforces this and sends only the emoji id (not images or text). With 50 players, emoji traffic must stay tiny.
- **Rendering [DEFAULT]:** render each emoji once to a cached texture/sprite using the system emoji font (Apple Color Emoji on Mac) and reuse it for all players, so 50 emojis at once cost almost nothing. Emojis always face the camera.
- Emojis can be sent while walking or standing, but the picker is disabled during dialogue, quizzes, and when the map or report card is open.
- Emojis are visible to everyone in the same area/world; they do not appear on the map.

### 5.14 Time budget (40 minutes maximum) **[DECIDED]**
- The whole game must be completable in **about 40 minutes**, including character creation and the arrival animation (~2–3 min together), walking, and the final turn-in/parking-lot/email.
- That leaves roughly **1.5–2 minutes per stamp station**. Therefore: the campus layout must be **compact** (short walking distances, sensible walking speed), each station’s dialogue should be **short (about 6–10 lines)**, and each station should have **1–2 questions**.
- Make the walking speed a setting in `settings.json`.
- Add a **content-length checker** (a simple script) that warns me if a station’s dialogue/quiz is likely to exceed the time budget.

### 5.15 Dialogue window with character portraits **[DECIDED]**
- Whenever a player talks to **any character who has dialogue** (teachers inside classrooms, hallway and outdoor NPCs, admin, and Mr. Van Diest), the dialogue window shows that character’s **cartoonized portrait image**, like a classic RPG: the portrait sits at the **bottom-left of the dialogue window**, with the speaker’s name plate and the dialogue text beside it, and the “Press E” indicator at the bottom-right.
- The portrait stays visible for the whole conversation, including quiz questions and the stamp message.
- **Every character that has dialogue has their own portrait file**, set in `npcs.json` (named by NPC id).
- **File format:** **PNG with a transparent background** is the standard (so it looks right in both light and dark mode). The build may convert portraits to WebP with transparency to reduce download size; either format is accepted. Size guideline: about 400–600 px tall, optimized to roughly 100–200 KB each. It should look crisp on Retina screens at about 180–260 px tall on screen.
- **If a portrait is missing,** show a generic placeholder silhouette and list all NPCs missing portraits in a startup/validation report.
- Portraits **load on demand** (e.g., start loading when a player gets near the NPC), not all at the start, to protect the first-load budget (Section 9).
- One cartoonized image per person can serve both as this portrait and as the source for the 3D head face texture (Section 8); allow a separate override file for either.

---

## 6. NPCs

- **Teacher and admin NPCs:** one per classroom plus admin NPCs in the office, etc. Their faces are made from **photos I will upload later** (see Section 8).
- **Hallway/wandering NPCs:** NPCs scattered around the school (hallways, courtyard, cafeteria, office, parking lot). They give short flavor dialogue, may be stationary or do a simple idle/short patrol **[DEFAULT: no complex AI]**.
- All NPCs use the same talk system (E to start, E to advance).
- Each NPC is defined in data (Section 11): id, display name, role, location, face texture file, **portrait file** (Section 5.15), dialogue.

---

## 7. School map / campus layout

- Setting: **Valor Academy Middle School.** I will upload **reference pictures** of the real layout later.
- **Until then**, build a **simple, compact placeholder campus:** a main hallway/courtyard, 20 numbered classroom doors, an office, a parking lot, and a **gate** (the entrance where players start). The parking lot must be next to the gate with a short walkable path between them, so the arrival animation (5.3) works. Make the layout **data-driven** (a layout/config file) so I can later reshape it from the photos without rewriting code. The 2D map (5.12) is generated from this same data.
- Each of the 20 classrooms must have: a unique id, a door location, an interior room, a label (real room number/name filled in later), and a type (`stamp` or `other`).

---

## 8. Asset pipeline (photos of real people)

- I will upload **photos of teachers and admin**. Create a folder structure to receive them:

```
/assets
  /npc-photos        (raw photos I upload, named by npc id, e.g. npc_mr-van-diest.jpg)
  /npc-faces         (processed, stylized face textures used in-game)
  /npc-portraits     (cartoonized PNG dialogue portraits, named by npc id, e.g. npc_mr-van-diest.png)
  /reference         (school layout photos)
```
- **Decided approach:** a stylized (cartoon/toon-style) face texture applied to the low-poly head, per Section 3. I will create the cartoonized images myself with **Nano Banana** (outside this project, only after each staff member approves) and supply them as PNG files. Provide a simple **script** that only crops, resizes, and optimizes the supplied images into the face-texture and portrait sizes. Do **not** build a cartoon filter. Do **not** use automated face recognition.
- Build the NPC system so a face texture can be swapped by filename in the NPC data file. **Until photos arrive, use a generic placeholder face.**
- Each person also gets a **cartoonized portrait PNG** for the dialogue window (Section 5.15). I supply finished cartoonized PNGs made with Nano Banana, and they go in `/assets/npc-portraits`. Until real portraits arrive, use a generic placeholder portrait.
- **Important:** these are real people. Keep all photos and files private to the project repo and the deployed game. Do not send them to any third-party service without asking me.
- Keep image file sizes small (see the asset budget in Section 9).
- **Staff approval and substitute NPCs:** I will get each staff member’s approval before creating their cartoonized character. **Any staff member who does not approve is replaced by a generic “substitute teacher” NPC.**
  - The system must support generic substitute NPCs in **any** role (a stamp-classroom teacher, ELD, hallway NPC, etc.). A substitute delivers exactly the same dialogue, quiz, and stamp as the teacher they replace; only the look and name change.
  - In `npcs.json`, each NPC has an `isSubstitute` flag. A substitute uses a generic look (a hair/skin/clothing combination from the character options, and a generic cartoon portrait, no real person’s face) and a configurable display name (**[DEFAULT]** “Substitute Teacher”). Provide a few generic portrait placeholders so substitutes do not all look identical.
  - Switching an NPC between real and substitute must only require changing that NPC’s data entry (flag + portrait/face file), not any code.
  - **Raw photos of staff are never deployed.** Keep `/assets/npc-photos` out of the production build and out of anything publicly served (add it to `.gitignore` and the build exclusions). Only the approved cartoonized images ship with the game. Never commit photos of staff who have not approved.

---

## 9. Multiplayer, networking, and performance

### Core multiplayer
- Server tracks each connected player: id, name, appearance, homeroom, position, facing direction, and progress (stamps).
- Positions sync in real time (smooth interpolation on the client; throttled updates).
- **Players joining/leaving** update for everyone.
- **One single world** for everyone (no matchmaking or separate instances).
- **Capacity:** design for and **test with 50 simultaneous players**. The max is configurable in `settings.json`, with a friendly “school is full” message if exceeded (default cap: 60, to leave headroom).
- **Progress persistence:** if a player refreshes or briefly disconnects, they **resume** with the same character and stamps (locally stored session token + server memory; no accounts). **[DEFAULT]**
- **Quiz and stamp logic is validated on the server** so the stamp count cannot be faked from the browser console.
- **Host controls [DEFAULT]:** a simple password-protected admin page for me to see how many players are online and how many have completed each station, and to reset the world/progress. Keep it minimal.
- Connect the player to the multiplayer server only **after** they finish character creation (reduces load while 50 people create characters at once). The server must handle ~50 people joining within a minute or two.

### The MPR / shared Wi-Fi reality
- Assume **all 50 laptops are on the same Wi-Fi at the same time in one room**, and that all traffic to the server comes from **one shared public IP address**.
- **Do NOT use per-IP limits** (rate limits, connection caps, bans) that would treat 50 players as one abusive user. Limit per session/email instead.
- **Initial load matters:** 50 laptops will download the game at the same moment. Set a **total download budget** (target: **under about 15 MB** for first load; tell me if you cannot meet it), compress 3D models and textures (e.g., glTF with Draco/meshopt, optimized images), serve static files with caching/compression, show a **loading screen with a progress bar**, and load only what is needed up front (e.g., classroom interiors can load on first entry, and NPC portraits load on demand as a player approaches).
- Keep ongoing network traffic small (see below). Many players on one Wi-Fi access point is the biggest real-world risk, so I will test in the MPR beforehand.
- Include a clear **“connecting / connection lost / reconnecting”** indicator, and rely on Socket.io’s WebSocket-with-fallback behavior in case the school network restricts WebSockets.

### Performance with 50 players (required)
- Server sends position updates at a modest, throttled rate (about 10–15 per second per player) and only sends changes. Clients interpolate so movement looks smooth.
- Client stays smooth with 50 avatars visible: use shared geometry/materials or instancing, no heavy per-avatar effects, and limit name-tag clutter (e.g., hide or shrink name tags for far-away players).
- Keep the 3D scene lightweight (low-poly, limited lights/shadows, automatic quality fallback).
- **Load test:** create a script that simulates 50+ bot players connecting, moving, talking to NPCs, using emojis, and completing quizzes, and report server CPU/memory and network use. The chosen host/plan must handle this comfortably. Tell me which plan size to buy.
- Many players will finish around the same time, so server-side stamp and email handling must not block the game loop.

---

## 10. UI requirements summary

- Top-left: **Objectives list** (always visible).
- Report Card: always-visible clickable button + hotkey (R), see 5.7.
- Map: button + hotkey (M), see 5.12.
- Emoji picker: button + hotkey (E), see 5.13.
- Dialogue box (see 5.15): bottom of screen, with the speaker’s portrait at the bottom-left, speaker name, text, and a “Press E” indicator.
- Quiz panel: question + clickable answer choices (also keyboard-selectable).
- Light/dark toggle always accessible.
- Interaction prompt near NPCs/doors/cars.
- Designed for **MacBook laptop screens** (roughly 13–16 inches, Retina). The UI scales sensibly on these. If the game detects a phone/tablet or touch-only device, show a friendly “Please open this on a laptop with a keyboard” message instead of the game. Do not build touch controls.
- Accessibility: readable font sizes, high contrast in both themes, no flashing effects, all UI usable without a mouse where reasonable. Do not rely on color alone for information.
- **No sound effects or music in v1.** Structure the code so audio can be added later (e.g., a central audio module that currently does nothing).

---

## 11. Data-driven content (very important)

All editable content must be in JSON (or similar) files under `/content`, validated on load, with clear error messages if something is missing:

- `classrooms.json` — 20 entries: id, label, type (`stamp` | `other`), grade (5–8, stamp rooms only), homeroom (`CSUN` | `LMU` | `UCLA` | `USC`, stamp rooms only), subject (`Science` | `English` | `History` | `Math`, stamp rooms only), real room number (placeholder until I supply it), door position, linked NPC id, topic title (for stamp rooms)
- `npcs.json` — id, display name, role, location, face texture file, portrait file, `isSubstitute` (true for generic substitute NPCs), wander behavior, dialogue id
- `dialogues.json` — arrays of lines per dialogue id, with speaker
- `quizzes.json` — per stamp classroom: one or more questions; each has text, 2–4 choices, correct answer index, optional feedback for incorrect answers (that does not reveal the answer). **This file lives on the server only; correct answers are never sent to the browser.**
- `homerooms.json` — CSUN (yellow), LMU (green), UCLA (blue), USC (red) with exact hex colors
- `character-options.json` — looks (models), hair colors, skin tones, gender options
- `emojis.json` — the preset emoji list
- `settings.json` — max players, walking speed, certificate text/layout, email subject/body, time-budget thresholds, etc.

Ship these with **clearly marked placeholder content** for all 20 classrooms so the game is fully playable end-to-end with fake content before I add real content.

---

## 12. Security, privacy, and safety

- Player names: length limits, filtering, strip HTML (prevent injection).
- All data from clients is untrusted. Validate everything on the server (movement speed sanity, quiz answers, stamp counts, emoji ids and cooldowns).
- **Quiz answers stay on the server.** The browser receives questions and choices, and sends back the chosen answer. The server replies only “correct” or “incorrect.”
- No secrets in the client. Use environment variables.
- Rate-limit the email endpoint to prevent abuse, but **per session/email address, never per IP** (all 50 players share one IP). Use a queue for sending, with a generous overall cap.
- Do not collect any personal data beyond name (in-game) and email (for the certificate only). **Delete the email immediately after sending; never log email addresses.**
- Real people’s photos stay in the project only.

---

## 13. Deployment and backup plan

- Must be deployable to a host that supports Node/WebSockets (US West region), with step-by-step instructions written for a non-developer.
- One public URL that participants type in or scan from a QR code.
- Provide a **“test on real network” checklist**: multi-tab test, multi-laptop test, **a full rehearsal in the MPR with as many laptops as possible**, tested on both Safari and Chrome.
- **Backup plan:** document how to run the game locally from my laptop if the internet fails. Note that this only works if the venue Wi-Fi lets laptops talk to each other (many school networks block this, called “client isolation”). Explain how to test for this, and suggest a fallback such as a portable Wi-Fi router. Email/certificates need internet.

---

## 14. Milestones (propose a plan, then execute one at a time; wait for my approval)

1. **Project setup:** repo, folder structure, Vite + Three.js client, Node + Socket.io server, `.env.example`, README with run instructions. Placeholder scene renders.
2. **Single-player prototype:** placeholder compact campus (hallway, 20 doors, parking lot), a character moving with WASD, fixed isometric camera, collisions.
3. **Multiplayer basics:** two or more browser tabs see each other move, join/leave handling, name tags. Design for 50 players from the start (see Section 9).
4. **Character creation + homeroom selection:** full flow, live preview, appearance synced to other players, homeroom-colored shirts and name tags.
5. **Light/dark mode** across UI and scene.
6. **NPCs + dialogue system:** proximity prompt, E to talk/advance, data-driven NPCs and dialogue, hallway NPCs, multiple players talking to the same NPC, dialogue window with character portraits at bottom-left (5.15; placeholder portraits until real ones arrive).
7. **Classrooms:** enter/exit all 20 rooms (including Music Room, Learning Center, Theater), interiors, teacher NPCs, using the 16-class grade/homeroom/subject table (Section 5.5) and the CSUN/LMU/UCLA/USC naming rule.
8. **Quiz + stamp system:** quiz UI, retry-with-dialogue-restart behavior, server-validated stamps, clickable report card grid (5.7), stamp animation, objectives list updates.
9. **School map (button + M key):** map panel generated from layout data, “You are here” marker, classroom status, completed/remaining objectives.
10. **Emojis:** picker (button + E key), floating emoji above avatars visible to all, cooldown.
11. **Opening arrival animation (5.3), ELD turn-in, parking lot, per-player car animation, and Game Over.** (Until this milestone, players simply spawn at the gate.)
12. **Email + certificate** (queued sending, email deleted after sending, download fallback).
13. **Progress persistence, reconnect handling, host admin page.**
14. **50-player load test and optimization:** bot simulation, asset-size budget, performance fixes, recommend hosting plan.
15. **Deploy + real-network testing,** including a rehearsal in the MPR.
16. **Content pass:** I supply real map pictures, photos, dialogue, and quizzes; you integrate and run the time-budget checker.
17. **Polish and bug fixing.** (Audio is a possible later addition.)

Do **not** skip ahead. Each milestone must work before the next begins.

---

## 15. Decisions made and remaining open items

### Decided
- My name is spelled **Mr. Van Diest**.
- **Mac laptops** with keyboards only; no phones/tablets. Safari + Chrome on macOS.
- Character style: low-poly 3D avatars; NPCs use stylized cartoon face textures made from photos.
- Homeroom = colored name tag **and** shirt color (no scoreboard, no separate shirt picker).
- 20 classrooms = 16 stamp stations + ELD classroom + Music Room + Learning Center + Theater.
- Quiz: unlimited retries; wrong answers never reveal the correct one; a wrong answer restarts the dialogue.
- Email is deleted after sending; certificate says the player completed the ELD PD and shows the date.
- Game must take about 40 minutes maximum.
- Map shows only the player’s own position.
- Emoji reactions (presets only) visible to all players.
- Up to 50 players, one shared map, same Wi-Fi, same room (MPR), one shared IP.
- The 16 stamp classes are 4 grades (5th–8th) × 4 names (CSUN, LMU, UCLA, USC) with the subjects in the Section 5.5 table; CSUN, LMU, UCLA, USC are always written in all capitals.
- Every character with dialogue has a cartoonized PNG portrait shown at the bottom-left of the dialogue window.
- The report card is a clickable UI button showing all 16 classes, with a stamp appearing for each class as it is earned.
- Each subject (Science, English, History, Math) is used by exactly 4 classes, and subjects are only labels with nothing to do with the PD content (this may change in the future).
- Teacher/admin portraits are cartoonized by me using Nano Banana after each staff member approves. Staff who do not approve are replaced by generic substitute-teacher NPCs.
- After character creation, an arrival animation plays (a car pulls into the parking lot, the character steps out and walks onto campus), and the player starts the game at the gate.

### Still open
- **[OPEN]** Email provider/account and sending address (needs setup help from me).
- **[OPEN]** Final certificate wording and design.
- **[OPEN]** Final emoji list, hairstyle options, and skin tone palette (defaults are fine until I review).
- **[OPEN]** Real school layout pictures, NPC photos, dialogue, and quiz content (coming later; use placeholders).

---

## 16. Definition of done (v1)

- A participant opens the URL on a MacBook, creates a character, picks a homeroom (shirt and name tag take its color), watches the short arrival animation (a car pulls into the parking lot, their character steps out and walks to the gate), and then walks the school with WASD starting at the gate.
- Up to 50 participants are in the school at the same time, see each other, and interact with NPCs simultaneously, verified by the load test and an MPR rehearsal.
- All 20 classrooms are enterable; 16 award stamps via dialogue + quiz (server-validated; wrong answers restart the dialogue and never reveal the answer).
- Objectives list, the clickable report card (16 classes, each stamp appearing as it is earned), and Map (button and M key) update correctly.
- Every character with dialogue shows their own portrait at the bottom-left of the dialogue window.
- Players can send emoji reactions that others see.
- Turn-in to Mr. Van Diest works only with 16 stamps; the per-player car animation plays; the Game Over screen appears.
- The email with certificate and results is delivered, the address is not stored, and the download fallback works.
- Light and dark modes work everywhere.
- The full game is completable in about 40 minutes.
- All content comes from JSON files; I can change it without coding.
- Deployed to a public URL and tested on real MacBooks on a real network.

---

## 17. Asset and content requests (when to prompt me)

I will supply these when you ask. **Prompt me before the milestone that needs them**, listing exactly what you need, using the folders and naming below. Everything else uses placeholders until then. After I upload, confirm what you received and list anything missing or unclear.

| When to ask | What to ask me for | Where it goes / naming |
|---|---|---|
| Before Milestone 2 (campus layout) — optional but best early | **School layout:** overhead/aerial view or floor plan, photos of the front gate, the parking lot, the main hallways/courtyard, each building’s exterior, the office, the MPR, and any landmarks. Ask me for the real room numbers of the 20 classrooms and which room is which (grade/homeroom/subject, ELD, Music Room, Learning Center, Theater). | `/assets/reference/layout/` — descriptive names, e.g. `gate-front.jpg`, `parking-lot-overview.jpg` |
| Before Milestone 7 (classrooms) | **Classroom interiors:** 2–3 photos of each of the 20 rooms (from the doorway and from the back), showing desks, boards, and distinctive features; plus the Music Room, Learning Center, and Theater. | `/assets/reference/rooms/` — named by room, e.g. `5th-USC-science-1.jpg` |
| Before Milestone 6 (NPCs/dialogue) — placeholders are fine until content pass | **Cartoonized NPC portraits** (made by me with Nano Banana, only for staff who approved) for every character with dialogue, **plus generic substitute-teacher portraits**. Ask me for the list of NPCs: who they are, their role, which room or area they stand in, and whether they are real or substitute. | `/assets/npc-portraits/` — PNG, transparent background, about 400–600 px tall, same framing and style for all, named by NPC id (e.g., `npc_mr-van-diest.png`). **Do not ask me for raw staff photos unless I offer them** (they are never deployed). |
| Before Milestone 12 (certificate/email) | Certificate wording and design preferences, the school logo if I want one, and the email service details/account. | `/assets/branding/` for the logo |
| Milestone 16 (content pass) | All **dialogue** for every NPC, all **quiz questions and answers** for the 16 stamp classes, PD topic titles for each class, emoji list review, hairstyle and skin-tone options review. | The JSON files in `/content` (Section 11), or I will paste text and you place it. |

**Image tips to give me when you ask** (keep them short and clear):
- Layout/room photos: landscape orientation, well lit, a few angles per place, with room numbers visible when possible.
- NPC portraits: the same cartoon style, framing (head and shoulders, facing forward), size, and transparent background for every character so they look like a set.
- Never ask me to send photos through any service other than the ones I choose.

---

## 18. Amendments from planning (recorded October 7, 2026)

Decisions made by Mr. Van Diest during planning. Where these disagree with earlier sections, **these win**.

1. **The office is not enterable** — exactly 20 enterable rooms (16 stamp classes + ELD, Music Room, Learning Center, Theater). The office appears on the map only. (Amends sections 5.5, 5.12, 6.)
2. **Progress lives in server memory only** — confirmed and accepted; if the server restarts mid-session, stamps reset. (Confirms section 9.)
3. Content-vs-deploy timing (real content arriving at Milestone 16, after deploy at Milestone 15) — parked; decide later.
4. **Email is optional** on the Game Over screen — there is a Skip button, and the certificate download stays available. (Amends section 5.11.)
5. **After finishing, "Play Again"** restarts the game from the title screen with fresh progress. (Adds to sections 5.10–5.11.)
6. **Duplicate player names are allowed.** (Adds to section 5.1.)
7. **No profanity filter** — the name field keeps only the length limit and HTML stripping. (Amends section 5.1.)
8. `quizzes.json` stays server-side only, with an automated leak check. (Clarifies sections 11–12.)
9. Unassigned small items placed: loading screen with progress bar → Milestone 2; "please use a laptop" device message → Milestone 4; QR code → Milestone 15.
10. Title screen art and logo will be created later (before Milestone 12).
11. **Time budget: 60 minutes maximum** (was 40). All time-budget checks use 60. (Amends sections 1, 5.14, 16.)
12. **Realistic attendance: about 40 participants** at a time; the design cap stays 60 in `settings.json`. (Refines sections 1 and 9.)
13. **Target devices: all keyboard computers** — macOS (Safari + Chrome) and Windows (Chrome + Edge). Phones and tablets remain unsupported. (Refines section 1.)
14. **No staff photos will ever be provided.** `/assets/npc-photos` stays empty and gitignored; NPCs use generic looks and generic portraits unless Mr. Van Diest supplies finished portrait PNGs himself. (Supersedes the section 8 photo pipeline.)
15. **Language: TypeScript** (section 2 allowed either).
16. **Connection timing resolved:** the player connects to the server right after confirming the homeroom, stays hidden and frozen during the arrival animation, and appears at the gate when it ends. (Resolves section 5.3 vs section 9.)
17. **Character customization defaults:** 19 looks (9 masculine, 10 feminine), 7 hairstyles per gender plus facial hair, 5 hats, 3 glasses, 5 shoe styles, 8 hair colors, 7 skin tones, Masculine / Feminine labels — editable in `content/character-options.json`; reviewed at Milestone 16. (Sets the section 5.1 defaults.)

