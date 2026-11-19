/**
 * "Learning Objectives" — the interactive assignment Mrs. Weber facilitates in her classroom (7th grade USC English).
 *
 * Built from the ELD Director's deck on language objectives for multilingual learners (MLLs) and the CDE guidance
 * summarized in assets/Learning-Objectives-Room-Blueprint.md: the dual purpose, content vs. language objectives, the
 * 4 (+1) language domains, language function vs. demand, the formula "Students will [DO] + [USE] + [HOW]", the 3
 * quality criteria, one goal at three proficiency levels (CA ELD Standards), a write-your-own, a 2-question exit
 * ticket, and a public/private commitment.
 *
 * The exit ticket completes the assignment whatever the score (it is a check for understanding, not a test).
 */
import weberPortrait from "./assets/weber_portrait.png";

let overlay: HTMLElement | null = null;
let step = 0; // where the player is (kept while the game is open, so closing and reopening resumes)
let onDone: (() => void) | null = null;
/** Each activity's progress, so Back / reopening keep what the player already did */
const state = {
  purposes: new Set<number>(),
  sortCV: new Map<number, "C" | "L">(),
  domains: new Set<number>(),
  sortFD: new Map<number, "F" | "D">(),
  reels: [0, 0, 0],
  spun: false,
  quality: new Map<number, number>(),
  flips: new Set<number>(),
  mine: { content: "", exemplar: "", objective: "", checks: [false, false, false] },
  answers: [-1, -1],
  submitted: false,
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
  { t: "Identify the causes of the American Revolution.", a: "C", why: "It names WHAT students learn (history), not the language they use." },
  { t: "Retell the story's events to a partner using first, next, then, finally.", a: "L", why: "It names HOW: retelling out loud with sequence words." },
  { t: "Solve two-step equations.", a: "C", why: "Pure math content: what students will be able to do." },
  { t: "Summarize the article in writing using three key vocabulary words.", a: "L", why: "Summarizing in writing with named vocabulary is the language students use." },
  { t: "Investigate how plants make their own food.", a: "C", why: "The science they'll learn: content." },
  { t: "Persuade a partner using “I believe ___ because ___.”", a: "L", why: "A language function (persuade) + a frame + speaking: language." },
];

const DOMAINS = [
  { icon: "👂", name: "Listening", d: "Students take in spoken language: a read-aloud, a partner's idea, directions.", idea: "“Listen for the two reasons your partner gives.”" },
  { icon: "🗣️", name: "Speaking", d: "Students produce spoken language: partner talk, presenting, asking questions.", idea: "Stand Up, Hand Up, Pair Up with a sentence frame." },
  { icon: "📖", name: "Reading", d: "Students make meaning from text: articles, word problems, lab steps.", idea: "Annotate the text for cause-and-effect words." },
  { icon: "✍️", name: "Writing", d: "Students produce written language: sentences, paragraphs, explanations.", idea: "Write two sentences using the frame on the board." },
  { icon: "🌎", name: "+1 Translanguaging", d: "Students use their whole language repertoire, home language included, and notice how languages connect (cognates!).", idea: "“Do you know this word in another language?”" },
];

const FD_CARDS: Array<{ t: string; a: "F" | "D" }> = [
  { t: "Explain how a character changes", a: "F" },
  { t: "Use because and therefore", a: "D" },
  { t: "Compare two habitats", a: "F" },
  { t: "The frame “Both ___ and ___, but ___”", a: "D" },
  { t: "Justify a solution", a: "F" },
  { t: "Precise adjectives and past-tense verbs", a: "D" },
];

const REELS: string[][] = [
  [
    "compare two characters",
    "explain how the water cycle works",
    "justify their solution to a word problem",
    "summarize the main idea of an article",
    "describe a historical event",
    "predict what will happen next in the story",
  ],
  [
    "using the frame “Both ___ and ___, but ___”",
    "using the sequence words first, next, finally",
    "using because and therefore",
    "using academic vocabulary (evidence, analyze)",
    "using precise adjectives",
    "using complex sentences",
  ],
  [
    "by speaking with a partner",
    "in a written paragraph",
    "by listening for key details and retelling them",
    "by reading the text, then writing two sentences",
    "in a partner discussion and an exit slip",
    "by presenting to their table",
  ],
];
const REEL_NAMES = ["DO (function)", "USE (demand)", "HOW (domain)"];

const QUALITY_TAGS = ["✅ Strong", "Missing the demand", "Missing the domain", "Content only"];
const QUALITY: Array<{ t: string; a: number; why: string }> = [
  { t: "Students will explain how the water cycle works using the sequence words first, next, finally by speaking with a partner.", a: 0, why: "Function (explain) + demand (sequence words) + domain (speaking). All three criteria!" },
  { t: "Students will describe the setting of the story by writing a paragraph.", a: 1, why: "We know what they DO and HOW, but not what language they need: which adjectives? which frame?" },
  { t: "Students will compare fractions using “greater than” and “less than” and the frame “___ is greater than ___ because ___.”", a: 2, why: "Great function and demand, but will they say it, write it, or both? Name the domain." },
  { t: "Students will identify the parts of a plant cell.", a: 3, why: "This is a strong content objective, but there's no language in it yet." },
];

const LEVELS = [
  { lvl: "Emerging", sup: "substantial support", obj: "Students will explain one cause of the American Revolution using a word bank and the frame “One cause was ___ because ___” by speaking with a partner." },
  { lvl: "Expanding", sup: "moderate support", obj: "Students will explain how the French and Indian War led to the American Revolution using cause/effect connectives (because, as a result) and topic vocabulary by speaking with a partner and writing two sentences." },
  { lvl: "Bridging", sup: "light support", obj: "Students will explain and justify the connection between the French and Indian War and the American Revolution using complex sentences, citation verbs (“The text states…”), and precise vocabulary in a partner discussion and a written paragraph." },
];

const QUIZ = [
  {
    q: "Which of these is a language objective?",
    opts: [
      "Students will identify the causes of the American Revolution.",
      "Students will explain the connection between the French and Indian War and the American Revolution using because and as a result by speaking with a partner.",
      "Students will complete the worksheet on page 42.",
      "Students will enjoy learning about history.",
    ],
    a: 1,
    why: "It names what students DO with language (explain), the language they USE (because, as a result), and HOW (speaking with a partner). The first choice is a content objective, and the last two aren't objectives at all.",
  },
  {
    q: "A teacher wrote: “Students will compare two characters by speaking with a partner.” Using the 3 criteria, what is it missing?",
    opts: [
      "The language function",
      "The language demand: the specific language students need, like a frame or vocabulary",
      "The language domain",
      "Nothing, it's complete",
    ],
    a: 1,
    why: "“Compare” is the function and “speaking with a partner” is the domain. What's missing is the road to get there: e.g. “using character-trait adjectives and the frame ‘Both ___ and ___, but ___.’”",
  },
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
    title: "Welcome to Room 7 USC",
    weber:
      "Hi, I'm Mrs. Weber! Grab a seat. Today we're becoming Objective Architects: we're going to learn how to write language objectives that help our multilingual learners (MLLs) take on grade-level content. It's quick, it's hands-on, and there's a badge at the end. Ready?",
    body: () => `
      <div class="lo-map">
        ${[
          ["🎯", "Why bother?"],
          ["🧭", "What vs. How"],
          ["👂", "The 4 (+1) domains"],
          ["🛣️", "Function vs. Demand"],
          ["🎰", "The Formula Machine"],
          ["🔍", "Quality Check"],
          ["🪜", "One goal, three levels"],
          ["✏️", "Your turn"],
          ["🎟️", "Exit ticket"],
        ]
          .map(([i, t], k) => `<div class="lo-map-stop"><span>${i}</span><b>${k + 1}</b>${t}</div>`)
          .join("")}
      </div>
      <p class="lo-tip">Tip: tap the cards and buttons. Every station has something to do. You can close this any time (Esc) and pick up where you left off.</p>`,
  },
  {
    title: "Why bother? The dual purpose",
    weber: "Quick warm-up! Language objectives have TWO jobs. Tap the two you think are right.",
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
              <h3>You got it! 🎉</h3>
              <p><b>A language objective describes the specific language students will use to <u>access</u> and <u>demonstrate</u> their learning during a lesson.</b></p>
              <p>It sits right next to the content objective. It helps MLLs get into the content <i>and</i> keep developing their English, so nobody gets watered-down content.</p>
              <a class="lo-video" href="https://www.youtube.com/watch?v=Ef6ZQE2QM6c" target="_blank" rel="noopener">▶ Watch Dr. José Medina (opens a new tab): what do you notice? What do you wonder?</a>
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
    need: "Find both purposes",
  },
  {
    title: "What vs. How",
    weber:
      "The content objective says WHAT students will learn. The language objective says HOW they'll learn it or show it: by reading, writing, speaking, or listening. Sort these six. Content or language?",
    body: () => `
      <div class="lo-two">
        <div class="lo-def c"><b>Content objective = WHAT</b><span>“Today you will learn about the causes of the American Revolution.”</span></div>
        <div class="lo-def l"><b>Language objective = HOW</b><span>“You will explain orally the connection between the French and Indian War and the American Revolution by speaking with a partner.”</span></div>
      </div>
      <div class="lo-sort">
        ${CV_CARDS.map((c, i) => {
          const pick = state.sortCV.get(i);
          const right = pick === c.a;
          return `<div class="lo-card ${pick ? (right ? "good" : "bad") : ""}">
            <p>${esc(c.t)}</p>
            ${
              pick && right
                ? `<small>${c.a === "C" ? "Content" : "Language"} ✓ ${esc(c.why)}</small>`
                : `<div class="lo-btns"><button type="button" data-cv="${i}" data-v="C">Content</button><button type="button" data-cv="${i}" data-v="L">Language</button></div>
                   ${pick ? `<small class="lo-try">Not quite. Look again: is it WHAT or HOW?</small>` : ""}`
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
    need: "Sort all six cards",
  },
  {
    title: "The 4 (+1) language domains",
    weber:
      "Every language objective names HOW students will use language. These are the four domains the ELPAC tests, plus one more that honors our students' home languages. Tap each one to open it.",
    body: () => `
      <div class="lo-domains">
        ${DOMAINS.map((d, i) => {
          const open = state.domains.has(i);
          return `<button type="button" class="lo-domain ${open ? "open" : ""}" data-dom="${i}">
            <span class="lo-dicon">${d.icon}</span><b>${d.name}</b>
            ${open ? `<span class="lo-dtext">${esc(d.d)}</span><span class="lo-didea">💡 ${esc(d.idea)}</span>` : `<span class="lo-dtap">tap to open</span>`}
          </button>`;
        }).join("")}
      </div>
      ${
        state.domains.size === DOMAINS.length
          ? `<div class="lo-jot"><b>Stop &amp; Jot (optional):</b> How does knowing the domain you want students to use change the way you scaffold up to the final task?
              <textarea rows="2" placeholder="Your thoughts…" data-jot></textarea></div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-dom]").forEach((b) =>
        b.addEventListener("click", () => {
          state.domains.add(Number(b.dataset.dom));
          render();
        })
      );
    },
    ready: () => state.domains.size === DOMAINS.length,
    need: "Open all five domains",
  },
  {
    title: "Function vs. Demand",
    weber:
      "Here's my favorite metaphor: if the content is the destination, the language demand is the road students travel to get there. The FUNCTION is what students DO with language. The DEMAND is the language they need to USE to do it. Sort these!",
    body: () => `
      <div class="lo-road">
        <div><b>🎯 Function = DO</b><span>explain · compare · describe · justify · summarize · predict · argue · sequence</span></div>
        <div><b>🛣️ Demand = USE</b><span>vocabulary · sentence frames · connectives · noun phrases · complex sentences · verb tense</span></div>
      </div>
      <div class="lo-sort three">
        ${FD_CARDS.map((c, i) => {
          const pick = state.sortFD.get(i);
          const right = pick === c.a;
          return `<div class="lo-card ${pick ? (right ? "good" : "bad") : ""}">
            <p>${esc(c.t)}</p>
            ${
              pick && right
                ? `<small>${c.a === "F" ? "Function: what they DO" : "Demand: the language they USE"} ✓</small>`
                : `<div class="lo-btns"><button type="button" data-fd="${i}" data-v="F">Function</button><button type="button" data-fd="${i}" data-v="D">Demand</button></div>
                   ${pick ? `<small class="lo-try">Try the other one!</small>` : ""}`
            }
          </div>`;
        }).join("")}
      </div>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-fd]").forEach((b) =>
        b.addEventListener("click", () => {
          state.sortFD.set(Number(b.dataset.fd), b.dataset.v as "F" | "D");
          render();
        })
      );
    },
    ready: () => FD_CARDS.every((c, i) => state.sortFD.get(i) === c.a),
    need: "Sort all six cards",
  },
  {
    title: "The Formula Machine",
    weber:
      "Now let's build one! Every language objective follows one formula: Students will [DO] + [USE] + [HOW]. Pull the lever, or tap the arrows to pick your own pieces.",
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
             <p class="lo-tip">Does it fit together? Not every combination works for every lesson, and that's where your teacher judgment comes in. Keep tweaking until it sounds like your classroom.</p>`
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
      "A strong language objective meets 3 criteria: (1) it connects to the lesson task (the function), (2) it names the language students need (the demand), and (3) it gives students real chances to use language (the domain). Be the instructional coach: what's going on with each of these?",
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
                   ${pick !== undefined ? `<small class="lo-try">Hmm, check it against the 3 criteria again.</small>` : ""}`
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
    need: "Check all four objectives",
  },
  {
    title: "One goal, three levels",
    weber:
      "Here's the California piece. The CA ELD Standards describe three proficiency levels: Emerging, Expanding, and Bridging. The content goal stays the SAME rigorous, grade-level goal for everyone (EL Roadmap Principle 2). What changes is the support and the language demand. Flip each card.",
    body: () => `
      <div class="lo-goal">🎯 Same content goal for all: <b>the connection between the French and Indian War and the American Revolution</b></div>
      <div class="lo-levels">
        ${LEVELS.map((l, i) => {
          const open = state.flips.has(i);
          return `<button type="button" class="lo-flip ${open ? "open" : ""} lv${i}" data-flip="${i}">
            <b>${l.lvl}</b><span class="lo-sup">${l.sup}</span>
            ${open ? `<span class="lo-obj">${esc(l.obj)}</span>` : `<span class="lo-dtap">tap to flip</span>`}
          </button>`;
        }).join("")}
      </div>
      ${state.flips.size === 3 ? `<p class="lo-tip">Notice: every level still explains the same history. Keep the content rigorous; adjust the language support from substantial → moderate → light.</p>` : ""}`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-flip]").forEach((b) =>
        b.addEventListener("click", () => {
          state.flips.add(Number(b.dataset.flip));
          render();
        })
      );
    },
    ready: () => state.flips.size === 3,
    need: "Flip all three cards",
  },
  {
    title: "Your turn: Let's Try It",
    weber:
      "Think of a lesson you're teaching soon, and keep your “MLL Heart Student” in mind. Write the content objective, picture what a great student answer looks like, then use the formula. This part is just for you, so skip it if you'd like, but I'd love for you to try!",
    body: () => `
      <label class="lo-field"><b>Step 1 · Your content objective</b>
        <input type="text" data-mine="content" value="${esc(state.mine.content)}" placeholder="e.g. Students will explain how ecosystems depend on energy from the sun." /></label>
      <label class="lo-field"><b>Step 2 · An exemplar student response</b> <i>(What language does it take to produce this?)</i>
        <textarea rows="2" data-mine="exemplar" placeholder="e.g. Plants use energy from the sun to make food. Because animals eat plants, the energy moves through the food chain.">${esc(state.mine.exemplar)}</textarea></label>
      <label class="lo-field"><b>Step 3 · Your language objective</b> <i>Students will [DO] + [USE] + [HOW]</i>
        <textarea rows="2" data-mine="objective" placeholder="Students will…">${esc(state.mine.objective)}</textarea></label>
      <div class="lo-field"><b>Step 4 · Check it against the criteria</b>
        ${["It connects to the lesson task (function)", "It names the language students need (demand)", "It gives students chances to use language (domain)"]
          .map((t, k) => `<label class="lo-check"><input type="checkbox" data-check="${k}" ${state.mine.checks[k] ? "checked" : ""}/> ${t}</label>`)
          .join("")}
      </div>
      <p class="lo-tip">Heads up: Illustrative Math, Into Literature and Benchmark Advance already build part of a language objective into their lessons, and the Unit Map's “Language” section gives you the function and demand. Check them against the criteria and add what's missing!</p>`,
    wire: (root) => {
      root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-mine]").forEach((f) =>
        f.addEventListener("input", () => {
          (state.mine as any)[f.dataset.mine!] = f.value;
        })
      );
      root.querySelectorAll<HTMLInputElement>("[data-check]").forEach((c) =>
        c.addEventListener("change", () => {
          state.mine.checks[Number(c.dataset.check)] = c.checked;
        })
      );
    },
  },
  {
    title: "Exit ticket",
    weber: "Last stop! Two quick questions to check your understanding. There's no pressure: answer them and your assignment is complete either way.",
    body: () => `
      ${QUIZ.map(
        (q, i) => `<div class="lo-quiz">
          <h3>${i + 1}. ${esc(q.q)}</h3>
          ${q.opts
            .map((o, k) => {
              const picked = state.answers[i] === k;
              let cls = picked ? "picked" : "";
              if (state.submitted) cls = k === q.a ? "good" : picked ? "bad" : "";
              return `<button type="button" class="lo-opt ${cls}" data-ans="${i}" data-v="${k}" ${state.submitted ? "disabled" : ""}><span>${String.fromCharCode(65 + k)}</span>${esc(o)}</button>`;
            })
            .join("")}
          ${state.submitted ? `<p class="lo-why">${state.answers[i] === q.a ? "✅ Correct!" : "💡 The answer is " + String.fromCharCode(65 + q.a) + "."} ${esc(q.why)}</p>` : ""}
        </div>`
      ).join("")}
      ${
        state.submitted
          ? `<div class="lo-score">You got <b>${QUIZ.filter((q, i) => state.answers[i] === q.a).length} / ${QUIZ.length}</b>. Assignment complete! ⭐</div>`
          : `<button type="button" class="lo-submit" data-submit ${state.answers.includes(-1) ? "disabled" : ""}>Submit my answers</button>`
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-ans]").forEach((b) =>
        b.addEventListener("click", () => {
          state.answers[Number(b.dataset.ans)] = Number(b.dataset.v);
          render();
        })
      );
      root.querySelector("[data-submit]")?.addEventListener("click", () => {
        state.submitted = true;
        onDone?.(); // complete, whatever the score
        render();
      });
    },
    ready: () => state.submitted,
    need: "Answer both and submit",
  },
  {
    title: "You're an Objective Architect!",
    weber:
      "Fantastic work today! Language objectives make language development intentional: they name the language our MLLs need, right alongside grade-level content. Before you go, make two commitments.",
    body: () => `
      <div class="lo-badge"><span>🏅</span><div><b>Objective Architect</b><small>Learning Objectives · Room 7 USC</small></div></div>
      <ul class="lo-takeaways">
        <li><b>Dual purpose:</b> access to the content <i>and</i> continued English growth.</li>
        <li><b>What vs. How:</b> the content objective is the destination; the language objective is how students get there.</li>
        <li><b>The formula:</b> Students will <b class="f1">[DO]</b> + <b class="f2">[USE]</b> + <b class="f3">[HOW]</b>.</li>
        <li><b>Quality check:</b> connects to the task · names the language · gives chances to use it.</li>
        <li><b>Make it visible:</b> post it with domain icons (“At Table 4, we are speaking and writing”).</li>
      </ul>
      <div class="lo-commit">
        <label><b>🔒 Private commitment</b> <i>(just for you)</i><textarea rows="2" placeholder="One thing I'll do with language objectives…"></textarea></label>
        <label><b>📣 Public commitment</b> <i>(share it with your table!)</i><textarea rows="2" placeholder="Starting Monday, I will…"></textarea></label>
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
  next.textContent = last ? "Finish ✓" : step === 0 ? "Let's go! →" : "Next →";
  overlay.querySelector(".lo-need")!.textContent = ready ? "" : s.need ?? "";
}

/**
 * Open the lesson. `alreadyDone`: the player finished it before (they can go through it again). `complete` runs once,
 * when the exit ticket is submitted.
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
        <div><span class="lo-kicker">Room 7 USC · Mrs. Weber</span><b>Learning Objectives</b></div>
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
