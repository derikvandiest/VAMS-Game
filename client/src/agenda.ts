/**
 * The Student Agenda item: clicking it opens a planner page with every objective in detail, so the player can see
 * what is done and what is left: the main steps of the PD (seat in the MPR, the 16 classroom assignments with their
 * teacher and floor, turning the work in, leaving campus) and the optional objectives.
 */
import layout from "../../content/layout.json";
import { loadSlot, getActiveSlotId } from "./saveManager";
import { ROOMS } from "./rooms";
import { teacherFor } from "./assignments";
import { pencilQuest, PENCILS_NEEDED } from "./inventory";

let overlay: HTMLElement | null = null;

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const box = (done: boolean): string => `<span class="ag-box${done ? " done" : ""}">${done ? "✓" : ""}</span>`;

export function isAgendaOpen(): boolean {
  return !!overlay;
}

export function closeAgenda(): void {
  if (!overlay) return;
  window.removeEventListener("keydown", onKey, true);
  overlay.remove();
  overlay = null;
}

function onKey(e: KeyboardEvent): void {
  if (!overlay) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    closeAgenda();
  }
}

export function openAgenda(playerName: string): void {
  if (overlay) return;
  const done = new Set(loadSlot(getActiveSlotId())?.objectives.completedIds ?? []);
  const doors = (layout as { doors: Array<{ id: string; floor: number }> }).doors;
  const floorOf = (id: string): string => (doors.find((d) => d.id === id)?.floor === 1 ? "Upstairs" : "Ground floor");

  // the 16 classroom assignments, by grade
  const rooms = ROOMS.filter((r) => r.type === "stamp" && r.objectiveId);
  const doneCount = rooms.filter((r) => done.has(r.objectiveId!)).length;
  const grades = [5, 6, 7, 8].map((g) => ({ g, rooms: rooms.filter((r) => r.id.startsWith(`${g}th-`)) }));

  // where the player is in the PD (the main objective right now)
  const seated = done.has("obj_mpr_seat");
  const turnedIn = done.has("obj_turn_in");
  const left = done.has("obj_exit_campus");
  const now = !seated
    ? "Go to the MPR and take a seat at one of the tables."
    : doneCount < rooms.length
      ? `Visit the classrooms and complete their assignments: ${rooms.length - doneCount} still to go.`
      : !turnedIn
        ? "Take your 16 assignments to Mr. Van Diest at the ELD classroom (upstairs, by the office) and turn them in."
        : !left
          ? "Go to the parking lot and drive away in one of the cars."
          : "You've finished the PD. Thank you for playing!";

  const q = pencilQuest();
  const surveyDone = done.has("obj_survey");
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  overlay = document.createElement("div");
  overlay.id = "agenda-overlay";
  overlay.className = "modal-overlay ag-overlay";
  overlay.innerHTML = `
    <div class="ag-book" role="dialog" aria-modal="true" aria-label="Student Agenda">
      <button type="button" class="ag-close" aria-label="Close the agenda">✕</button>
      <div class="ag-spiral"></div>
      <div class="ag-page">
        <div class="ag-head">
          <div><div class="ag-title">📒 Student Agenda</div><div class="ag-sub">${esc(playerName || "Valor Staff")} · ${esc(today)}</div></div>
          <div class="ag-progress"><b>${doneCount}</b>/${rooms.length}<span>assignments</span></div>
        </div>

        <div class="ag-now"><span>Right now</span>${esc(now)}</div>

        <h3>Main objectives</h3>
        <ol class="ag-main">
          <li>${box(seated)}<div><b>Welcome to the PD</b><small>Go to the MPR and take a seat at one of the tables.</small></div></li>
          <li>${box(doneCount >= rooms.length)}<div><b>Complete the 16 classroom assignments</b> <em>${doneCount}/${rooms.length}</em>
            <small>Each homeroom classroom has an assignment: talk to the teacher or read the whiteboard. Doors with a green ! still have one.</small>
            <div class="ag-grades">${grades
              .map(
                ({ g, rooms: rs }) => `<div class="ag-grade"><div class="ag-grade-title">${g}th Grade <span>${floorOf(rs[0]?.id ?? "")}</span></div>${rs
                  .map((r) => {
                    const t = teacherFor(r.id);
                    return `<div class="ag-room${done.has(r.objectiveId!) ? " done" : ""}">${box(done.has(r.objectiveId!))}<span>${esc(r.label)}${t ? ` <i>· ${esc(t)}</i>` : ""}</span></div>`;
                  })
                  .join("")}</div>`
              )
              .join("")}</div>
          </div></li>
          <li>${box(turnedIn)}<div><b>Turn in your work</b><small>Bring all 16 assignments to Mr. Van Diest at the ELD classroom (upstairs, office building).</small></div></li>
          <li>${box(left)}<div><b>Leave campus</b><small>Go to the parking lot and drive away in one of the cars.</small></div></li>
        </ol>

        <h3>Optional objectives</h3>
        <ul class="ag-opt">
          <li>${box(q.done)}<div><b>Fill your pencil pouch</b> <em>${q.active ? `${Math.min(q.found.length, PENCILS_NEEDED)}/${PENCILS_NEEDED}` : "not started"}</em>
            <small>${
              q.active
                ? q.done
                  ? "All 5 sharpened pencils found. Nice work!"
                  : "Find 5 sharpened pencils lying around campus (look for the sparkle) and press E to pick them up."
                : "Get a pencil pouch from the storage room in the MPR (you'll need a backpack first), then find 5 sharpened pencils around campus."
            }</small></div></li>
          <li>${box(surveyDone)}<div><b>Feedback survey</b><small>Talk to Mr. Van Diest in the MPR and fill out the feedback survey.</small></div></li>
        </ul>
        <div class="ag-foot">Esc or ✕ to close</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAgenda();
  });
  overlay.querySelector(".ag-close")!.addEventListener("click", closeAgenda);
  window.addEventListener("keydown", onKey, true);
}
