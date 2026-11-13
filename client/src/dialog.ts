/**
 * Simple NPC dialogue pop-up: speaker name and title, one or more paragraphs, a close button.
 * While it is open it swallows the keys so nothing happens in the game behind it.
 */
export interface DialogContent {
  speaker: string;
  title?: string;
  paragraphs: string[];
}

let open = false;

export function isDialogOpen(): boolean {
  return open;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => ESCAPES[c]);

export function showDialog(content: DialogContent, onClose?: () => void): void {
  if (open) return;
  open = true;

  const overlay = document.createElement("div");
  overlay.id = "dialog-overlay";
  overlay.className = "modal-overlay dialog-overlay";
  overlay.innerHTML = `
    <div class="modal-card dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-speaker">
      <div class="dialog-head">
        <div class="dialog-avatar" aria-hidden="true">👑</div>
        <div>
          <div id="dialog-speaker" class="dialog-speaker">${esc(content.speaker)}</div>
          ${content.title ? `<div class="dialog-title">${esc(content.title)}</div>` : ""}
        </div>
      </div>
      <div class="dialog-body">${content.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      <div class="modal-actions">
        <button id="dialog-close" class="modal-btn modal-btn-primary">Close</button>
      </div>
      <p class="welcome-hint">Press Enter or E to close</p>
    </div>`;
  document.body.appendChild(overlay);

  const close = (): void => {
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
    open = false;
    onClose?.();
  };
  function onKey(e: KeyboardEvent): void {
    e.stopImmediatePropagation();
    if (e.key === "Enter" || e.key === "Escape" || e.key === " " || e.code === "KeyE") {
      e.preventDefault();
      close();
    }
  }
  window.addEventListener("keydown", onKey, true);
  const btn = overlay.querySelector<HTMLButtonElement>("#dialog-close")!;
  btn.addEventListener("click", close);
  btn.focus({ preventScroll: true });
}
