/**
 * "Learning Objectives" — a short (2–3 minute) interactive part of today's ELD PD, facilitated by Mrs. Weber in her
 * classroom (7th grade USC English).
 *
 * Built from the ELD Director's deck on language objectives for multilingual learners (MLLs) and the CDE guidance
 * summarized in assets/Learning-Objectives-Room-Blueprint.md, boiled down to five quick stations: the dual purpose,
 * content (WHAT) vs. language (HOW), the formula "Students will [DO] + [USE] + [HOW]" (function, demand, domain), a
 * quality check against the 3 criteria (the check for understanding), and a takeaway + commitment. Finishing the last
 * station completes the assignment.
 */
import weberPortrait from "./assets/weber_portrait.png";

let overlay: HTMLElement | null = null;
let step = 0; // where the player is (kept while the game is open, so closing and reopening resumes)
let onDone: (() => void) | null = null;
/** Each activity's progress, so Back / reopening keep what the player already did */
const state = {
  purposes: new Set<number>(),
  sortCV: new Map<number, "C" | "L">(),
  reels: [0, 0, 0],
  spun: false,
  quality: new Map<number, number>(),
};

export function isLessonOpen(): boolean {
  return !!overlay;
}

/** The rooms that have one of these interactive lessons */
export function hasLesson(roomId: string): boolean {
  return roomId === "7th-usc-english";
}

export function closeLesson(): void {
  if (!overlay) return;
  window.removeEventListener("keydown", onKey, true);
  overlay.remove();
  overlay = null;
}

function onKey(e: KeyboardEvent): void {
  if (!overlay) return;
  e.stopImmediatePropagation(); // the lesson has the keyboard while it is open (typing in its boxes still works)
  if (e.key === "Escape") {
    e.preventDefault();
    closeLesson();
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------------------------------------------

const PURPOSES = [
  { t: "Help MLLs access the grade-level content", ok: true },
  { t: "Make the lesson shorter", ok: false },
  { t: "Help MLLs keep growing their English", ok: true },
  { t: "Replace the content objective", ok: false },
];

const CV_CARDS: Array<{ t: string; a: "C" | "L"; why: string }> = [
  { t: "Identify the causes of the American Revolution.", a: "C", why: "WHAT students learn." },
  { t: "Retell the story's events to a partner using first, next, then, finally.", a: "L", why: "HOW: retelling out loud with sequence words." },
  { t: "Solve two-step equations.", a: "C", why: "WHAT: math content." },
  { t: "Persuade a partner using “I believe ___ because ___.”", a: "L", why: "HOW: a frame, spoken with a partner." },
];

const REELS: string[][] = [
  [
    "compare two characters",
    "explain how the water cycle works",
    "justify their solution to a word problem",
    "summarize the main idea of an article",
    "predict what will happen next in the story",
  ],
  [
    "using the frame “Both ___ and ___, but ___”",
    "using the sequence words first, next, finally",
    "using because and therefore",
    "using academic vocabulary (evidence, analyze)",
    "using precise adjectives",
  ],
  [
    "by speaking with a partner",
    "in a written paragraph",
    "by listening for key details and retelling them",
    "by reading the text, then writing two sentences",
    "in a partner discussion and an exit slip",
  ],
];
const REEL_NAMES = ["DO · function", "USE · demand", "HOW · domain"];

const QUALITY_TAGS = ["✅ Strong", "Missing the demand", "Content only"];
const QUALITY: Array<{ t: string; a: number; why: string }> = [
  { t: "Students will explain how the water cycle works using the sequence words first, next, finally by speaking with a partner.", a: 0, why: "Function + demand + domain. All 3 criteria!" },
  { t: "Students will describe the setting of the story by writing a paragraph.", a: 1, why: "What language do they need? Name the adjectives or the frame." },
  { t: "Students will identify the parts of a plant cell.", a: 2, why: "A fine content objective, but no language in it yet." },
];

// ---------------------------------------------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------------------------------------------

interface Step {
  title: string;
  /** Mrs. Weber's line at the top of the step */
  weber: string;
  body: () => string;
  /** Wire up the step's buttons after it is drawn */
  wire?: (root: HTMLElement) => void;
  /** Whether Next is allowed yet (the activity is done) */
  ready?: () => boolean;
  /** Shown beside a disabled Next */
  need?: string;
}

const STEPS: Step[] = [
  {
    title: "Why language objectives?",
    weber:
      "Welcome to my classroom! I teach 7th grade English, and today I'm facilitating part of our ELD PD: Learning Objectives. Five quick stations, about three minutes. First: a language objective has TWO jobs. Tap them!",
    body: () => `
      <div class="lo-chips">
        ${PURPOSES.map((p, i) => {
          const on = state.purposes.has(i);
          return `<button type="button" class="lo-chip ${on ? (p.ok ? "good" : "bad") : ""}" data-purpose="${i}">${esc(p.t)}</button>`;
        }).join("")}
      </div>
      ${
        PURPOSES.every((p, i) => !p.ok || state.purposes.has(i))
          ? `<div class="lo-reveal">
              <p><b>🎉 Exactly. A language objective describes the specific language students will use to <u>access</u> and <u>demonstrate</u> their learning during a lesson.</b></p>
              <p>Grade-level content for everyone, plus the language to get there. No watered-down lessons.</p>
              <a class="lo-video" href="https://www.youtube.com/watch?v=Ef6ZQE2QM6c" target="_blank" rel="noopener">▶ Later: watch Dr. José Medina on content + language (new tab)</a>
            </div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-purpose]").forEach((b) =>
        b.addEventListener("click", () => {
          const i = Number(b.dataset.purpose);
          if (PURPOSES[i].ok) state.purposes.add(i);
          else {
            b.classList.add("bad", "shake");
            setTimeout(() => b.classList.remove("bad", "shake"), 700);
            return;
          }
          render();
        })
      );
    },
    ready: () => PURPOSES.every((p, i) => !p.ok || state.purposes.has(i)),
    need: "Find both jobs",
  },
  {
    title: "WHAT vs. HOW",
    weber:
      "The content objective is WHAT students learn. The language objective is HOW they learn it or show it: by listening, speaking, reading, or writing. Sort these four!",
    body: () => `
      <div class="lo-sort">
        ${CV_CARDS.map((c, i) => {
          const pick = state.sortCV.get(i);
          const right = pick === c.a;
          return `<div class="lo-card ${pick ? (right ? "good" : "bad") : ""}">
            <p>${esc(c.t)}</p>
            ${
              pick && right
                ? `<small>${c.a === "C" ? "Content" : "Language"} ✓ ${esc(c.why)}</small>`
                : `<div class="lo-btns"><button type="button" data-cv="${i}" data-v="C">Content (WHAT)</button><button type="button" data-cv="${i}" data-v="L">Language (HOW)</button></div>
                   ${pick ? `<small class="lo-try">Not quite. Is it WHAT or HOW?</small>` : ""}`
            }
          </div>`;
        }).join("")}
      </div>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-cv]").forEach((b) =>
        b.addEventListener("click", () => {
          state.sortCV.set(Number(b.dataset.cv), b.dataset.v as "C" | "L");
          render();
        })
      );
    },
    ready: () => CV_CARDS.every((c, i) => state.sortCV.get(i) === c.a),
    need: "Sort all four",
  },
  {
    title: "The Formula Machine",
    weber:
      "Every language objective has three parts. The FUNCTION is what students DO with language. The DEMAND is the language they need to USE: if the content is the destination, the demand is the road. The DOMAIN is HOW: listening, speaking, reading, writing (+1: their home language!). Pull the lever and build one.",
    body: () => `
      <div class="lo-formula">Students will <b class="f1">[DO]</b> + <b class="f2">[USE]</b> + <b class="f3">[HOW]</b></div>
      <div class="lo-machine">
        ${REELS.map(
          (r, k) => `<div class="lo-reel r${k + 1}">
            <span class="lo-reel-name">${REEL_NAMES[k]}</span>
            <button type="button" class="lo-arrow" data-reel="${k}" data-d="-1" aria-label="Previous">▲</button>
            <div class="lo-reel-val">${esc(r[state.reels[k]])}</div>
            <button type="button" class="lo-arrow" data-reel="${k}" data-d="1" aria-label="Next">▼</button>
          </div>`
        ).join("")}
        <button type="button" class="lo-lever" data-spin>🎰 Pull the lever</button>
      </div>
      ${
        state.spun
          ? `<div class="lo-result"><span>Your objective:</span> Students will <b class="f1">${esc(REELS[0][state.reels[0]])}</b> <b class="f2">${esc(REELS[1][state.reels[1]])}</b> <b class="f3">${esc(REELS[2][state.reels[2]])}</b>.</div>
             <p class="lo-tip">Not every combo fits every lesson. That's your teacher judgment. Tip: write an exemplar student answer first, then ask "what language does it take to say this?"</p>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-reel]").forEach((b) =>
        b.addEventListener("click", () => {
          const k = Number(b.dataset.reel);
          const n = REELS[k].length;
          state.reels[k] = (state.reels[k] + Number(b.dataset.d) + n) % n;
          state.spun = true;
          render();
        })
      );
      root.querySelector("[data-spin]")?.addEventListener("click", () => {
        const vals = root.querySelectorAll<HTMLElement>(".lo-reel-val");
        vals.forEach((v) => v.classList.add("spinning"));
        let ticks = 0;
        const iv = window.setInterval(() => {
          ticks++;
          vals.forEach((v, k) => {
            if (ticks < 6 + k * 3) v.textContent = REELS[k][Math.floor(Math.random() * REELS[k].length)];
          });
          if (ticks >= 12) {
            window.clearInterval(iv);
            state.reels = state.reels.map((_, k) => Math.floor(Math.random() * REELS[k].length));
            state.spun = true;
            render();
          }
        }, 80);
      });
    },
    ready: () => state.spun,
    need: "Build an objective",
  },
  {
    title: "Quality Check",
    weber:
      "Now you're the coach. A strong language objective (1) connects to the lesson task, (2) names the language students need, and (3) gives them real chances to use it. Tag each one!",
    body: () => `
      <div class="lo-criteria"><span>1 · Connects to the task <i>(function)</i></span><span>2 · Names the language <i>(demand)</i></span><span>3 · Chances to use it <i>(domain)</i></span></div>
      <div class="lo-quality">
        ${QUALITY.map((q, i) => {
          const pick = state.quality.get(i);
          const right = pick === q.a;
          return `<div class="lo-card wide ${pick !== undefined ? (right ? "good" : "bad") : ""}">
            <p>“${esc(q.t)}”</p>
            ${
              right
                ? `<small>${QUALITY_TAGS[q.a]} ✓ ${esc(q.why)}</small>`
                : `<div class="lo-btns">${QUALITY_TAGS.map((t, k) => `<button type="button" data-q="${i}" data-v="${k}">${t}</button>`).join("")}</div>
                   ${pick !== undefined ? `<small class="lo-try">Check it against the 3 criteria again.</small>` : ""}`
            }
          </div>`;
        }).join("")}
      </div>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-q]").forEach((b) =>
        b.addEventListener("click", () => {
          state.quality.set(Number(b.dataset.q), Number(b.dataset.v));
          render();
        })
      );
    },
    ready: () => QUALITY.every((q, i) => state.quality.get(i) === q.a),
    need: "Tag all three",
  },
  {
    title: "You're an Objective Architect!",
    weber:
      "That's it! Language objectives make language development intentional. One last thing: keep the content rigorous for everyone and adjust the support, from substantial (Emerging) to moderate (Expanding) to light (Bridging). Make one commitment before you go. Oh, and don't forget to log your reading minutes for the week and have an adult sign off on it!",
    body: () => `
      <div class="lo-badge"><span>🏅</span><div><b>Objective Architect</b><small>Learning Objectives · ELD PD with Mrs. Weber</small></div></div>
      <ul class="lo-takeaways">
        <li><b>Two jobs:</b> access to the content <i>and</i> continued English growth.</li>
        <li><b>The formula:</b> Students will <b class="f1">[DO]</b> + <b class="f2">[USE]</b> + <b class="f3">[HOW]</b>.</li>
        <li><b>The check:</b> connects to the task · names the language · gives chances to use it.</li>
        <li><b>Make it visible:</b> post it with domain icons. Your curriculum (and the Unit Map's Language section) often gives you part of it already!</li>
      </ul>
      <div class="lo-commit one">
        <label><b>📣 My commitment</b> <i>(optional, share it with your table!)</i><textarea rows="2" placeholder="In my next lesson, I will…"></textarea></label>
      </div>`,
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------

function render(): void {
  if (!overlay) return;
  const s = STEPS[step];
  const ready = s.ready ? s.ready() : true;
  const last = step === STEPS.length - 1;
  overlay.querySelector(".lo-dots")!.innerHTML = STEPS.map((_, i) => `<span class="${i < step ? "done" : i === step ? "now" : ""}"></span>`).join("");
  overlay.querySelector(".lo-stepname")!.textContent = `Station ${step + 1} of ${STEPS.length} · ${s.title}`;
  const scroll = overlay.querySelector<HTMLElement>(".lo-main")!;
  const keep = scroll.dataset.step === String(step) ? scroll.scrollTop : 0;
  scroll.dataset.step = String(step);
  scroll.innerHTML = `
    <div class="lo-weber"><img src="${weberPortrait}" alt="" /><div class="lo-bubble"><b>Mrs. Weber</b>${esc(s.weber)}</div></div>
    <h2>${esc(s.title)}</h2>
    ${s.body()}`;
  scroll.scrollTop = keep;
  s.wire?.(scroll);
  const back = overlay.querySelector<HTMLButtonElement>(".lo-back")!;
  const next = overlay.querySelector<HTMLButtonElement>(".lo-next")!;
  back.disabled = step === 0;
  next.disabled = !ready;
  next.textContent = last ? "Finish ✓" : "Next →";
  overlay.querySelector(".lo-need")!.textContent = ready ? "" : s.need ?? "";
}

/**
 * Open the lesson. `alreadyDone`: the player finished it before (they can go through it again). `complete` runs once,
 * when the player finishes the last station.
 */
export function openLesson(roomId: string, alreadyDone: boolean, complete: () => void): void {
  if (overlay || !hasLesson(roomId)) return;
  onDone = alreadyDone ? null : () => {
    onDone = null;
    complete();
  };
  overlay = document.createElement("div");
  overlay.className = "modal-overlay lo-overlay";
  overlay.innerHTML = `
    <div class="lo-wrap" role="dialog" aria-modal="true" aria-label="Learning Objectives with Mrs. Weber">
      <div class="lo-top">
        <div><span class="lo-kicker">ELD PD · facilitated by Mrs. Weber</span><b>Learning Objectives</b></div>
        <div class="lo-dots"></div>
        <button type="button" class="lo-close" aria-label="Close (you can come back)">✕</button>
      </div>
      <div class="lo-stepname"></div>
      <div class="lo-main"></div>
      <div class="lo-foot">
        <button type="button" class="lo-back">← Back</button>
        <span class="lo-need"></span>
        <button type="button" class="lo-next">Next →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".lo-close")!.addEventListener("click", closeLesson);
  overlay.querySelector(".lo-back")!.addEventListener("click", () => {
    if (step > 0) step--;
    render();
  });
  overlay.querySelector(".lo-next")!.addEventListener("click", () => {
    if (step === STEPS.length - 1) {
      onDone?.(); // finishing the last station completes the assignment
      closeLesson();
      step = 0;
      return;
    }
    step++;
    render();
  });
  window.addEventListener("keydown", onKey, true);
  render();
}
