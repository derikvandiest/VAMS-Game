/**
 * "Using Manipulatives to Support MLLs" — a short (2–3 minute) hands-on part of today's ELD PD, facilitated by
 * Mr. Stauffer in his classroom (6th grade LMU science).
 *
 * Built from assets/Manipulatives-for-MLLs-Room-Blueprint.md (Carbonneau, Marley & Selig 2013; Witzel, Mercer & Miller
 * 2003 on CRA; Moyer-Packenham & Westenskow on virtual manipulatives; Chval & Chávez; the 2023 CA Math Framework, Ch. 7),
 * as five quick stations: zero pairs with two-color counters, solving 2x + 3 = 7 with algebra tiles (concrete, drawn
 * and written side by side: CRA), stocking the tool bin (math and science examples), myth busters from the research,
 * and the takeaways (show it → say it → draw it → write it). Finishing the last station completes the assignment.
 */
import staufferPortrait from "./assets/stauffer_portrait.png";
import { esc, rerender, type LessonDef, type LessonStep } from "./lessonEngine";

const state = {
  pairs: 0,
  left: -1,
  units: 3, // unit tiles on the left of 2x + 3 = 7
  right: 7,
  split: false,
  tipped: false,
  said: "",
  pickTool: -1,
  linked: new Map<number, number>(),
  wrongLink: "",
  myths: new Map<number, boolean>(),
};

// Station 3: the tool bin (tools on the left, what they teach on the right, shuffled)
const TOOLS = [
  { icon: "🔴🟡", name: "Two-color counters", what: "Adding and subtracting integers", word: "zero pair" },
  { icon: "🧊", name: "Unit cubes", what: "Volume of a prism", word: "cubic units" },
  { icon: "▭▭", name: "Fraction strips", what: "How many 1/8s fit in 3/4?", word: "denominator" },
  { icon: "🪨🔍", name: "Rock samples + hand lens", what: "Describing rock properties", word: "texture, layers, crystals" },
  { icon: "🔵⚪", name: "Beads as atoms", what: "How molecules form", word: "atom, molecule, combine" },
];
const WHAT_ORDER = [2, 4, 0, 3, 1];

const MYTHS = [
  { t: "Fancier, more realistic manipulatives work better.", a: false, why: "Plain, simple tools did far better on retention (effect size ≈ 0.80) than realistic, decorative ones (≈ 0.27). Flashy details distract from the math." },
  { t: "Students learn just by exploring with the tools.", a: false, why: "With high teacher guidance the effect on problem solving was ≈ 1.06; with low guidance, ≈ 0.04. Tools don't teach by themselves: model it, guide it, then release it." },
  { t: "Manipulatives are for the “low” kids.", a: false, why: "Offer them to everyone (that's UDL), and make them grown-up: “these are models, like engineers and architects use.” Advanced students use them to justify and generalize." },
];

/** Algebra tiles + the drawn sketch + the equation for the current state of 2x + 3 = 7 */
function tileView(): string {
  const xs = state.split ? 1 : 2;
  const r = state.split ? state.right / 2 : state.right;
  const tiles = (n: number, cls: string) => Array.from({ length: n }, () => `<i class="${cls}"></i>`).join("");
  const side = (x: number, u: number) => `<div class="mn-side">${tiles(x, "mn-x")}${tiles(u, "mn-u")}</div>`;
  const sketch = (x: number, u: number) => `${"▭".repeat(x)}${u ? " " + "•".repeat(u) : ""}`;
  const eq = state.split ? "x = 2" : `2x${state.units ? ` + ${state.units}` : ""} = ${state.right}`;
  return `
    <div class="mn-cra">
      <div class="mn-col"><span class="mn-tag">Concrete · build it</span>
        <div class="mn-mat ${state.tipped ? "tipped" : ""}">${side(xs, state.split ? 0 : state.units)}<div class="mn-eq">=</div>${side(0, r)}</div>
      </div>
      <div class="mn-col"><span class="mn-tag">Representational · draw it</span>
        <div class="mn-sketch">${sketch(xs, state.split ? 0 : state.units)} <b>=</b> ${"•".repeat(r)}</div>
      </div>
      <div class="mn-col"><span class="mn-tag">Abstract · write it</span>
        <div class="mn-alg">${eq}</div>
      </div>
    </div>`;
}

const STEPS: LessonStep[] = [
  {
    title: "Zero pairs",
    say:
      "Welcome to the lab! I teach 6th grade science, and today I'm facilitating part of our ELD PD: Using Manipulatives to Support MLLs. Grab some counters: yellow is +1, red is −1. Let's solve −3 + 5. Tap a red counter to pair it with a yellow one. Each pair cancels out!",
    body: () => {
      const reds = 3 - state.pairs;
      const yellows = 5 - state.pairs;
      const counters =
        Array.from({ length: reds }, () => `<button type="button" class="mn-c red" data-pair>−1</button>`).join("") +
        Array.from({ length: yellows }, () => `<span class="mn-c yel">+1</span>`).join("");
      return `
      <div class="mn-tray">
        <div class="mn-counters">${counters}</div>
        <div class="mn-zeros">${Array.from({ length: state.pairs }, () => `<span class="mn-zp"><i class="red"></i><i class="yel"></i> = 0</span>`).join("")}</div>
      </div>
      ${
        state.pairs === 3
          ? `<div class="al-q"><b>What's left? So −3 + 5 = …</b>
              <div class="lo-btns">${["+2", "−2", "+8"].map((o, k) => `<button type="button" class="${state.left === k ? (k === 0 ? "right" : "wrong") : ""}" data-left="${k}">${o}</button>`).join("")}</div>
              ${state.left === 0 ? "" : state.left > 0 ? `<small class="no">Count the counters still on the tray.</small>` : ""}
            </div>`
          : ""
      }
      ${
        state.left === 0
          ? `<div class="lo-reveal"><p><b>+2!</b> Everyone looked at the <b>same objects</b>, and pointing at “this one” worked before the English did. Then the teacher attaches the term: <i>that's a <b>zero pair</b></i>. MLLs can <b>show before they tell</b>.</p></div>`
          : ""
      }`;
    },
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-pair]").forEach((b) =>
        b.addEventListener("click", () => {
          state.pairs = Math.min(3, state.pairs + 1);
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-left]").forEach((b) =>
        b.addEventListener("click", () => {
          state.left = Number(b.dataset.left);
          rerender();
        })
      );
    },
    ready: () => state.left === 0,
    need: "Cancel the zero pairs and answer",
  },
  {
    title: "The algebra tile workbench",
    say:
      "Now solve 2x + 3 = 7 with algebra tiles: the long tiles are x, the small squares are 1. Watch the drawing and the equation change with every move. That's CRA: concrete, representational, abstract. And say each move out loud!",
    body: () => `
      ${tileView()}
      <div class="mn-moves">
        <button type="button" data-move="both" ${state.units === 0 || state.split ? "disabled" : ""}>➖ Take 1 unit from <b>both</b> sides</button>
        <button type="button" data-move="left" ${state.units === 0 || state.split ? "disabled" : ""}>➖ Take 1 unit from the left side only</button>
        <button type="button" data-move="split" ${state.units !== 0 || state.split ? "disabled" : ""}>✂️ Split both sides into 2 equal groups</button>
      </div>
      <div class="mn-say ${state.tipped ? "warn" : ""}">${state.said || "🗣️ Make a move…"}</div>
      ${
        state.split
          ? `<p class="lo-tip">Frames by level · <b>E:</b> “I take away ___ from both sides.” · <b>X:</b> “I removed ___ units from both sides to keep it balanced.” · <b>B:</b> “To isolate the variable, I subtracted ___, then divided into ___ equal groups because the coefficient is ___.” Don't skip the drawing: it's the bridge students need most (Witzel et al., 2003).</p>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-move]").forEach((b) =>
        b.addEventListener("click", () => {
          const m = b.dataset.move;
          if (m === "left") {
            state.tipped = true;
            state.said = "⚖️ Unbalanced! Whatever you do to one side, you must do to the other. (Try the two-hands “scale” gesture with your students.)";
          } else if (m === "both") {
            state.tipped = false;
            state.units--;
            state.right--;
            state.said = `🗣️ “I removed 1 unit from both sides to keep the equation balanced.”${state.units === 0 ? " Now the x-tiles are alone." : ""}`;
          } else if (m === "split") {
            state.split = true;
            state.said = "🗣️ “I split both sides into 2 equal groups because the coefficient is 2. One x-tile equals 2 units: x = 2!”";
          }
          rerender();
        })
      );
    },
    ready: () => state.split,
    need: "Solve for x",
  },
  {
    title: "Stock the tool bin",
    say:
      "Manipulatives aren't just for math. In my science room we use rocks, cell models and bead atoms too. Tap a tool, then tap what it teaches.",
    body: () => `
      <div class="mn-bin">
        <div class="mn-list">
          ${TOOLS.map((t, i) => {
            const done = state.linked.has(i);
            return `<button type="button" class="mn-tool ${done ? "done" : state.pickTool === i ? "on" : ""} ${state.wrongLink === "t" + i ? "shake" : ""}" data-tool="${i}" ${done ? "disabled" : ""}><span>${t.icon}</span>${t.name}${done ? `<small>${esc(t.word)}</small>` : ""}</button>`;
          }).join("")}
        </div>
        <div class="mn-list">
          ${WHAT_ORDER.map((i) => {
            const done = [...state.linked.values()].includes(i);
            return `<button type="button" class="mn-what ${done ? "done" : ""} ${state.wrongLink === "w" + i ? "shake" : ""}" data-what="${i}" ${done ? "disabled" : ""}>${esc(TOOLS[i].what)}</button>`;
          }).join("")}
        </div>
      </div>
      ${state.linked.size === TOOLS.length ? `<p class="lo-tip">Label every bin <b>bilingually</b> with cognates (<i>cube / cubo, fraction / fracción, tile / teja</i>), and post each tool on the word wall with the vocabulary and a frame it teaches.</p>` : ""}`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) =>
        b.addEventListener("click", () => {
          state.pickTool = Number(b.dataset.tool);
          state.wrongLink = "";
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-what]").forEach((b) =>
        b.addEventListener("click", () => {
          const w = Number(b.dataset.what);
          if (state.pickTool < 0) return;
          if (state.pickTool === w) {
            state.linked.set(state.pickTool, w);
            state.wrongLink = "";
          } else state.wrongLink = "w" + w;
          state.pickTool = -1;
          rerender();
        })
      );
    },
    ready: () => state.linked.size === TOOLS.length,
    need: "Match all five tools",
  },
  {
    title: "Myth busters",
    say: "Let's check the research (a meta-analysis of 55 studies, 7,237 students). True or false?",
    body: () => `
      <div class="mn-myths">
        ${MYTHS.map((m, i) => {
          const pick = state.myths.get(i);
          const right = pick === m.a;
          return `<div class="lo-card wide ${pick !== undefined ? (right ? "good" : "bad") : ""}">
            <p>“${esc(m.t)}”</p>
            ${
              right
                ? `<small>❌ Myth! ${esc(m.why)}</small>`
                : `<div class="lo-btns"><button type="button" data-myth="${i}" data-v="1">True</button><button type="button" data-myth="${i}" data-v="0">False</button></div>
                   ${pick !== undefined ? `<small class="lo-try">Hmm, that's what many people think. Look again!</small>` : ""}`
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
    ready: () => MYTHS.every((m, i) => state.myths.get(i) === m.a),
    need: "Bust all three myths",
  },
  {
    title: "You're a Master Builder!",
    say:
      "Great building! A model a student built is real evidence of learning, even before they can explain it in English. Hands on the tools, words in their mouths!",
    body: () => `
      <div class="lo-badge"><span>🧱</span><div><b>Master Builder</b><small>Manipulatives for MLLs · ELD PD with Mr. Stauffer</small></div></div>
      <div class="go-route mn-route"><span>🧱 Show it</span>→<span>🗣️ Say it</span>→<span>✏️ Draw it</span>→<span>✍️ Write it</span></div>
      <ul class="lo-takeaways">
        <li><b>Concrete → drawing → symbols.</b> Don't skip the drawing, and connect every move to the equation.</li>
        <li><b>High guidance, plain tools.</b> Model it, guide it, release it.</li>
        <li><b>Pair every move with language:</b> partners narrate (Builder / Recorder), with frames and a word bank.</li>
        <li><b>Physical first, virtual for practice:</b> free tools like Polypad, Desmos and Didax have algebra tiles, counters and fraction bars.</li>
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
};
