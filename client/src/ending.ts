/**
 * The end of the game: after turning in the 16 assignments to Mrs. Carmona, the player drives away in a car. A
 * "Congratulations" message shows for 7 seconds and fades away, then a window with the player's stats and a rank from
 * 1 to 4 (4 = everything done). After that the game continues in Free Play.
 */
import { loadSlot, getActiveSlotId } from "./saveManager";
import { optionalDone, pencilQuest, OPTIONAL, PENCILS_NEEDED } from "./inventory";

const RANKS = [
  { n: 1, name: "Rookie", text: "You finished the PD! Next time, try some of the optional objectives around campus." },
  { n: 2, name: "Rising Star", text: "Great work! You finished the PD and explored some extras along the way." },
  { n: 3, name: "All-Star", text: "Impressive! You finished the PD and most of the optional objectives." },
  { n: 4, name: "Valor Legend", text: "Incredible! You completed every single objective. You are a true Valor Legend!" },
];

export interface GameStats {
  assignments: number;
  optional: number;
  optionalTotal: number;
  pencils: number;
  survey: boolean;
  completed: number;
  total: number;
  percent: number;
  rank: (typeof RANKS)[number];
  playtime: string;
}

/** Everything the player did: the 16 assignments + the 3 other main steps, and the optional objectives */
export function gameStats(): GameStats {
  const done = new Set(loadSlot(getActiveSlotId())?.objectives.completedIds ?? []);
  const slot = loadSlot(getActiveSlotId());
  const assignments = slot?.objectives.stampsCount ?? 0;
  const main = assignments + ["obj_mpr_seat", "obj_turn_in", "obj_exit_campus"].filter((id) => done.has(id)).length;
  const q = pencilQuest();
  const opt = optionalDone().length + (q.active ? 1 : 0) + (q.done ? 1 : 0) + (done.has("obj_survey") ? 1 : 0);
  const optionalTotal = OPTIONAL.length + 3; // + find the pencil pouch, fill it, the feedback survey
  const total = 19 + optionalTotal;
  const completed = main + opt;
  const percent = Math.round((completed / total) * 100);
  // rank: every main step is needed to reach the end, so it comes down to how many optional objectives were done
  const rank = opt >= optionalTotal ? RANKS[3] : opt >= Math.ceil(optionalTotal * 0.55) ? RANKS[2] : opt >= 2 ? RANKS[1] : RANKS[0];
  const secs = slot?.playtimeSeconds ?? 0;
  const playtime = secs >= 3600 ? `${Math.floor(secs / 3600)} h ${Math.floor((secs % 3600) / 60)} min` : `${Math.max(1, Math.round(secs / 60))} min`;
  return { assignments, optional: opt, optionalTotal, pencils: Math.min(q.found.length, PENCILS_NEEDED), survey: done.has("obj_survey"), completed, total, percent, rank, playtime };
}

/** "Congratulations!" for 7 seconds (fading away), then the stats window */
export function showGameComplete(playerName: string, onFreePlay?: () => void): void {
  const banner = document.createElement("div");
  banner.id = "game-complete";
  banner.innerHTML = `
    <div class="gc-inner">
      <div class="gc-confetti">🎉</div>
      <h1>Congratulations${playerName ? `, ${playerName.replace(/[<>&"]/g, "")}` : ""}!</h1>
      <p>You completed the Valor Academy ELD PD.</p>
      <p class="gc-sub">GAME OVER · Thanks for playing!</p>
    </div>`;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("show"));
  window.setTimeout(() => banner.classList.remove("show"), 6200); // fades out by 7 seconds
  window.setTimeout(() => {
    banner.remove();
    showStats(onFreePlay);
  }, 7000);
}

function showStats(onFreePlay?: () => void): void {
  const s = gameStats();
  const stars = [1, 2, 3, 4].map((i) => `<span class="${i <= s.rank.n ? "on" : ""}">★</span>`).join("");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay stats-overlay";
  overlay.innerHTML = `
    <div class="modal-card stats-card" role="dialog" aria-modal="true" aria-label="Your game stats">
      <div class="stats-kicker">Final results</div>
      <div class="stats-rank">
        <div class="stats-stars" aria-label="Rank ${s.rank.n} of 4">${stars}</div>
        <div class="stats-rank-name">Rank ${s.rank.n}: ${s.rank.name}</div>
        <p>${s.rank.text}</p>
      </div>
      <div class="stats-grid">
        <div><b>${s.percent}%</b><span>Total completion<br>(${s.completed} of ${s.total} objectives)</span></div>
        <div><b>${s.assignments}/16</b><span>Classroom assignments</span></div>
        <div><b>${s.optional}/${s.optionalTotal}</b><span>Optional objectives</span></div>
        <div><b>${s.pencils}/${PENCILS_NEEDED}</b><span>Sharpened pencils found</span></div>
        <div><b>${s.survey ? "✓" : "–"}</b><span>Feedback survey</span></div>
        <div><b>${s.playtime}</b><span>Time played</span></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="modal-btn modal-btn-primary stats-free">Continue in Free Play</button>
      </div>
      <p class="stats-hint">Free Play: explore campus and do whatever you like!</p>
    </div>`;
  document.body.appendChild(overlay);
  const close = (): void => {
    overlay.remove();
    onFreePlay?.();
  };
  overlay.querySelector(".stats-free")!.addEventListener("click", close);
}
