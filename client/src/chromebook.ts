/**
 * The Chromebook item: clicking it in the inventory opens the laptop on screen. It starts at a ChromeOS-style
 * login (the player's name, a password field with the password already filled in, and a Log in button); logging
 * in shows the desktop with a few school apps on the shelf. Esc or ✕ closes it; Sign out goes back to the login.
 *
 * While it is open every key stays inside it (typing a password never moves the character).
 */

let overlay: HTMLElement | null = null;
let clockTimer = 0;

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const APPS: Array<{ id: string; name: string; icon: string; color: string; text: string }> = [
  { id: "chrome", name: "Chrome", icon: "🌐", color: "#e8f0fe", text: "(Sample) The web browser will open here." },
  { id: "classroom", name: "Classroom", icon: "🏫", color: "#e6f4ea", text: "(Sample) Google Classroom: your ELD PD class and its 16 assignments will show here." },
  { id: "docs", name: "Docs", icon: "📄", color: "#e8f0fe", text: "(Sample) Google Docs: write your reflections here." },
  { id: "slides", name: "Slides", icon: "📊", color: "#fef7e0", text: "(Sample) Google Slides: today's PD presentation will open here." },
  { id: "files", name: "Files", icon: "📁", color: "#f1f3f4", text: "(Sample) Your files will show here." },
];

export function isChromebookOpen(): boolean {
  return !!overlay;
}

export function closeChromebook(): void {
  if (!overlay) return;
  window.removeEventListener("keydown", onKey, true);
  window.clearInterval(clockTimer);
  overlay.remove();
  overlay = null;
}

function onKey(e: KeyboardEvent): void {
  if (!overlay) return;
  // keep every key inside the laptop (the character must not walk while typing)
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    closeChromebook();
  } else if (e.key === "Enter" && overlay.querySelector(".cb-login")) {
    e.preventDefault();
    logIn();
  }
}

const timeNow = (): string => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Open the laptop at the login screen */
export function openChromebook(userName: string): void {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "chromebook-overlay";
  overlay.className = "modal-overlay cb-overlay";
  overlay.innerHTML = `
    <div class="cb-laptop" role="dialog" aria-modal="true" aria-label="Chromebook">
      <div class="cb-bezel">
        <div class="cb-cam"></div>
        <div class="cb-screen"></div>
      </div>
      <div class="cb-base"><div class="cb-notch"></div></div>
      <button type="button" class="cb-close" aria-label="Close the Chromebook">✕</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeChromebook();
  });
  overlay.querySelector(".cb-close")!.addEventListener("click", closeChromebook);
  overlay.dataset.user = userName || "Valor Staff";
  window.addEventListener("keydown", onKey, true);
  showLogin();
  window.clearInterval(clockTimer);
  clockTimer = window.setInterval(() => overlay?.querySelectorAll(".cb-time").forEach((el) => (el.textContent = timeNow())), 15000);
}

function screen(): HTMLElement {
  return overlay!.querySelector<HTMLElement>(".cb-screen")!;
}

function showLogin(): void {
  if (!overlay) return;
  const name = overlay.dataset.user ?? "";
  const initial = esc((name.trim()[0] ?? "V").toUpperCase());
  screen().innerHTML = `
    <div class="cb-login">
      <div class="cb-wall"></div>
      <div class="cb-login-card">
        <div class="cb-avatar">${initial}</div>
        <div class="cb-user">${esc(name)}</div>
        <div class="cb-email">staff@valoracademy.org</div>
        <div class="cb-pw-row">
          <input class="cb-pw" type="password" value="valor2026" aria-label="Password" autocomplete="off" />
          <button type="button" class="cb-login-btn" aria-label="Log in">Log in</button>
        </div>
        <div class="cb-pw-hint">Password: valor2026</div>
      </div>
      <div class="cb-statusbar"><span class="cb-time">${timeNow()}</span> 🔋 📶</div>
    </div>`;
  screen().querySelector(".cb-login-btn")!.addEventListener("click", logIn);
  const pw = screen().querySelector<HTMLInputElement>(".cb-pw")!;
  pw.focus();
  pw.select();
}

function logIn(): void {
  if (!overlay) return;
  const pw = screen().querySelector<HTMLInputElement>(".cb-pw");
  if (pw && pw.value.length === 0) {
    pw.classList.add("bad");
    screen().querySelector(".cb-pw-hint")!.textContent = "Enter the password (valor2026)";
    return;
  }
  screen().innerHTML = `<div class="cb-signing">Signing in…</div>`;
  window.setTimeout(showDesktop, 700);
}

function showDesktop(): void {
  if (!overlay) return;
  screen().innerHTML = `
    <div class="cb-desktop">
      <div class="cb-wall"></div>
      <div class="cb-icons">
        ${APPS.map((a) => `<button type="button" class="cb-app" data-app="${a.id}"><span class="cb-app-icon" style="background:${a.color}">${a.icon}</span><span>${esc(a.name)}</span></button>`).join("")}
      </div>
      <div class="cb-window" hidden></div>
      <div class="cb-shelf">
        <div class="cb-launcher" title="Launcher">◯</div>
        <div class="cb-shelf-apps">
          ${APPS.map((a) => `<button type="button" class="cb-shelf-app" data-app="${a.id}" title="${esc(a.name)}">${a.icon}</button>`).join("")}
        </div>
        <div class="cb-tray"><button type="button" class="cb-signout">Sign out</button><span class="cb-time">${timeNow()}</span> 🔋 📶</div>
      </div>
    </div>`;
  screen().querySelectorAll<HTMLElement>("[data-app]").forEach((b) => b.addEventListener("click", () => openApp(b.dataset.app!)));
  screen().querySelector(".cb-signout")!.addEventListener("click", showLogin);
}

function openApp(id: string): void {
  const app = APPS.find((a) => a.id === id);
  const win = screen().querySelector<HTMLElement>(".cb-window");
  if (!app || !win) return;
  win.hidden = false;
  win.innerHTML = `
    <div class="cb-win-bar"><span>${app.icon} ${esc(app.name)}</span><button type="button" class="cb-win-close" aria-label="Close ${esc(app.name)}">✕</button></div>
    <div class="cb-win-body">${esc(app.text)}</div>`;
  win.querySelector(".cb-win-close")!.addEventListener("click", () => (win.hidden = true));
}
