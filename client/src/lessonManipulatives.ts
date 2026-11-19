/**
 * "Using Manipulatives to Support MLLs" — a short (2–3 minute) hands-on part of today's ELD PD, facilitated by
 * Mr. Stauffer in his classroom (6th grade LMU science), with science manipulatives and realia.
 *
 * Built from assets/Manipulatives-for-MLLs-Room-Blueprint.md (realia and models in science, D10; CRA, C1; the research
 * in Part B: Carbonneau, Marley & Selig 2013; the language routines in Part E; CA Math/ELD connections), as five quick
 * stations: rock samples under a hand lens (show before tell), building a water molecule with bead atoms (concrete,
 * drawn and written side by side: CRA), a cell model with analogy frames, myth busters from the research, and the
 * takeaways (show it → say it → draw it → write it). Finishing the last station completes the assignment.
 */
import staufferPortrait from "./assets/stauffer_portrait.png";
import { esc, rerender, type LessonDef, type LessonStep } from "./lessonEngine";

const fresh = () => ({
  looked: new Set<number>(),
  rockType: new Map<number, number>(),
  atoms: [] as string[],
  atomMsg: "",
  pickPart: -1,
  linked: new Set<number>(),
  wrongJob: -1,
  myths: new Map<number, boolean>(),
});
let state = fresh();

// Station 1: three rock samples under the hand lens
const ROCK_TYPES = ["Igneous", "Sedimentary", "Metamorphic"];
const ROCKS = [
  { name: "Sample A", color: "#b9a37d", stripes: "layers", see: "flat <b>layers</b> of sand, a gritty <b>texture</b>", a: 1, es: "sedimentaria" },
  { name: "Sample B", color: "#4b4f57", stripes: "crystals", see: "speckled <b>crystals</b>; it formed from cooled lava", a: 0, es: "ígnea" },
  { name: "Sample C", color: "#8a8fa0", stripes: "bands", see: "wavy, squeezed <b>bands</b> that sparkle", a: 2, es: "metamórfica" },
];

// Station 2: the bead atoms for a water molecule
const BEADS = [
  { id: "H", name: "Hydrogen", color: "#f8fafc", text: "#334155" },
  { id: "O", name: "Oxygen", color: "#ef4444", text: "#fff" },
  { id: "C", name: "Carbon", color: "#1f2937", text: "#fff" },
];

// Station 3: the cell model — parts and what they do (with an analogy)
const PARTS = [
  { name: "Nucleus", es: "núcleo", like: "a control center", job: "holds the DNA and directs the cell" },
  { name: "Cell membrane", es: "membrana celular", like: "a security gate", job: "controls what goes in and out" },
  { name: "Mitochondria", es: "mitocondria", like: "a power plant", job: "turns food into energy" },
  { name: "Chloroplast", es: "cloroplasto", like: "a solar panel", job: "uses sunlight to make food (plants)" },
];
const JOB_ORDER = [2, 0, 3, 1];

const MYTHS = [
  { t: "Fancier, more realistic models work better.", why: "In a meta-analysis of 55 studies, plain, simple tools did far better on retention (≈ 0.80) than realistic, decorative ones (≈ 0.27). Flashy details distract." },
  { t: "Students learn just by exploring with the models.", why: "High teacher guidance (≈ 1.06) far outperformed free exploration (≈ 0.04). Model it, guide it, then release it, and always connect it to words and symbols." },
  { t: "Hands-on models are for the “low” kids.", why: "Offer them to everyone (that's UDL) and make them grown-up: “scientists and engineers build models too.” Advanced students use them to explain and predict." },
];

const count = (id: string) => state.atoms.filter((a) => a === id).length;
const isWater = () => count("H") === 2 && count("O") === 1;

function moleculeView(): string {
  const h = count("H");
  const o = count("O");
  const done = isWater();
  const bead = (id: string) => {
    const b = BEADS.find((x) => x.id === id)!;
    return `<i class="mn-bead" style="background:${b.color};color:${b.text}">${id}</i>`;
  };
  const drawn = done ? "H — O — H" : state.atoms.length ? state.atoms.join(" — ") : "…";
  const formula = done ? "H<sub>2</sub>O" : `${h ? `H${h > 1 ? `<sub>${h}</sub>` : ""}` : ""}${o ? "O" : ""}` || "?";
  return `
    <div class="mn-cra">
      <div class="mn-col"><span class="mn-tag">Concrete · build it</span>
        <div class="mn-mol ${done ? "done" : ""}">${state.atoms.map(bead).join("") || `<span class="mn-empty">tap the beads below to add atoms</span>`}</div>
      </div>
      <div class="mn-col"><span class="mn-tag">Representational · draw it</span><div class="mn-sketch">${drawn}</div></div>
      <div class="mn-col"><span class="mn-tag">Abstract · write it</span><div class="mn-alg">${formula}</div></div>
    </div>`;
}

const STEPS: LessonStep[] = [
  {
    title: "Show before tell",
    say:
      "Welcome to the lab! I teach 6th grade science, and today I'm facilitating part of our ELD PD: Using Manipulatives to Support MLLs. Every table gets real rock samples and a hand lens. Tap 🔍 on each rock to look closely, then sort it.",
    body: () => `
      <div class="mn-rocks">
        ${ROCKS.map((r, i) => {
          const seen = state.looked.has(i);
          const pick = state.rockType.get(i);
          const right = pick === r.a;
          return `<div class="mn-rock ${right ? "good" : pick !== undefined ? "bad" : ""}">
            <div class="mn-stone ${r.stripes}" style="--c:${r.color}"></div>
            <b>${r.name}</b>
            ${
              seen
                ? `<small>${r.see}</small>
                   ${
                     right
                       ? `<small class="ok">✓ ${ROCK_TYPES[r.a]} (<i>${r.es}</i>)</small>`
                       : `<div class="lo-btns">${ROCK_TYPES.map((t, k) => `<button type="button" data-rock="${i}" data-v="${k}">${t}</button>`).join("")}</div>`
                   }`
                : `<button type="button" class="mn-lens" data-look="${i}">🔍 Look closely</button>`
            }
          </div>`;
        }).join("")}
      </div>
      ${
        ROCKS.every((r, i) => state.rockType.get(i) === r.a)
          ? `<div class="lo-reveal"><p><b>Everyone held the same rocks</b>, so “this one has lines” (plus pointing) worked before the word <i>layers</i> did. Then the teacher attaches the academic term. MLLs can <b>show before they tell</b>.</p></div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-look]").forEach((b) =>
        b.addEventListener("click", () => {
          state.looked.add(Number(b.dataset.look));
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-rock]").forEach((b) =>
        b.addEventListener("click", () => {
          state.rockType.set(Number(b.dataset.rock), Number(b.dataset.v));
          rerender();
        })
      );
    },
    ready: () => ROCKS.every((r, i) => state.rockType.get(i) === r.a),
    need: "Look at and sort all three rocks",
  },
  {
    title: "Build a molecule",
    say:
      "Now build a water molecule with bead atoms. Watch the drawing and the formula change as you build: that's CRA, concrete → representational → abstract. Don't skip the drawing!",
    body: () => {
      const done = isWater();
      return `
      ${moleculeView()}
      <div class="mn-moves">
        ${BEADS.map((b) => `<button type="button" data-bead="${b.id}" ${done ? "disabled" : ""}><i class="mn-bead sm" style="background:${b.color};color:${b.text}">${b.id}</i> Add ${b.name.toLowerCase()}</button>`).join("")}
        <button type="button" data-clear ${state.atoms.length && !done ? "" : "disabled"}>↺ Clear</button>
      </div>
      <div class="mn-say ${state.atomMsg.startsWith("⚠") ? "warn" : ""}">${state.atomMsg || "🗣️ Water is made of hydrogen and oxygen. How many of each?"}</div>
      ${
        done
          ? `<p class="lo-tip">Frames by level · <b>E:</b> “Water has ___ hydrogen and ___ oxygen.” · <b>X:</b> “When ___ combines with ___, it forms ___.” · <b>B:</b> “A water molecule forms when two hydrogen atoms bond to one oxygen atom, which is why its formula is ___.”</p>`
          : ""
      }`;
    },
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-bead]").forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.dataset.bead!;
          if (id === "C") state.atomMsg = "⚠️ Carbon isn't part of water. That one belongs in CO₂ (carbon dioxide)!";
          else if ((id === "H" && count("H") >= 2) || (id === "O" && count("O") >= 1)) state.atomMsg = `⚠️ Water only has ${id === "H" ? "two hydrogen atoms" : "one oxygen atom"}.`;
          else {
            state.atoms.push(id);
            if (isWater()) {
              state.atoms = ["H", "O", "H"];
              state.atomMsg = "🗣️ “When two hydrogen atoms combine with one oxygen atom, they form a water molecule: H₂O!”";
            } else state.atomMsg = `🗣️ “I added ${id === "H" ? "a hydrogen" : "an oxygen"} atom.”`;
          }
          rerender();
        })
      );
      root.querySelector("[data-clear]")?.addEventListener("click", () => {
        state.atoms = [];
        state.atomMsg = "";
        rerender();
      });
    },
    ready: () => isWater(),
    need: "Build H₂O",
  },
  {
    title: "The cell model",
    say:
      "Models give students something to talk ABOUT. Tap a part of the cell model, then tap its job. Each match becomes an analogy frame: “The ___ is like a ___ because it ___.”",
    body: () => `
      <div class="mn-bin">
        <div class="mn-cellwrap">
          <div class="mn-cell">
            ${PARTS.map((p, i) => `<button type="button" class="mn-part p${i} ${state.linked.has(i) ? "done" : state.pickPart === i ? "on" : ""}" data-part="${i}" ${state.linked.has(i) ? "disabled" : ""}>${p.name}</button>`).join("")}
          </div>
        </div>
        <div class="mn-list">
          ${JOB_ORDER.map((i) => {
            const p = PARTS[i];
            const done = state.linked.has(i);
            return `<button type="button" class="mn-what ${done ? "done" : ""} ${state.wrongJob === i ? "shake" : ""}" data-job="${i}" ${done ? "disabled" : ""}>${
              done ? `The <b>${p.name.toLowerCase()}</b> (<i>${p.es}</i>) is like ${p.like} because it ${p.job}.` : esc(p.job.charAt(0).toUpperCase() + p.job.slice(1))
            }</button>`;
          }).join("")}
        </div>
      </div>
      ${state.linked.size === PARTS.length ? `<p class="lo-tip">Label models <b>bilingually</b>: so many science words are cognates (<i>célula, núcleo, átomo, molécula, energía</i>). Post each model on the word wall with its vocabulary and a frame.</p>` : ""}`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-part]").forEach((b) =>
        b.addEventListener("click", () => {
          state.pickPart = Number(b.dataset.part);
          state.wrongJob = -1;
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-job]").forEach((b) =>
        b.addEventListener("click", () => {
          const j = Number(b.dataset.job);
          if (state.pickPart < 0) return;
          if (state.pickPart === j) {
            state.linked.add(j);
            state.wrongJob = -1;
          } else state.wrongJob = j;
          state.pickPart = -1;
          rerender();
        })
      );
    },
    ready: () => state.linked.size === PARTS.length,
    need: "Match all four parts",
  },
  {
    title: "Myth busters",
    say: "Let's check the research. True or false?",
    body: () => `
      <div class="mn-myths">
        ${MYTHS.map((m, i) => {
          const pick = state.myths.get(i);
          const right = pick === false;
          return `<div class="lo-card wide ${pick !== undefined ? (right ? "good" : "bad") : ""}">
            <p>“${esc(m.t)}”</p>
            ${
              right
                ? `<small>❌ Myth! ${esc(m.why)}</small>`
                : `<div class="lo-btns"><button type="button" data-myth="${i}" data-v="1">True</button><button type="button" data-myth="${i}" data-v="0">False</button></div>
                   ${pick !== undefined ? `<small class="lo-try">That's what many people think. Look again!</small>` : ""}`
            }
          </div>`;
        }).join("")}
      </div>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-myth]").forEach((b) =>
        b.addEventListener("click", () => {
          state.myths.set(Number(b.dataset.myth), b.dataset.v === "1");
          rerender();
        })
      );
    },
    ready: () => MYTHS.every((_, i) => state.myths.get(i) === false),
    need: "Bust all three myths",
  },
  {
    title: "You're a Master Builder!",
    say:
      "Great work, scientist! A model a student built is real evidence of learning, even before they can explain it in English. Hands on the models, words in their mouths!",
    body: () => `
      <div class="lo-badge"><span>🔬</span><div><b>Master Builder</b><small>Manipulatives for MLLs · ELD PD with Mr. Stauffer</small></div></div>
      <div class="go-route mn-route"><span>🧱 Show it</span>→<span>🗣️ Say it</span>→<span>✏️ Draw it</span>→<span>✍️ Write it</span></div>
      <ul class="lo-takeaways">
        <li><b>Real objects and simple models:</b> rock kits, bead or molecule kits, cell models, a water cycle in a zip bag, magnets, balances and masses.</li>
        <li><b>Concrete → drawing → symbols.</b> Don't skip the drawing, and connect it to the scientific words.</li>
        <li><b>High guidance, plain tools.</b> Model it, guide it, release it.</li>
        <li><b>Pair every move with language:</b> partners narrate (Builder / Recorder) with frames, or describe a hidden model for a partner to rebuild.</li>
      </ul>`,
  },
];

export const MANIPULATIVES_LESSON: LessonDef = {
  roomId: "6th-lmu-science",
  title: "Using Manipulatives to Support MLLs",
  kicker: "ELD PD · facilitated by Mr. Stauffer",
  teacher: "Mr. Stauffer",
  portrait: staufferPortrait,
  steps: STEPS,
  reset: () => {
    state = fresh();
  },
};
