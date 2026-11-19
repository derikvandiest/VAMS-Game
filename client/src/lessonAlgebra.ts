/**
 * "Supporting MLLs in Math: Algebra" — a short (2–3 minute) interactive part of today's ELD PD, facilitated by
 * Mr. Kurisu in his classroom (8th grade UCLA math).
 *
 * Built from assets/Supporting-MLLs-in-Algebra-Room-Blueprint.md (CA Mathematics Framework 2023; Stanford's Math
 * Language Routines, which Illustrative Mathematics builds in; Moschkovich; the reversal-error research; the "rules
 * that expire"; the CA Math Placement Act), boiled down to five quick stations: algebra is a language (the data and
 * multiple-meaning words), word order and the reversal error, ditching key words for Three Reads, connecting
 * representations, and the takeaways with the MLR toolbox. Finishing the last station completes the assignment.
 */
import kurisuPortrait from "./assets/kurisu_portrait.png";
import { esc, rerender, type LessonDef, type LessonStep } from "./lessonEngine";

const fresh = () => ({
  guess: -1,
  flips: new Set<number>(),
  wordOrder: -1,
  reversal: -1,
  keyword: -1,
  reads: 0,
  zoo: -1,
  found: new Set<string>(),
  miss: "",
});
let state = fresh();

const GUESSES = ["About 10%", "About 25%", "About 40%"];

const WORDS = [
  { w: "term", every: "a school semester", math: "a part of an expression separated by + or −" },
  { w: "power", every: "strength, electricity", math: "an exponent: repeated multiplication" },
  { w: "root", every: "the part of a plant", math: "a solution of an equation" },
  { w: "table", every: "furniture", math: "an organized display of x- and y-values" },
];

const ZOO = ["C = 3p − 5", "C = 5p − 3", "C = 3 − 5p"];
const READS = [
  { n: "Read 1", q: "What is the situation?", a: "A family is going to the zoo with a coupon. (No numbers yet!)" },
  { n: "Read 2", q: "What are the quantities?", a: "$3 per person · $5 off · p people · C = the total cost" },
  { n: "Read 3", q: "How could we solve it?", a: "cost = ($ per person × number of people) − discount" },
];

const STEPS: LessonStep[] = [
  {
    title: "Algebra is a language",
    say:
      "Hey, welcome in! I teach 8th grade math, and today I'm facilitating part of our ELD PD: Supporting MLLs in Algebra. First, a guess: what share of California's English learners met the standard on the CAASPP math test in 2022?",
    body: () => `
      <div class="lo-chips three">
        ${GUESSES.map((g, i) => `<button type="button" class="lo-chip ${state.guess === i ? (i === 0 ? "good" : "bad") : state.guess >= 0 && i === 0 ? "good" : ""}" data-guess="${i}" ${state.guess >= 0 ? "disabled" : ""}>${g}</button>`).join("")}
      </div>
      ${
        state.guess >= 0
          ? `<div class="lo-reveal"><p><b>Just 10%.</b> For secondary ELs, research and reporting point to <b>language, more than computation,</b> as the main barrier. Algebra asks them to work in three languages at once: everyday English, academic math English, and symbols. Start with the words. Tap each card to see its algebra meaning:</p></div>
             <div class="al-words">
               ${WORDS.map((w, i) => {
                 const open = state.flips.has(i);
                 return `<button type="button" class="al-word ${open ? "open" : ""}" data-flip="${i}"><b>${w.w}</b>
                   ${open ? `<span class="ev">Everyday: ${esc(w.every)}</span><span class="ma">Algebra: ${esc(w.math)}</span>` : `<span class="ev">Everyday: ${esc(w.every)}</span><span class="tap">tap for the algebra meaning</span>`}
                 </button>`;
               }).join("")}
             </div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-guess]").forEach((b) =>
        b.addEventListener("click", () => {
          state.guess = Number(b.dataset.guess);
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-flip]").forEach((b) =>
        b.addEventListener("click", () => {
          state.flips.add(Number(b.dataset.flip));
          rerender();
        })
      );
    },
    ready: () => state.guess >= 0 && state.flips.size === WORDS.length,
    need: "Guess, then flip all four words",
  },
  {
    title: "Word order traps",
    say:
      "English word order doesn't always match symbol order, and that trips up MLLs (and plenty of fluent speakers!). Translate these two into algebra.",
    body: () => `
      <div class="al-q"><b>1.</b> “5 less than x”
        <div class="lo-btns">${["5 − x", "x − 5"].map((o, k) => `<button type="button" class="${state.wordOrder === k ? (k === 1 ? "right" : "wrong") : ""}" data-wo="${k}">${o}</button>`).join("")}</div>
        ${state.wordOrder === 1 ? `<small class="ok">✓ Right! The English says “5” first, but the 5 comes off the end.</small>` : state.wordOrder === 0 ? `<small class="no">That copies the English order. Five LESS than x…</small>` : ""}
      </div>
      <div class="al-q"><b>2.</b> “There are 6 times as many <u>students</u> as <u>professors</u>.”
        <div class="lo-btns">${["6S = P", "S = 6P"].map((o, k) => `<button type="button" class="${state.reversal === k ? (k === 1 ? "right" : "wrong") : ""}" data-rev="${k}">${o}</button>`).join("")}</div>
        ${
          state.reversal === 1
            ? `<small class="ok">✓ Yes! Test it: with 10 professors, S = 6 × 10 = 60 students.</small>`
            : state.reversal === 0
              ? `<small class="no">That's the famous <b>reversal error</b>: even college students make it! Test it with numbers: 10 professors means how many students?</small>`
              : ""
        }
      </div>
      ${
        state.wordOrder === 1 && state.reversal === 1
          ? `<p class="lo-tip"><b>Classroom fixes:</b> define variables as quantities (“Let s = the <b>number</b> of students”), test equations with real numbers, sketch a table or tape diagram first, and use neutral letters like x and y.</p>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-wo]").forEach((b) =>
        b.addEventListener("click", () => {
          state.wordOrder = Number(b.dataset.wo);
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-rev]").forEach((b) =>
        b.addEventListener("click", () => {
          state.reversal = Number(b.dataset.rev);
          rerender();
        })
      );
    },
    ready: () => state.wordOrder === 1 && state.reversal === 1,
    need: "Translate both",
  },
  {
    title: "Ditch the key words. Try Three Reads",
    say:
      "Lots of us were taught “more means add.” Watch what happens. Then let's try Three Reads, one of Stanford's Math Language Routines, built right into our Illustrative Math lessons.",
    body: () => `
      <div class="al-q"><b>Maria has 12 apples. She has 4 <u>more</u> than Juan. How many does Juan have?</b>
        <div class="lo-btns">${["16 (“more” means add)", "8"].map((o, k) => `<button type="button" class="${state.keyword === k ? (k === 1 ? "right" : "wrong") : ""}" data-kw="${k}">${o}</button>`).join("")}</div>
        ${state.keyword === 1 ? `<small class="ok">✓ Juan has 4 fewer: 12 − 4 = 8. The key word pointed the wrong way. Key words skip sense-making, which is exactly what MLLs need most.</small>` : state.keyword === 0 ? `<small class="no">The key word tricked you! Who has more, Maria or Juan?</small>` : ""}
      </div>
      ${
        state.keyword === 1
          ? `<div class="al-zoo">
              <p class="al-prob">“It costs $3 per person to go to the zoo. Alexandra's family has a coupon for a $5 discount. There are p people in the family. Write an expression for the cost C.”</p>
              <div class="al-reads">
                ${READS.map((r, i) =>
                  i < state.reads
                    ? `<div class="al-read open"><b>${r.n}: ${r.q}</b><span>${esc(r.a)}</span></div>`
                    : i === state.reads
                      ? `<button type="button" class="al-read" data-read><b>${r.n}</b><span>${r.q}</span></button>`
                      : `<div class="al-read locked"><b>${r.n}</b></div>`
                ).join("")}
              </div>
              ${
                state.reads === 3
                  ? `<div class="lo-btns al-eq">${ZOO.map((o, k) => `<button type="button" class="${state.zoo === k ? (k === 0 ? "right" : "wrong") : ""}" data-zoo="${k}">${o}</button>`).join("")}</div>
                     ${state.zoo === 0 ? `<small class="ok">✓ C = 3p − 5. The structure came from the words before the symbols, so no reversal error!</small>` : state.zoo > 0 ? `<small class="no">Look back at Read 2: what is per person?</small>` : ""}`
                  : ""
              }
            </div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-kw]").forEach((b) =>
        b.addEventListener("click", () => {
          state.keyword = Number(b.dataset.kw);
          rerender();
        })
      );
      root.querySelector("[data-read]")?.addEventListener("click", () => {
        state.reads = Math.min(3, state.reads + 1);
        rerender();
      });
      root.querySelectorAll<HTMLElement>("[data-zoo]").forEach((b) =>
        b.addEventListener("click", () => {
          state.zoo = Number(b.dataset.zoo);
          rerender();
        })
      );
    },
    ready: () => state.keyword === 1 && state.zoo === 0,
    need: "Solve both problems",
  },
  {
    title: "Amplify, don't simplify",
    say:
      "Tables, graphs and equations lower the language load without lowering the math. A phone plan costs $20 a month plus $0.10 per text. Compare and connect: find the $20 in each representation!",
    body: () => {
      const f = (k: string) => (state.found.has(k) ? "hit" : "");
      const miss = (k: string) => (state.miss === k ? "miss" : "");
      return `
      <div class="al-reps">
        <div class="al-rep"><span class="al-rep-name">Table</span>
          <table><tr><th>texts (x)</th><th>cost (y)</th></tr>
            <tr><td><button type="button" data-spot="t-x" class="${miss("t-x")}">0</button></td><td><button type="button" data-spot="t" class="${f("t")}">20</button></td></tr>
            <tr><td>10</td><td><button type="button" data-spot="t-21" class="${miss("t-21")}">21</button></td></tr>
            <tr><td>20</td><td>22</td></tr></table>
        </div>
        <div class="al-rep"><span class="al-rep-name">Graph</span>
          <svg viewBox="0 0 160 120" class="al-graph">
            <line x1="20" y1="100" x2="150" y2="100" stroke="#94a3b8"/><line x1="20" y1="100" x2="20" y2="10" stroke="#94a3b8"/>
            <line x1="20" y1="60" x2="150" y2="30" stroke="#1d4ed8" stroke-width="3"/>
            <text x="4" y="64" font-size="9" fill="#475569">20</text>
            <circle data-spot="g-end" class="spot ${miss("g-end")}" cx="150" cy="30" r="7"/>
            <circle data-spot="g" class="spot ${f("g")}" cx="20" cy="60" r="7"/>
          </svg>
        </div>
        <div class="al-rep"><span class="al-rep-name">Equation</span>
          <div class="al-eqn">y = <button type="button" data-spot="e-m" class="${miss("e-m")}">0.10</button>x + <button type="button" data-spot="e" class="${f("e")}">20</button></div>
        </div>
      </div>
      ${
        state.found.size === 3
          ? `<div class="lo-reveal"><p><b>Every representation is a way in.</b> Ask “Where is the 20 in the table, the graph and the equation? What does it <i>mean</i>?” (the starting cost: the y-intercept). Then connect it to the words. Post them on the word wall with cognates: <i>ecuación, función, variable</i>, plus the non-cognates to teach directly (slope = <i>pendiente</i>).</p></div>`
          : ""
      }`;
    },
    wire: (root) => {
      root.querySelectorAll<Element>("[data-spot]").forEach((b) =>
        b.addEventListener("click", () => {
          const k = (b as HTMLElement).dataset.spot!;
          if (k === "t" || k === "g" || k === "e") {
            state.found.add(k);
            state.miss = "";
          } else state.miss = k;
          rerender();
        })
      );
    },
    ready: () => state.found.size === 3,
    need: "Find the $20 three times",
  },
  {
    title: "You're an Algebra Language Champion!",
    say:
      "Awesome! MLLs don't need to master English before doing rigorous algebra. They learn the language through meaningful math talk. Listen for their math ideas, not their grammar.",
    body: () => `
      <div class="lo-badge"><span>🧮</span><div><b>Algebra Language Champion</b><small>Supporting MLLs in Math · ELD PD with Mr. Kurisu</small></div></div>
      <ul class="lo-takeaways">
        <li><b>Algebra is a language.</b> Teach the words, the word order and the symbols explicitly.</li>
        <li><b>Three Reads, no key-word tricks.</b> Make sense of the situation first.</li>
        <li><b>Variables are numbers of things.</b> Test equations with real numbers.</li>
        <li><b>Connect representations</b> and talk every day, with frames.</li>
        <li><b>Home language, gestures and drawings are math thinking.</b> And English proficiency is never a reason to deny Algebra access (CA Math Placement Act).</li>
      </ul>
      <div class="al-mlr"><b>🧰 Your MLR toolbox</b> <i>(look for the “MLR” notes in Illustrative Math)</i>
        <div>${[
          "1 · Stronger & Clearer Each Time",
          "2 · Collect & Display",
          "3 · Critique, Correct & Clarify",
          "4 · Information Gap",
          "5 · Co-Craft Questions",
          "6 · Three Reads",
          "7 · Compare & Connect",
          "8 · Discussion Supports",
        ]
          .map((m) => `<span>${m}</span>`)
          .join("")}</div>
      </div>`,
  },
];

export const ALGEBRA_LESSON: LessonDef = {
  roomId: "8th-ucla-math",
  title: "Supporting MLLs in Math: Algebra",
  kicker: "ELD PD · facilitated by Mr. Kurisu",
  teacher: "Mr. Kurisu",
  portrait: kurisuPortrait,
  steps: STEPS,
  reset: () => {
    state = fresh();
  },
};
