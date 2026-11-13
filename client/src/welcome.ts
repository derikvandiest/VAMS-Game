/**
 * Welcome pop-up shown the first time the player sits at a table in the MPR (objective 1).
 * The text is a placeholder the host can edit here.
 */

const STEPS: Array<{ icon: string; title: string; text: string }> = [
  {
    icon: "🏫",
    title: "Visit every classroom",
    text: "Every homeroom classroom has an assignment: 16 in all. Go to each one and complete its assignment, in any order. The objective box at the top shows your progress.",
  },
  {
    icon: "✨",
    title: "Follow the glowing doors",
    text: "A classroom whose assignment is still waiting has an entrance door that glows bright yellow. When you complete that room's assignment, its glow turns off.",
  },
  {
    icon: "🗺️",
    title: "Open the map with M",
    text: "Press M any time to see a map of the campus. It labels every classroom and highlights the ones you still need to visit.",
  },
  {
    icon: "📝",
    title: "Turn in your work",
    text: "After all 16 assignments are done, go to the ELD classroom and turn in your work to Mr. Van Diest.",
  },
  {
    icon: "🚗",
    title: "Head home",
    text: "Once you have turned in your assignments and received the completed message, go to the parking lot and drive away in one of the cars to finish the game.",
  },
];

let open = false;

export function showWelcomePopup(onClose?: () => void): void {
  if (open) return;
  open = true;

  const overlay = document.createElement("div");
  overlay.id = "welcome-overlay";
  overlay.className = "modal-overlay welcome-overlay";
  overlay.innerHTML = `
    <div class="modal-card welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div class="welcome-badge">VAMS</div>
      <h3 id="welcome-title" class="modal-title welcome-title">Welcome to the first ELD PD at VAMS!</h3>
      <p class="welcome-intro">Thanks for joining us. Here is how the day works:</p>
      <ol class="welcome-steps">
        ${STEPS.map(
          (s) => `<li><span class="welcome-step-icon" aria-hidden="true">${s.icon}</span><div><b>${s.title}</b><p>${s.text}</p></div></li>`
        ).join("")}
      </ol>
      <div class="modal-actions">
        <button id="welcome-ok" class="modal-btn modal-btn-primary">Let's get started</button>
      </div>
      <p class="welcome-hint">Press Enter or click the button to continue</p>
    </div>`;
  document.body.appendChild(overlay);

  const close = (): void => {
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
    open = false;
    onClose?.();
  };

  // While the pop-up is open it swallows the keys, so nothing happens in the game behind it
  function onKey(e: KeyboardEvent): void {
    e.stopImmediatePropagation();
    if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }
  window.addEventListener("keydown", onKey, true);
  const ok = overlay.querySelector<HTMLButtonElement>("#welcome-ok")!;
  ok.addEventListener("click", close);
  ok.focus({ preventScroll: true });
}
