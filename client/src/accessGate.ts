/**
 * The access password screen: shown over everything when the game opens, until the participant types the password.
 *
 * The password itself is never in the code (the repository is public). The build gets only its SHA-256 fingerprint,
 * VITE_ACCESS_HASH (set in Vercel), and checks what the participant types against it. The multiplayer server checks
 * the password too (ACCESS_PASSWORD on Render), so the screen can't be skipped to join others. Once entered, the
 * password is remembered on this device. With no VITE_ACCESS_HASH (local development) there is no screen.
 */
const HASH: string = ((import.meta as any).env?.VITE_ACCESS_HASH ?? "").trim().toLowerCase();
const STORE_KEY = "vams-access";

/** Typed passwords are compared without surrounding spaces and without caring about capital letters */
const normalize = (s: string) => s.trim().toLowerCase();

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The password this device unlocked the game with (sent to the multiplayer server), or "" */
export function accessKey(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? "";
  } catch {
    return "";
  }
}

function remember(pw: string): void {
  try {
    localStorage.setItem(STORE_KEY, pw);
  } catch {
    /* private window: they'll just be asked again next time */
  }
}

/** Show the password screen unless this device already has the right password (or no password is set) */
export async function requireAccess(): Promise<void> {
  if (!HASH) return;
  const saved = accessKey();
  if (saved && (await sha256(saved)) === HASH) return;

  const overlay = document.createElement("div");
  overlay.id = "access-gate";
  overlay.innerHTML = `
    <form class="ag-card" autocomplete="off">
      <img src="/valor_logo.jpg" alt="" class="ag-logo" />
      <h1>Valor Academy</h1>
      <p class="ag-sub">Educator Professional Development · 3D Campus</p>
      <label for="ag-pw">Enter the access password to play</label>
      <div class="ag-row">
        <input id="ag-pw" type="password" spellcheck="false" autocapitalize="off" placeholder="Password" />
        <button type="button" class="ag-eye" aria-label="Show password">👁️</button>
      </div>
      <div class="ag-error" role="alert"></div>
      <button type="submit" class="ag-go">Enter ▶</button>
      <p class="ag-help">Don't have the password? Ask your PD facilitator.</p>
    </form>`;
  document.body.appendChild(overlay);
  const form = overlay.querySelector<HTMLFormElement>("form")!;
  const input = overlay.querySelector<HTMLInputElement>("#ag-pw")!;
  const error = overlay.querySelector<HTMLElement>(".ag-error")!;
  // the game's keyboard controls stay quiet while the screen is up (typing in the box still works)
  const stopKeys = (e: KeyboardEvent) => {
    if (e.target !== input) e.stopImmediatePropagation();
  };
  window.addEventListener("keydown", stopKeys, true);
  overlay.querySelector(".ag-eye")!.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    input.focus();
  });
  setTimeout(() => input.focus(), 50);

  await new Promise<void>((resolve) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = normalize(input.value);
      if (pw && (await sha256(pw)) === HASH) {
        remember(pw);
        window.removeEventListener("keydown", stopKeys, true);
        overlay.classList.add("ag-open");
        setTimeout(() => overlay.remove(), 400);
        resolve();
      } else {
        error.textContent = pw ? "That password isn't right. Try again." : "Please type the password.";
        form.classList.remove("ag-shake");
        void form.offsetWidth;
        form.classList.add("ag-shake");
        input.select();
      }
    });
  });
}
