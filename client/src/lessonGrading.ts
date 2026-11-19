/**
 * "Grading for Equity" — a short (2–3 minute) interactive part of today's ELD PD, facilitated by Mr. Ramirez in his
 * classroom (8th grade LMU history).
 *
 * Built from assets/Grading-for-Equity-Room-Blueprint.md (Feldman's Grading for Equity; Abedi on construct-irrelevant
 * language; Jung & Guskey on accommodations vs. modifications; the CA ELA/ELD Framework Ch. 8; Ed Code §49066),
 * boiled down to five quick stations: same learning / different grades (and the 3 pillars), the zero calculator,
 * grading through two lenses (content vs. language), accommodation or modification, and the takeaways. Finishing
 * the last station completes the assignment.
 */
import ramirezPortrait from "./assets/ramirez_portrait.png";
import { esc, rerender, type LessonDef, type LessonStep } from "./lessonEngine";

const fresh = () => ({
  leaks: new Set<number>(),
  zeroAdded: false,
  scale: "100" as "100" | "4",
  seen: new Set<string>(),
  content: -1,
  language: -1,
  am: new Map<number, "A" | "M">(),
});
let state = fresh();

// Station 1: two students, same history learning, different grades
const BEN = [90, 100, 90, 95, 90];
const ANA: Array<{ item: string; score: number; leak?: string }> = [
  { item: "Unit test", score: 90 },
  { item: "Participation", score: 60, leak: "She rarely speaks up in English yet, but she follows every discussion." },
  { item: "Essay", score: 75, leak: "−15 for spelling and grammar. Her history argument was just as strong as Ben's." },
  { item: "Homework", score: 0, leak: "Missing: no one at home to help with English directions, and she babysits after school." },
  { item: "Project", score: 70, leak: "−20 late penalty. The work itself earned a 90." },
];
const avg = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0) / a.length);
const letter = (n: number) => (n >= 90 ? "A" : n >= 80 ? "B" : n >= 70 ? "C" : n >= 60 ? "D" : "F");

const PILLARS = [
  { name: "Accurate", q: "Does the grade show only what the student knows and can do?" },
  { name: "Bias-resistant", q: "Could two students with the same learning get different grades?" },
  { name: "Motivational", q: "Does it make a struggling student want to try again?" },
];

// Station 4: accommodation or modification
const AM_CARDS: Array<{ t: string; a: "A" | "M"; why: string }> = [
  { t: "A bilingual glossary on the history test", a: "A", why: "Same 8th grade standard, different access. (The CAASPP offers translated glossaries too: practice with them!)" },
  { t: "Answering orally instead of in writing", a: "A", why: "Same standard: she still has to explain the history." },
  { t: "Grading her against a 5th grade standard instead of 8th", a: "M", why: "That changes WHAT she's expected to learn. Rarely right for MLLs, and it must be reported transparently." },
];

const CONTENT_SCORES = ["1 · Beginning", "2 · Developing", "3 · Proficient", "4 · Advanced"];
const LANGUAGE_MOVES = ["Take points off the history grade", "Give language feedback and note it on the language row"];

const STEPS: LessonStep[] = [
  {
    title: "Same learning, different grades",
    say:
      "Welcome! I teach 8th grade history, and today I'm facilitating part of our ELD PD: Grading for Equity. Meet Ana and Ben. They know the history equally well. Both earned a 90 on the unit test. So why do their grades look so different? Tap each of Ana's scores that leaked points for reasons that aren't history.",
    body: () => {
      const all = state.leaks.size === ANA.filter((r) => r.leak).length;
      return `
      <div class="ge-books">
        <div class="ge-book">
          <h3>Ben <small>fluent English speaker</small></h3>
          ${ANA.map((r, i) => `<div class="ge-row"><span>${r.item}</span><b>${BEN[i]}</b></div>`).join("")}
          <div class="ge-final">Final: <b>${avg(BEN)}% · ${letter(avg(BEN))}</b></div>
        </div>
        <div class="ge-book ana">
          <h3>Ana <small>multilingual learner, Expanding</small></h3>
          ${ANA.map((r, i) => {
            const open = state.leaks.has(i);
            return r.leak
              ? `<button type="button" class="ge-row leak ${open ? "open" : ""}" data-leak="${i}"><span>${r.item}</span><b>${r.score}</b>${open ? `<em>${esc(r.leak)}</em>` : `<i>tap</i>`}</button>`
              : `<div class="ge-row"><span>${r.item}</span><b>${r.score}</b></div>`;
          }).join("")}
          <div class="ge-final bad">Final: <b>${avg(ANA.map((r) => r.score))}% · ${letter(avg(ANA.map((r) => r.score)))}</b></div>
        </div>
      </div>
      ${
        all
          ? `<div class="lo-reveal"><p><b>Ana's grade measured her English, her home resources and her timing, not her history.</b> An equitable grade is:</p>
              <div class="ge-pillars">${PILLARS.map((p) => `<div><b>${p.name}</b><span>${esc(p.q)}</span></div>`).join("")}</div>
            </div>`
          : ""
      }`;
    },
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-leak]").forEach((b) =>
        b.addEventListener("click", () => {
          state.leaks.add(Number(b.dataset.leak));
          rerender();
        })
      );
    },
    ready: () => state.leaks.size === ANA.filter((r) => r.leak).length,
    need: "Find all four leaks",
  },
  {
    title: "The Zero Calculator",
    say:
      "Let's look at that homework zero. Here's a solid B student: four 85s. Add ONE missing assignment and watch what a zero does. Then switch to a 0–4 scale and compare.",
    body: () => {
      const s100 = [85, 85, 85, 85, ...(state.zeroAdded ? [0] : [])];
      const s4 = [3, 3, 3, 3, ...(state.zeroAdded ? [0] : [])];
      const on4 = state.scale === "4";
      const scores = on4 ? s4 : s100;
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const grade = on4 ? (mean >= 3.5 ? "A" : mean >= 2.5 ? "B" : mean >= 1.5 ? "C" : mean >= 0.5 ? "D" : "F") : letter(Math.round(mean));
      return `
      <div class="ge-scales">
        <button type="button" class="${on4 ? "" : "on"}" data-scale="100">0–100 scale</button>
        <button type="button" class="${on4 ? "on" : ""}" data-scale="4">0–4 scale</button>
      </div>
      <div class="ge-calc">
        <div class="ge-scores">${scores.map((v, i) => `<span class="${i === 4 ? "zero" : ""}">${v}</span>`).join("")}</div>
        <div class="ge-avg ${state.zeroAdded ? "hit" : ""}">Average: <b>${on4 ? mean.toFixed(1) : Math.round(mean)}</b> → <b>${grade}</b></div>
        ${state.zeroAdded ? "" : `<button type="button" class="ge-zero" data-zero>➕ Add one missing assignment (0)</button>`}
      </div>
      ${
        state.zeroAdded && state.seen.has("100") && state.seen.has("4")
          ? `<div class="lo-reveal"><p><b>On a 0–100 scale, a zero is a "super F": 60 points below passing.</b> One missing assignment drags a B student to a D. On a 0–4 scale the same zero leaves her at a C: it still counts, but it doesn't bury her.</p>
              <p>That's not <b>accurate</b>, and it isn't <b>motivational</b>: the hole is too deep to climb out of. Try a 0–4 scale, a minimum score, or "Incomplete" and gather the evidence another way. And let the new score from a redo <b>replace</b> the old one.</p></div>`
          : ""
      }`;
    },
    wire: (root) => {
      root.querySelector("[data-zero]")?.addEventListener("click", () => {
        state.zeroAdded = true;
        state.seen.add(state.scale);
        rerender();
      });
      root.querySelectorAll<HTMLElement>("[data-scale]").forEach((b) =>
        b.addEventListener("click", () => {
          state.scale = b.dataset.scale as "100" | "4";
          if (state.zeroAdded) state.seen.add(state.scale);
          rerender();
        })
      );
    },
    ready: () => state.zeroAdded && state.seen.has("100") && state.seen.has("4"),
    need: "Add the zero and try both scales",
  },
  {
    title: "Grade through two lenses",
    say:
      "Here's the big idea: is this assessment measuring the history, or measuring the student's English? Grade the content, coach the language, on two separate rows. Score Ana's answer.",
    body: () => `
      <div class="ge-work">
        <div class="ge-q">Q: Why did the colonists protest the Stamp Act?</div>
        <div class="ge-a">“The tax maked the colonists angry becaus they had no vote in parlament. They said no taxation without representation.”</div>
      </div>
      <div class="ge-lens">
        <div><b>🔍 Content lens:</b> how well does she understand the history?</div>
        <div class="lo-btns">${CONTENT_SCORES.map((t, k) => `<button type="button" class="${state.content === k ? (k >= 2 ? "right" : "wrong") : ""}" data-content="${k}">${t}</button>`).join("")}</div>
        ${
          state.content < 0
            ? ""
            : state.content >= 2
              ? `<small class="ok">✓ Yes! The cause and the principle are both right. That's proficient history.</small>`
              : `<small class="no">Look past the spelling: is the history right? If so, a low score here is grading her English.</small>`
        }
      </div>
      <div class="ge-lens">
        <div><b>🗣️ Language lens:</b> what do you do about “maked,” “becaus” and “parlament”?</div>
        <div class="lo-btns">${LANGUAGE_MOVES.map((t, k) => `<button type="button" class="${state.language === k ? (k === 1 ? "right" : "wrong") : ""}" data-language="${k}">${t}</button>`).join("")}</div>
        ${
          state.language < 0
            ? ""
            : state.language === 1
              ? `<small class="ok">✓ Exactly. Track language growth against the ELD standards, separately from the history grade.</small>`
              : `<small class="no">That lowers a history grade for a language reason. Try the other move.</small>`
        }
      </div>
      <p class="lo-tip">Same goes for test items: cut idioms, long sentences and passive voice that aren't part of what you're testing. Linguistically simplified math items raised MLLs' scores while the math stayed the same (Abedi &amp; Lord, 2001).</p>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-content]").forEach((b) =>
        b.addEventListener("click", () => {
          state.content = Number(b.dataset.content);
          rerender();
        })
      );
      root.querySelectorAll<HTMLElement>("[data-language]").forEach((b) =>
        b.addEventListener("click", () => {
          state.language = Number(b.dataset.language);
          rerender();
        })
      );
    },
    ready: () => state.content >= 2 && state.language === 1,
    need: "Score both lenses",
  },
  {
    title: "Accommodate, don't modify",
    say:
      "An accommodation changes HOW a student shows what they know. A modification changes WHAT they're expected to learn. For most MLLs we want accommodations: same grade-level standard, different access. Which is which?",
    body: () => `
      <div class="lo-sort three">
        ${AM_CARDS.map((c, i) => {
          const pick = state.am.get(i);
          const right = pick === c.a;
          return `<div class="lo-card ${pick ? (right ? "good" : "bad") : ""}">
            <p>${esc(c.t)}</p>
            ${
              pick && right
                ? `<small>${c.a === "A" ? "Accommodation" : "Modification"} ✓ ${esc(c.why)}</small>`
                : `<div class="lo-btns"><button type="button" data-am="${i}" data-v="A">Accommodation</button><button type="button" data-am="${i}" data-v="M">Modification</button></div>
                   ${pick ? `<small class="lo-try">Does it change HOW, or WHAT?</small>` : ""}`
            }
          </div>`;
        }).join("")}
      </div>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-am]").forEach((b) =>
        b.addEventListener("click", () => {
          state.am.set(Number(b.dataset.am), b.dataset.v as "A" | "M");
          rerender();
        })
      );
    },
    ready: () => AM_CARDS.every((c, i) => state.am.get(i) === c.a),
    need: "Sort all three",
  },
  {
    title: "You're an Equity Grader!",
    say:
      "Great work! Remember: in California, the teacher determines the grade (Ed Code §49066). That's real power, so let's make every grade an accurate picture of learning.",
    body: () => `
      <div class="lo-badge"><span>⚖️</span><div><b>Equity Grader</b><small>Grading for Equity · ELD PD with Mr. Ramirez</small></div></div>
      <ul class="lo-takeaways">
        <li><b>Grades = learning.</b> No zeros, no behavior points, no extra credit.</li>
        <li><b>Grade the content, coach the language.</b> Two rows on the rubric.</li>
        <li><b>Accommodate, don't modify.</b> Same standard, different access.</li>
        <li><b>Let them try again.</b> The new evidence replaces the old.</li>
        <li><b>Primary language counts</b> as evidence of content knowledge.</li>
      </ul>`,
  },
];

export const GRADING_LESSON: LessonDef = {
  roomId: "8th-lmu-humanities",
  title: "Grading for Equity",
  kicker: "ELD PD · facilitated by Mr. Ramirez",
  teacher: "Mr. Ramirez",
  portrait: ramirezPortrait,
  steps: STEPS,
  reset: () => {
    state = fresh();
  },
};
