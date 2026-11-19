/**
 * The Community Schools handout Mr. Martinez (Community Schools Manager) gives out at his table by the MPR:
 * "Partners in Learning: leveraging families and the community to support multilingual learners (MLLs)".
 * Clicking the item in the backpack opens it; it can be printed / saved as a PDF.
 *
 * Content is drawn from research and guidance listed at the end of the handout (Henderson & Mapp 2002; Mapp & Kuttner
 * 2013; González, Moll & Amanti 2005; Sheldon & Jung 2018; Colorín Colorado; WIDA; the California EL Roadmap and
 * Community Schools Framework; California Education Code). Keep the claims as careful as the sources: most family
 * engagement research shows strong associations, not controlled experiments.
 */

import { IEP_HANDOUT_HTML } from "./handoutIep";

let overlay: HTMLElement | null = null;

export function isHandoutOpen(): boolean {
  return !!overlay;
}

export function closeHandout(): void {
  if (!overlay) return;
  window.removeEventListener("keydown", onKey, true);
  overlay.remove();
  overlay = null;
}

function onKey(e: KeyboardEvent): void {
  if (!overlay) return;
  e.stopImmediatePropagation(); // the handout has the keyboard while it is open
  if (e.key === "Escape") {
    e.preventDefault();
    closeHandout();
  }
}

/** The handout itself (also used for printing) */
const HANDOUT_HTML = `
<header class="ho-head">
  <div class="ho-kicker">Valor Academy · Community Schools</div>
  <h1>Partners in Learning</h1>
  <p class="ho-sub">How schools can leverage families and the community to help multilingual learners (MLLs) thrive</p>
  <p class="ho-from">From Mr. Martinez, Community Schools Manager</p>
</header>

<section>
  <h2>Why it matters</h2>
  <div class="ho-stats">
    <div class="ho-stat"><b>51 studies</b><span>A major research synthesis found a consistent, positive link between family engagement and student success, across race, income, and parents' education. Engagement tied to <i>learning</i> mattered most.</span><cite>Henderson &amp; Mapp, 2002</cite></div>
    <div class="ho-stat"><b>21% less</b><span>In a study of ~100,000 K–8 students in four districts, students whose families got a relational home visit were 21% less likely to be chronically absent, and more likely to score proficient in ELA.</span><cite>Sheldon &amp; Jung, 2018 (correlational)</cite></div>
    <div class="ho-stat"><b>62.7% vs 39.4%</b><span>Newcomer graduation rate at Oakland International High School, a community school for recently arrived immigrants, compared with newcomers district-wide.</span><cite>PACE policy brief, 2023</cite></div>
  </div>
  <p class="ho-note">Most family engagement research shows strong <i>associations</i> rather than controlled experiments, but the pattern is consistent: when schools and families work as partners, MLLs attend more, feel they belong, and learn more.</p>
</section>

<section>
  <h2>Start with the right mindset</h2>
  <div class="ho-two">
    <div class="ho-card">
      <h3>Families are assets: "funds of knowledge"</h3>
      <p>Every household holds knowledge and skills built through work, culture, and daily life: cooking, building, caring, trading, faith, stories, and more than one language. Learn about them and bring them into lessons instead of seeing a "deficit".</p>
      <cite>González, Moll &amp; Amanti, 2005</cite>
    </div>
    <div class="ho-card">
      <h3>Build capacity on <i>both</i> sides</h3>
      <p>Partnerships work when staff <i>and</i> families grow the "4 Cs": <b>Capabilities</b> (skills, knowledge), <b>Connections</b> (relationships, networks), <b>Cognition</b> (beliefs), and <b>Confidence</b> (self-efficacy). Effective efforts are relational, asset-based, culturally responsive, collaborative, interactive, and linked to learning.</p>
      <cite>Dual Capacity-Building Framework, Mapp &amp; Kuttner, 2013 (v2 2019)</cite>
    </div>
  </div>
</section>

<section>
  <h2>10 high-leverage strategies</h2>
  <h3 class="ho-group">In your classroom</h3>
  <ol class="ho-list">
    <li><b>Get to know each family.</b> Early in the year, ask (in their language) about languages spoken at home, the best way and time to reach them, their hopes for their child, and their strengths and talents.</li>
    <li><b>Make the first contact a positive one.</b> A call, text, or note with good news builds trust before any problem comes up.</li>
    <li><b>Communicate two ways, in the family's language, without jargon.</b> Use plain language, visuals, and qualified interpreters. Don't use students as interpreters for important conversations.</li>
    <li><b>Encourage the home language.</b> Tell families that talking, reading, singing, and telling stories in their home language is valuable. It keeps the family connected and builds thinking and vocabulary that support learning in English too.</li>
    <li><b>Invite families' expertise in.</b> Family guest speakers, "family stories" or bilingual book projects, and lessons that draw on students' home lives.</li>
  </ol>
  <h3 class="ho-group">Across the school</h3>
  <ol class="ho-list" start="6">
    <li><b>Link events to learning.</b> Family literacy and math nights, or team meetings where teachers share class data and give families simple at-home activities with goals, work better than one-way information nights.</li>
    <li><b>Try relational home visits.</b> Visits focused on hopes and dreams (not problems), done in pairs, voluntary for families.</li>
    <li><b>Grow family leaders.</b> Make the ELAC a real voice, not just a compliance meeting. Share decisions, train parent leaders, and invite families onto school committees.</li>
  </ol>
  <h3 class="ho-group">With the community</h3>
  <ol class="ho-list" start="9">
    <li><b>Map and connect community partners.</b> Keep a multilingual resource map: health and dental clinics, food banks, libraries, adult ESL and citizenship classes, legal aid, mental-health and newcomer services. Bring them on campus.</li>
    <li><b>Remove the barriers to showing up.</b> Offer flexible times and virtual options, childcare, food, transportation help, interpretation at every event, and a warm, welcoming front office.</li>
  </ol>
</section>

<section>
  <h2>The community schools model</h2>
  <p>A community school partners with families and local organizations to meet the needs of the whole child. California's Community Schools Framework (State Board of Education, 2022) is built on <b>four pillars</b>:</p>
  <div class="ho-pillars">
    <div><b>Integrated student supports</b><span>Health, mental-health, and social services on or near campus</span></div>
    <div><b>Family &amp; community engagement</b><span>Families as true partners and decision-makers</span></div>
    <div><b>Collaborative leadership &amp; practices</b><span>Staff, families, students, and partners lead together</span></div>
    <div><b>Expanded learning time</b><span>Enriching after-school, weekend, and summer learning</span></div>
  </div>
</section>

<section>
  <h2>Know the rules (California &amp; federal)</h2>
  <ul class="ho-rules">
    <li><b>Language access is a civil right.</b> Under Title VI of the Civil Rights Act and the Equal Educational Opportunities Act, schools must communicate meaningfully with parents in a language they understand. The 2015 federal "Dear Colleague" guidance was rescinded in August 2025, but the underlying laws (Title VI, the EEOA, and Title III) still apply.</li>
    <li><b>The 15% rule.</b> When 15% or more of a school's students speak the same primary language other than English, notices to those parents must be sent in that language as well as English, and parents may respond in either (Cal. Education Code § 48985).</li>
    <li><b>ELAC &amp; DELAC.</b> California schools with 21 or more English learners must have an English Learner Advisory Committee; districts with 51 or more must have a District ELAC. Use them to share decisions, not just to inform.</li>
    <li><b>The California EL Roadmap</b> (Principle 1) calls on schools to value and build strong family and school partnerships.</li>
  </ul>
</section>

<section class="ho-try">
  <h2>Try this week</h2>
  <ul class="ho-check">
    <li>Send one positive message home to an MLL's family, in their language.</li>
    <li>Ask one family about a talent or tradition they could share with the class.</li>
    <li>Find out how your school requests a qualified interpreter, and save the number.</li>
    <li>Add one community partner to your resource list (and ask Mr. Martinez for more!).</li>
    <li>Invite a family to your next ELAC meeting or family night.</li>
  </ul>
</section>

<footer class="ho-sources">
  <h2>Sources</h2>
  <ol>
    <li>Henderson, A. T. &amp; Mapp, K. L. (2002). <i>A New Wave of Evidence: The Impact of School, Family, and Community Connections on Student Achievement.</i> SEDL.</li>
    <li>Mapp, K. L. &amp; Kuttner, P. J. (2013). <i>Partners in Education: A Dual Capacity-Building Framework for Family–School Partnerships.</i> SEDL / U.S. Dept. of Education. (Version 2: Mapp &amp; Bergman, 2019.)</li>
    <li>González, N., Moll, L. C. &amp; Amanti, C. (2005). <i>Funds of Knowledge: Theorizing Practices in Households, Communities, and Classrooms.</i> Routledge.</li>
    <li>Sheldon, S. B. &amp; Jung, S. B. (2018). <i>Student Outcomes and Parent Teacher Home Visits.</i> Johns Hopkins University.</li>
    <li>Colorín Colorado. <i>A Guide for Engaging ELL Families: Twenty Strategies for School Leaders.</i></li>
    <li>WIDA. <i>FocusOn: Language-Focused Family Engagement.</i></li>
    <li>Policy Analysis for California Education (2023). Policy brief on community schools serving newcomer students (Oakland International High School).</li>
    <li>California Department of Education. <i>California English Learner Roadmap</i> (2017) and <i>California Community Schools Framework</i> (2022).</li>
    <li>California Education Code § 48985 (notices in a primary language other than English); Education Code § 52176 and 5 CCR § 11308 (ELAC and DELAC).</li>
    <li>Education Week (Aug. 2025); Colorado Dept. of Education (Sept. 2025): rescission of the 2015 English Learner Dear Colleague Letter.</li>
  </ol>
</footer>`;

/** The handouts, by their backpack item id */
const HANDOUTS: Record<string, { bar: string; title: string; theme: string; html: string }> = {
  "community-handout": { bar: "📄 Community Schools Handout", title: "Partners in Learning – Valor Community Schools", theme: "", html: HANDOUT_HTML },
  "iep-handout": { bar: "📘 Ms. Williams's Handout", title: "Both/And – Supporting MLLs with IEPs", theme: "ho-iep", html: IEP_HANDOUT_HTML },
};

/** Open a print-friendly copy (the browser's print dialog can save it as a PDF) */
function printHandout(id: string): void {
  const h = HANDOUTS[id];
  const css = Array.from(document.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${h.title}</title>
    <style>${css}\nbody{background:#fff;margin:0}.ho-paper{box-shadow:none;margin:0 auto;max-height:none;overflow:visible}</style></head>
    <body><article class="ho-paper ${h.theme}">${h.html}</article></body></html>`);
  w.document.close();
  w.focus();
  w.setTimeout(() => w.print(), 300);
}

export function openHandout(id = "community-handout"): void {
  const h = HANDOUTS[id];
  if (overlay || !h) return;
  overlay = document.createElement("div");
  overlay.id = "handout-overlay";
  overlay.className = "modal-overlay ho-overlay";
  overlay.innerHTML = `
    <div class="ho-wrap ${h.theme ? h.theme + "-wrap" : ""}" role="dialog" aria-modal="true" aria-label="${h.bar.replace(/^\S+ /, "")}">
      <div class="ho-bar">
        <span>${h.bar}</span>
        <button type="button" class="ho-print">🖨️ Print / Save as PDF</button>
        <button type="button" class="ho-close" aria-label="Close the handout">✕</button>
      </div>
      <article class="ho-paper ${h.theme}">${h.html}</article>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeHandout();
  });
  overlay.querySelector(".ho-close")!.addEventListener("click", closeHandout);
  overlay.querySelector(".ho-print")!.addEventListener("click", () => printHandout(id));
  window.addEventListener("keydown", onKey, true);
}
