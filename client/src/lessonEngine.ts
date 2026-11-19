/**
 * The interactive classroom lessons (a few quick stations a teacher walks the player through, then the assignment is
 * complete). Each lesson (lessonObjectives.ts, lessonGrading.ts, ...) is a LessonDef; lessons.ts lists them by room.
 */

export interface LessonStep {
  title: string;
  /** The facilitating teacher's line at the top of the step */
  say: string;
  body: () => string;
  /** Wire up the step's buttons after it is drawn */
  wire?: (root: HTMLElement) => void;
  /** Whether Next is allowed yet (the activity is done) */
  ready?: () => boolean;
  /** Shown beside a disabled Next */
  need?: string;
}

export interface LessonDef {
  roomId: string;
  title: string;
  /** Small line above the title, e.g. "ELD PD · facilitated by Mrs. Weber" */
  kicker: string;
  teacher: string;
  portrait: string;
  steps: LessonStep[];
  /** Clear everything the player did (the "Start over" button) */
  reset: () => void;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let overlay: HTMLElement | null = null;
let lesson: LessonDef | null = null;
let onDone: (() => void) | null = null;
/** Where the player is in each lesson (kept while the game is open, so closing and reopening resumes) */
const stepOf = new Map<string, number>();

export function isLessonOpen(): boolean {
  return !!overlay;
}

export function closeLesson(): void {
  if (!overlay) return;
  window.removeEventListener("keydown", onKey, true);
  overlay.remove();
  overlay = null;
  lesson = null;
}

function onKey(e: KeyboardEvent): void {
  if (!overlay) return;
  e.stopImmediatePropagation(); // the lesson has the keyboard while it is open (typing in its boxes still works)
  if (e.key === "Escape") {
    e.preventDefault();
    closeLesson();
  }
}

/** Redraw the current step (after the player does something in it) */
export function rerender(): void {
  if (!overlay || !lesson) return;
  const step = stepOf.get(lesson.roomId) ?? 0;
  const steps = lesson.steps;
  const s = steps[step];
  const ready = s.ready ? s.ready() : true;
  const last = step === steps.length - 1;
  overlay.querySelector(".lo-dots")!.innerHTML = steps.map((_, i) => `<span class="${i < step ? "done" : i === step ? "now" : ""}"></span>`).join("");
  overlay.querySelector(".lo-stepname")!.textContent = `Station ${step + 1} of ${steps.length} · ${s.title}`;
  const scroll = overlay.querySelector<HTMLElement>(".lo-main")!;
  const keep = scroll.dataset.step === String(step) ? scroll.scrollTop : 0;
  scroll.dataset.step = String(step);
  scroll.innerHTML = `
    <div class="lo-weber"><img src="${lesson.portrait}" alt="" /><div class="lo-bubble"><b>${esc(lesson.teacher)}</b>${esc(s.say)}</div></div>
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
 * Open a lesson. `alreadyDone`: the player finished it before (they can go through it again). `complete` runs once,
 * when the player finishes the last station.
 */
export function openLessonDef(def: LessonDef, alreadyDone: boolean, complete: () => void): void {
  if (overlay) return;
  lesson = def;
  onDone = alreadyDone ? null : () => {
    onDone = null;
    complete();
  };
  overlay = document.createElement("div");
  overlay.className = "modal-overlay lo-overlay";
  overlay.innerHTML = `
    <div class="lo-wrap" role="dialog" aria-modal="true" aria-label="${esc(def.title)} with ${esc(def.teacher)}">
      <div class="lo-top">
        <div><span class="lo-kicker">${esc(def.kicker)}</span><b>${esc(def.title)}</b></div>
        <div class="lo-dots"></div>
        <button type="button" class="lo-close" aria-label="Close (you can come back)">✕</button>
      </div>
      <div class="lo-stepname"></div>
      <div class="lo-main"></div>
      <div class="lo-foot">
        <button type="button" class="lo-back">← Back</button>
        <button type="button" class="lo-reset" title="Start the assignment over from the first station">↺ Start over</button>
        <span class="lo-confirm" hidden>Start over from station 1? <button type="button" class="lo-yes">Yes, start over</button><button type="button" class="lo-no">No</button></span>
        <span class="lo-need"></span>
        <button type="button" class="lo-next">Next →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const id = def.roomId;
  overlay.querySelector(".lo-close")!.addEventListener("click", closeLesson);
  // Start over: a quick confirm right in the footer, then every station is fresh again
  const confirmBar = overlay.querySelector<HTMLElement>(".lo-confirm")!;
  const resetBtn = overlay.querySelector<HTMLElement>(".lo-reset")!;
  resetBtn.addEventListener("click", () => {
    confirmBar.hidden = false;
    resetBtn.hidden = true;
  });
  const hideConfirm = () => {
    confirmBar.hidden = true;
    resetBtn.hidden = false;
  };
  overlay.querySelector(".lo-no")!.addEventListener("click", hideConfirm);
  overlay.querySelector(".lo-yes")!.addEventListener("click", () => {
    def.reset();
    stepOf.set(id, 0);
    hideConfirm();
    rerender();
  });
  overlay.querySelector(".lo-back")!.addEventListener("click", () => {
    stepOf.set(id, Math.max(0, (stepOf.get(id) ?? 0) - 1));
    rerender();
  });
  overlay.querySelector(".lo-next")!.addEventListener("click", () => {
    const step = stepOf.get(id) ?? 0;
    if (step === def.steps.length - 1) {
      onDone?.(); // finishing the last station completes the assignment
      closeLesson();
      stepOf.set(id, 0);
      return;
    }
    stepOf.set(id, step + 1);
    rerender();
  });
  window.addEventListener("keydown", onKey, true);
  rerender();
}
