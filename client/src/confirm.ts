/**
 * Small confirm pop-up ("Are you sure?"). While it is open it swallows the keys so nothing happens in the game
 * behind it. Enter / Y confirms, Esc / N cancels, or click a button.
 */
let open = false;

export function isConfirmOpen(): boolean {
  return open;
}

export function confirmAction(opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }, onConfirm: () => void, onCancel?: () => void): void {
  if (open) return;
  open = true;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.zIndex = "135";
  const card = document.createElement("div");
  card.className = "modal-card";
  card.setAttribute("role", "alertdialog");
  card.setAttribute("aria-modal", "true");
  const h = document.createElement("h3");
  h.className = "modal-title";
  h.textContent = opts.title;
  const p = document.createElement("p");
  p.className = "modal-desc";
  p.textContent = opts.message;
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const yes = document.createElement("button");
  yes.className = "modal-btn modal-btn-primary";
  yes.textContent = opts.confirmLabel ?? "Yes";
  const no = document.createElement("button");
  no.className = "modal-btn modal-btn-secondary";
  no.textContent = opts.cancelLabel ?? "Cancel";
  actions.append(yes, no);
  card.append(h, p, actions);
  overlay.append(card);
  document.body.appendChild(overlay);

  const finish = (confirmed: boolean): void => {
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
    open = false;
    if (confirmed) onConfirm();
    else onCancel?.();
  };
  function onKey(e: KeyboardEvent): void {
    e.stopImmediatePropagation();
    const k = e.key.toLowerCase();
    if (k === "enter" || k === "y") {
      e.preventDefault();
      finish(true);
    } else if (k === "escape" || k === "n") {
      e.preventDefault();
      finish(false);
    }
  }
  window.addEventListener("keydown", onKey, true);
  yes.addEventListener("click", () => finish(true));
  no.addEventListener("click", () => finish(false));
  no.focus({ preventScroll: true });
}
