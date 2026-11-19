/**
 * "Graphic Organizers for MLLs" — a short (2–3 minute) interactive part of today's ELD PD, facilitated by Ms. Blessing
 * in her classroom (5th grade CSUN humanities).
 *
 * Built from assets/Graphic-Organizers-for-MLLs-Room-Blueprint.md (IES/WWC 2014 Rec. 2; Dexter & Hughes 2011; the CA
 * ELD Standards' strand 10b, planned scaffolding and Proficiency Level Descriptors), boiled down to five quick
 * stations: the messy desk (paragraph vs. organizer), function first (match the organizer), signal words, upgrading a
 * plain organizer to a language-rich one, and the takeaways (organizer → talk → write). Finishing the last station
 * completes the assignment.
 */
import blessingPortrait from "./assets/blessing_portrait.png";
import { esc, rerender, type LessonDef, type LessonStep } from "./lessonEngine";

const state = {
  organized: false,
  both: -1,
  match: new Map<number, number>(),
  signals: new Map<number, number>(),
  upgrades: new Set<number>(),
};

const BOTH_OPTS = ["Chinampas (floating farms)", "Pyramids and calendars", "A writing system with glyphs"];

const ORGANIZERS = ["Venn / Double Bubble", "Flow Chart", "Cause & Effect", "Claim-Evidence-Reasoning"];
const TASKS: Array<{ t: string; a: number; frame: string }> = [
  { t: "Explain the steps of the water cycle", a: 1, frame: "“After ___, ___ happens.”" },
  { t: "Compare the Aztec and the Maya", a: 0, frame: "“Both ___ and ___, but ___.”" },
  { t: "Argue whether school should start later", a: 3, frame: "“I claim ___. The text states ___. This shows ___.”" },
  { t: "Explain why the colonists rebelled", a: 2, frame: "“___ led to ___ because ___.”" },
];

const STRUCTURES = ["Compare", "Sequence", "Cause & effect"];
const SIGNALS: Array<{ w: string; a: number }> = [
  { w: "whereas", a: 0 },
  { w: "finally", a: 1 },
  { w: "as a result", a: 2 },
  { w: "both", a: 0 },
  { w: "next", a: 1 },
  { w: "because", a: 2 },
];

const UPGRADES = [
  { icon: "🏷️", name: "Signal words", show: "both · also · however · whereas · unlike" },
  { icon: "🖼️", name: "Word bank + cognates", show: "pyramid (pirámide) · calendar (calendario) · empire (imperio)" },
  { icon: "💬", name: "Sentence frames by level", show: "E: “Both ___ had ___.” · X: “Both ___, but the Aztec ___, while the Maya ___.”" },
  { icon: "✏️", name: "Room for drawings + L1", show: "Students can sketch or jot in their home language first" },
];

const STEPS: LessonStep[] = [
  {
    title: "The messy desk",
    say:
      "Welcome to my classroom! I teach 5th grade humanities, and today I'm facilitating part of our ELD PD: Graphic Organizers for MLLs. Try this: read the paragraph and find one thing the Aztec and Maya BOTH had. Now imagine reading it in a language you're still learning…",
    body: () => `
      ${
        state.organized
          ? `<div class="go-venn">
              <div class="go-circle l"><b>Aztec only</b><span>capital: Tenochtitlan</span><span>one empire</span><span>chinampas (floating farms)</span></div>
              <div class="go-mid"><b>Both</b><span>Mesoamerica</span><span>pyramids</span><span>calendars</span><span>farmed maize</span></div>
              <div class="go-circle r"><b>Maya only</b><span>city-states</span><span>writing with glyphs</span><span>advanced astronomy</span></div>
            </div>`
          : `<div class="go-dense">The Aztec, whose empire was centered in its capital of Tenochtitlan, developed chinampas, or floating farms, while the Maya, who never unified under a single capital but instead lived in independent city-states, created a writing system using glyphs and advanced the study of astronomy, although both civilizations, located in Mesoamerica, built pyramids, kept calendars, farmed maize and worshipped many gods.</div>
             <button type="button" class="go-organize" data-organize>🗺️ Show it as a graphic organizer</button>`
      }
      <div class="al-q"><b>What did the Aztec and Maya BOTH have?</b>
        <div class="lo-btns">${BOTH_OPTS.map((o, k) => `<button type="button" class="${state.both === k ? (k === 1 ? "right" : "wrong") : ""}" data-both="${k}">${o}</button>`).join("")}</div>
        ${state.both === 1 ? `<small class="ok">✓ Yes!</small>` : state.both >= 0 ? `<small class="no">That was only one of them. ${state.organized ? "Look in the middle." : "Try the organizer!"}</small>` : ""}
      </div>
      ${
        state.organized && state.both === 1
          ? `<div class="lo-reveal"><p><b>Same information, much lighter language load.</b> A graphic organizer makes the <i>relationships</i> between ideas visible, so MLLs can show their thinking with words, phrases, drawings or their home language before writing full English sentences. It's a <b>thinking tool and a language tool</b>.</p></div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelector("[data-organize]")?.addEventListener("click", () => {
        state.organized = true;
        rerender();
      });
      root.querySelectorAll<HTMLElement>("[data-both]").forEach((b) =>
        b.addEventListener("click", () => {
          state.both = Number(b.dataset.both);
          rerender();
        })
      );
    },
    ready: () => state.organized && state.both === 1,
    need: "Open the organizer and answer",
  },
  {
    title: "Function first",
    say:
      "Pick the organizer by what students are DOING with language: that's the language function from our Learning Objectives work. Match each task to its organizer.",
    body: () => `
      <div class="go-match">
        ${TASKS.map((tk, i) => {
          const pick = state.match.get(i);
          const right = pick === tk.a;
          return `<div class="lo-card ${pick !== undefined ? (right ? "good" : "bad") : ""}">
            <p>${esc(tk.t)}</p>
            ${
              right
                ? `<small>${ORGANIZERS[tk.a]} ✓ Frame: ${esc(tk.frame)}</small>`
                : `<div class="lo-btns">${ORGANIZERS.map((o, k) => `<button type="button" data-match="${i}" data-v="${k}">${o}</button>`).join("")}</div>
                   ${pick !== undefined ? `<small class="lo-try">What is the student doing: comparing, sequencing, explaining causes, or arguing?</small>` : ""}`
            }
          </div>`;
        }).join("")}
      </div>`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-match]").forEach((b) =>
        b.addEventListener("click", () => {
          state.match.set(Number(b.dataset.match), Number(b.dataset.v));
          rerender();
        })
      );
    },
    ready: () => TASKS.every((tk, i) => state.match.get(i) === tk.a),
    need: "Match all four",
  },
  {
    title: "Signal words",
    say:
      "Every text structure has its own signal words. Put them right on the organizer and MLLs learn how English connects ideas. Which structure does each word signal?",
    body: () => `
      <div class="go-signals">
        ${SIGNALS.map((s, i) => {
          const pick = state.signals.get(i);
          const right = pick === s.a;
          return `<div class="go-signal ${pick !== undefined ? (right ? "good" : "bad") : ""}">
            <b>${s.w}</b>
            ${
              right
                ? `<small>${STRUCTURES[s.a]} ✓</small>`
                : `<div class="lo-btns">${STRUCTURES.map((o, k) => `<button type="button" data-sig="${i}" data-v="${k}">${o}</button>`).join("")}</div>`
            }
          </div>`;
        }).join("")}
      </div>
      ${
        SIGNALS.every((s, i) => state.signals.get(i) === s.a)
          ? `<p class="lo-tip">This is the CA ELD Standards' Part II, “Learning About How English Works”: structuring cohesive texts and connecting ideas with words like <i>because, although, as a result</i>.</p>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-sig]").forEach((b) =>
        b.addEventListener("click", () => {
          state.signals.set(Number(b.dataset.sig), Number(b.dataset.v));
          rerender();
        })
      );
    },
    ready: () => SIGNALS.every((s, i) => state.signals.get(i) === s.a),
    need: "Sort all six words",
  },
  {
    title: "Upgrade it: build the language in",
    say:
      "A blank Venn diagram is a thinking tool. Let's make it a LANGUAGE tool too. Tap each upgrade to add it.",
    body: () => `
      <div class="go-upgrade">
        <div class="go-plain">
          <div class="go-venn mini"><div class="go-circle l"><b>Aztec</b></div><div class="go-mid"><b>Both</b></div><div class="go-circle r"><b>Maya</b></div></div>
          ${UPGRADES.filter((_, i) => state.upgrades.has(i))
            .map((u) => `<div class="go-added"><span>${u.icon}</span><div><b>${u.name}</b><small>${esc(u.show)}</small></div></div>`)
            .join("")}
        </div>
        <div class="go-tools">
          ${UPGRADES.map((u, i) => `<button type="button" class="go-tool ${state.upgrades.has(i) ? "on" : ""}" data-up="${i}" ${state.upgrades.has(i) ? "disabled" : ""}>${u.icon} ${u.name}</button>`).join("")}
        </div>
      </div>
      ${
        state.upgrades.size === UPGRADES.length
          ? `<div class="lo-reveal"><p><b>Now fade it as students grow:</b> Emerging gets a mostly completed organizer with pictures, a word bank and frames in every box. Expanding gets a partially completed one. Bridging gets a blank one, or chooses their own. Model it first: I do → we do → you do.</p></div>`
          : ""
      }`,
    wire: (root) => {
      root.querySelectorAll<HTMLElement>("[data-up]").forEach((b) =>
        b.addEventListener("click", () => {
          state.upgrades.add(Number(b.dataset.up));
          rerender();
        })
      );
    },
    ready: () => state.upgrades.size === UPGRADES.length,
    need: "Add all four upgrades",
  },
  {
    title: "You're a Master Mapmaker!",
    say:
      "Wonderful! Remember, the organizer isn't the final product. It's the bridge from thinking to talking to writing. And please don't grade the neatness or spelling: it's evidence of thinking.",
    body: () => `
      <div class="lo-badge"><span>🗺️</span><div><b>Master Mapmaker</b><small>Graphic Organizers for MLLs · ELD PD with Ms. Blessing</small></div></div>
      <div class="go-route"><span>📖 Read</span>→<span>🗺️ Organize</span>→<span>🗣️ Talk it through with frames</span>→<span>✍️ Write</span></div>
      <ul class="lo-takeaways">
        <li><b>Function first:</b> pick the organizer that matches what students do with language.</li>
        <li><b>Build the language in:</b> signal words, a word bank with cognates, and frames on every organizer.</li>
        <li><b>Model, then fade</b> by proficiency level until students create their own.</li>
        <li><b>A small, consistent set</b> across classes, so students recognize the shapes.</li>
        <li><b>Welcome drawings, cognates and L1.</b> At the Emerging level, the CA ELD Standards expect students to express ideas with visuals like graphic organizers.</li>
      </ul>
      <p class="lo-tip">The research: the What Works Clearinghouse recommends visuals and graphic organizers to anchor instruction for English learners (part of a strong-evidence recommendation), and a meta-analysis found moderate to large gains for students with learning disabilities (Dexter &amp; Hughes, 2011). They work best when taught explicitly and paired with talk and writing.</p>`,
  },
];

export const ORGANIZERS_LESSON: LessonDef = {
  roomId: "5th-csun-humanities",
  title: "Graphic Organizers for MLLs",
  kicker: "ELD PD · facilitated by Ms. Blessing",
  teacher: "Ms. Blessing",
  portrait: blessingPortrait,
  steps: STEPS,
};
