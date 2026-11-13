/**
 * NPC dialogue pop-up with dialogue trees.
 *
 * A tree is a set of nodes. Each node has what the NPC says (paragraphs, optionally a QR code placeholder or
 * image) and numbered reply options. Players pick an option by clicking it or pressing its number key; an
 * option either leads to another node or ends the conversation. While the pop-up is open it swallows the keys
 * so nothing happens in the game behind it.
 */
export interface DialogOption {
  label: string;
  /** Id of the node this option leads to; omit to end the conversation */
  next?: string;
  /** Shows a gold "!" next to the option until this objective is complete */
  markerObjective?: string;
}

export interface DialogNode {
  paragraphs: string[];
  /** Show a QR code. `qrImage` is a URL; without it a clearly marked placeholder is shown. */
  qr?: { caption: string; qrImage?: string };
  options: DialogOption[];
  /** Reported to the caller (onEvent) when this node is shown, e.g. "survey" */
  event?: string;
}

export interface DialogTree {
  start: string;
  nodes: Record<string, DialogNode>;
}

export interface DialogSpeaker {
  name: string;
  title?: string;
  /** Portrait image URL; without one a plain icon is shown */
  portrait?: string;
}

let open = false;

export function isDialogOpen(): boolean {
  return open;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** A QR-code-looking placeholder (finder squares + noise) clearly labelled as a placeholder. */
function qrPlaceholderSvg(): string {
  const N = 21;
  let cells = "";
  // deterministic pseudo-random fill
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const inFinder = (x: number, y: number): boolean => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!inFinder(x, y) && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  const finder = (x: number, y: number): string =>
    `<rect x="${x}" y="${y}" width="7" height="7" fill="none" stroke="#111" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" class="dialog-qr-svg" aria-hidden="true"><rect x="-1" y="-1" width="${N + 2}" height="${N + 2}" fill="#fff"/><g fill="#111">${cells}${finder(0.5, 0.5)}${finder(N - 6.5, 0.5)}${finder(0.5, N - 6.5)}</g></svg>`;
}

export function showDialog(speaker: DialogSpeaker, tree: DialogTree, onClose?: () => void, onEvent?: (event: string) => void, isDone?: (objectiveId: string) => boolean): void {
  if (open) return;
  open = true;

  const overlay = document.createElement("div");
  overlay.id = "dialog-overlay";
  overlay.className = "modal-overlay dialog-overlay";
  overlay.innerHTML = `
    <div class="modal-card dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-speaker">
      <div class="dialog-head">
        ${
          speaker.portrait
            ? `<img class="dialog-portrait" src="${esc(speaker.portrait)}" alt="${esc(speaker.name)}" />`
            : `<div class="dialog-avatar" aria-hidden="true">🎓</div>`
        }
        <div>
          <div id="dialog-speaker" class="dialog-speaker">${esc(speaker.name)}</div>
          ${speaker.title ? `<div class="dialog-title">${esc(speaker.title)}</div>` : ""}
        </div>
      </div>
      <div class="dialog-body" id="dialog-body"></div>
      <div class="dialog-options" id="dialog-options" role="list"></div>
      <p class="welcome-hint">Click an answer or press its number</p>
    </div>`;
  document.body.appendChild(overlay);
  const bodyEl = overlay.querySelector<HTMLElement>("#dialog-body")!;
  const optsEl = overlay.querySelector<HTMLElement>("#dialog-options")!;

  let current: DialogNode = tree.nodes[tree.start];

  const close = (): void => {
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
    open = false;
    onClose?.();
  };

  const choose = (i: number): void => {
    const opt = current.options[i];
    if (!opt) return;
    if (!opt.next || !tree.nodes[opt.next]) {
      close();
      return;
    }
    show(tree.nodes[opt.next]);
  };

  function show(node: DialogNode): void {
    current = node;
    if (node.event) onEvent?.(node.event);
    let html = node.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
    if (node.qr) {
      const img = node.qr.qrImage
        ? `<img class="dialog-qr-img" src="${esc(node.qr.qrImage)}" alt="Feedback survey QR code" />`
        : `<div class="dialog-qr-ph">${qrPlaceholderSvg()}<span class="dialog-qr-badge">PLACEHOLDER</span></div>`;
      html += `<div class="dialog-qr">${img}<div class="dialog-qr-cap">${esc(node.qr.caption)}</div></div>`;
    }
    bodyEl.innerHTML = html;
    optsEl.innerHTML = node.options
      .map(
        (o, i) =>
          `<button type="button" class="dialog-opt" data-i="${i}" role="listitem"><span class="dialog-num">${i + 1}</span><span class="dialog-opt-label">${esc(o.label)}</span>${
            o.markerObjective && !isDone?.(o.markerObjective) ? `<span class="dialog-bang" title="Still to do" aria-label="Still to do">!</span>` : ""
          }</button>`
      )
      .join("");
    optsEl.querySelectorAll<HTMLButtonElement>(".dialog-opt").forEach((b) => b.addEventListener("click", () => choose(Number(b.dataset.i))));
    (optsEl.querySelector(".dialog-opt") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function onKey(e: KeyboardEvent): void {
    e.stopImmediatePropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    // Enter / Space choose the highlighted answer, arrows move the highlight
    const opts = Array.from(optsEl.querySelectorAll<HTMLElement>(".dialog-opt"));
    const idx = opts.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(idx >= 0 ? idx : 0);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      opts[(Math.max(idx, 0) + step + opts.length) % opts.length]?.focus();
      return;
    }
    // number keys (top row or numpad) pick the option with that number
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      e.preventDefault();
      choose(Number(m[1]) - 1);
    }
  }
  window.addEventListener("keydown", onKey, true);
  show(current);
}
