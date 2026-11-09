/**
 * Start Menu Component for Valor Academy Middle School PD Game.
 * Features:
 * - Official Valor Academy crest logo and school branding.
 * - Continue (with save preview), New Game (Single Player vs Multiplayer), Load Game (Slots 1-3), Settings.
 * - Seamless integration with saveManager and game boot.
 */

import {
  getSaveSlots,
  getLatestSlot,
  loadSlot,
  setActiveSlotId,
  deleteSlot,
  createNewSave,
  SaveSlotData,
} from "./saveManager";
import { loadCharacterProfile, HOMEROOM_INFO } from "./profile";
import { openSettingsModal } from "./settings";

export interface StartMenuOptions {
  onStartGame: (mode: "singleplayer" | "multiplayer", slotData: SaveSlotData) => void;
}

export class StartMenu {
  private container: HTMLElement;
  private options: StartMenuOptions;
  private selectedMode: "singleplayer" | "multiplayer" = "singleplayer";
  private selectedSlotForNewGame: number = 1;

  constructor(options: StartMenuOptions) {
    this.options = options;
    this.container = document.getElementById("start-menu") || document.createElement("div");
    this.container.id = "start-menu";
    this.container.className = "start-menu-container";
    if (!document.getElementById("start-menu")) {
      document.body.appendChild(this.container);
    }
    this.render();
  }

  public show(): void {
    this.container.style.display = "flex";
    this.container.classList.remove("fade-out");
    this.render();
  }

  public hide(): void {
    this.container.classList.add("fade-out");
    setTimeout(() => {
      this.container.style.display = "none";
    }, 450);
  }

  public render(): void {
    const latestSlot = getLatestSlot();
    const canContinue = latestSlot !== null;

    let continueDetails = "No saved game found";
    if (latestSlot) {
      const modeLabel = latestSlot.mode === "singleplayer" ? "Single Player" : "Multiplayer";
      continueDetails = `Slot ${latestSlot.id} · ${latestSlot.name} · ${latestSlot.objectives.stampsCount}/16 Stamps · ${modeLabel}`;
    }

    this.container.innerHTML = `
      <div class="sm-backdrop">
        <div class="sm-card">
          <!-- School Crest & Header -->
          <div class="sm-header">
            <div class="sm-logo-wrapper">
              <img src="/valor_logo.jpg" alt="Valor Academy Middle School Logo" class="sm-logo-img" />
            </div>
            <h1 class="sm-school-title">VALOR ACADEMY MIDDLE SCHOOL</h1>
            <h2 class="sm-school-subtitle">A BRIGHT STAR SCHOOL</h2>
            <div class="sm-badge-pill">Educator Professional Development 3D Campus</div>
          </div>

          <!-- Main Menu Actions -->
          <div class="sm-actions">
            <!-- Continue Button -->
            <button id="sm-btn-continue" class="sm-btn sm-btn-primary ${canContinue ? "" : "sm-btn-disabled"}" ${canContinue ? "" : "disabled"}>
              <div class="sm-btn-content">
                <span class="sm-btn-icon">▶</span>
                <span class="sm-btn-title">Continue</span>
              </div>
              <span class="sm-btn-desc">${continueDetails}</span>
            </button>

            <!-- New Game Button -->
            <button id="sm-btn-new" class="sm-btn sm-btn-action">
              <div class="sm-btn-content">
                <span class="sm-btn-icon">✨</span>
                <span class="sm-btn-title">New Game</span>
              </div>
              <span class="sm-btn-desc">Choose Single Player or Multiplayer & start fresh</span>
            </button>

            <!-- Load Game Button -->
            <button id="sm-btn-load" class="sm-btn sm-btn-secondary">
              <div class="sm-btn-content">
                <span class="sm-btn-icon">📁</span>
                <span class="sm-btn-title">Load Game</span>
              </div>
              <span class="sm-btn-desc">Select from Save Slots 1, 2, or 3</span>
            </button>

            <!-- Settings Button -->
            <button id="sm-btn-settings" class="sm-btn sm-btn-secondary">
              <div class="sm-btn-content">
                <span class="sm-btn-icon">⚙️</span>
                <span class="sm-btn-title">Settings & Character</span>
              </div>
              <span class="sm-btn-desc">Customize your teacher avatar & view controls</span>
            </button>
          </div>

          <!-- Footer / Instructions -->
          <div class="sm-footer">
            <div class="sm-controls-row">
              <span><b>WASD</b> Walk</span>
              <span>•</span>
              <span><b>Shift</b> Sprint</span>
              <span>•</span>
              <span><b>Space</b> Interact</span>
              <span>•</span>
              <span><b>Scroll</b> Zoom</span>
              <span>•</span>
              <span><b>Right-Drag</b> Orbit Camera</span>
            </div>
            <div class="sm-copyright">Browser-based • Automatic Progress Saving • No Account Required</div>
          </div>
        </div>
      </div>

      <!-- Modals will be injected here -->
      <div id="sm-modal-container"></div>
    `;

    this.attachEventListeners(latestSlot);
  }

  private attachEventListeners(latestSlot: SaveSlotData | null): void {
    // Continue
    const continueBtn = this.container.querySelector("#sm-btn-continue");
    if (continueBtn && latestSlot) {
      continueBtn.addEventListener("click", () => {
        setActiveSlotId(latestSlot.id);
        this.hide();
        this.options.onStartGame(latestSlot.mode, latestSlot);
      });
    }

    // New Game
    const newGameBtn = this.container.querySelector("#sm-btn-new");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", () => {
        this.showNewGameModal();
      });
    }

    // Load Game
    const loadGameBtn = this.container.querySelector("#sm-btn-load");
    if (loadGameBtn) {
      loadGameBtn.addEventListener("click", () => {
        this.showLoadGameModal();
      });
    }

    // Settings
    const settingsBtn = this.container.querySelector("#sm-btn-settings");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        openSettingsModal();
      });
    }
  }

  /**
   * Modal: Choose Game Mode & Save Slot for New Game
   */
  private showNewGameModal(): void {
    const modalHost = this.container.querySelector("#sm-modal-container");
    if (!modalHost) return;

    const slots = getSaveSlots();
    // Default to first empty slot, or slot 1
    let defaultSlot = 1;
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i]) {
        defaultSlot = i + 1;
        break;
      }
    }
    this.selectedSlotForNewGame = defaultSlot;
    this.selectedMode = "singleplayer" as "singleplayer" | "multiplayer";

    modalHost.innerHTML = `
      <div class="sm-modal-overlay">
        <div class="sm-modal-card">
          <div class="sm-modal-header">
            <h3>Start a New Game</h3>
            <button class="sm-modal-close" id="sm-new-game-close">&times;</button>
          </div>

          <div class="sm-modal-body">
            <!-- Mode Selection -->
            <label class="sm-field-label">1. Select Game Mode</label>
            <div class="sm-mode-cards">
              <div class="sm-mode-card ${this.selectedMode === "singleplayer" ? "active" : ""}" data-mode="singleplayer">
                <div class="sm-mode-icon">👤</div>
                <div class="sm-mode-info">
                  <div class="sm-mode-title">Single Player</div>
                  <div class="sm-mode-badge">Recommended for self-paced PD</div>
                  <div class="sm-mode-desc">Explore the campus and complete stamp classrooms at your own pace. Automatically autosaves after every objective.</div>
                </div>
              </div>

              <div class="sm-mode-card ${this.selectedMode === "multiplayer" ? "active" : ""}" data-mode="multiplayer">
                <div class="sm-mode-icon">👥</div>
                <div class="sm-mode-info">
                  <div class="sm-mode-title">Multiplayer</div>
                  <div class="sm-mode-badge">Shared MPR Session</div>
                  <div class="sm-mode-desc">Join colleagues in the shared school campus. See each other walk in real-time, react with emojis, and chat.</div>
                </div>
              </div>
            </div>

            <!-- Slot Selection -->
            <label class="sm-field-label" style="margin-top: 18px;">2. Choose Save Slot</label>
            <div class="sm-slot-pickers">
              ${[1, 2, 3]
                .map((slotNum) => {
                  const s = slots[slotNum - 1];
                  const isOccupied = s !== null;
                  const isSelected = this.selectedSlotForNewGame === slotNum;
                  return `
                    <div class="sm-slot-picker ${isSelected ? "selected" : ""} ${isOccupied ? "occupied" : ""}" data-slot="${slotNum}">
                      <div class="sm-slot-picker-num">Slot ${slotNum}</div>
                      <div class="sm-slot-picker-info">
                        ${
                          isOccupied
                            ? `<span class="sm-slot-occupied-warn">⚠️ Has save: ${s?.name} (${s?.objectives.stampsCount}/16)</span>`
                            : `<span class="sm-slot-empty-label">✨ Empty Slot</span>`
                        }
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>

          <div class="sm-modal-footer">
            <button id="sm-new-cancel" class="modal-btn modal-btn-secondary">Cancel</button>
            <button id="sm-new-proceed" class="modal-btn modal-btn-primary">Customize Character & Start ➔</button>
          </div>
        </div>
      </div>
    `;

    // Mode Card Click Handlers
    const modeCards = modalHost.querySelectorAll<HTMLElement>(".sm-mode-card");
    modeCards.forEach((card) => {
      card.addEventListener("click", () => {
        modeCards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        this.selectedMode = (card.dataset.mode as "singleplayer" | "multiplayer") || "singleplayer";
      });
    });

    // Slot Picker Click Handlers
    const slotPickers = modalHost.querySelectorAll<HTMLElement>(".sm-slot-picker");
    slotPickers.forEach((picker) => {
      picker.addEventListener("click", () => {
        slotPickers.forEach((p) => p.classList.remove("selected"));
        picker.classList.add("selected");
        this.selectedSlotForNewGame = parseInt(picker.dataset.slot || "1", 10);
      });
    });

    // Close & Cancel
    modalHost.querySelector("#sm-new-game-close")?.addEventListener("click", () => {
      modalHost.innerHTML = "";
    });
    modalHost.querySelector("#sm-new-cancel")?.addEventListener("click", () => {
      modalHost.innerHTML = "";
    });

    // Proceed: Opens Character Customizer, then launches game
    modalHost.querySelector("#sm-new-proceed")?.addEventListener("click", () => {
      modalHost.innerHTML = "";
      // Open settings to let user confirm character name & appearance
      openSettingsModal(() => {
        // Upon closing or saving settings, create save and launch
        const profile = loadCharacterProfile();
        const save = createNewSave(this.selectedSlotForNewGame, this.selectedMode, profile);
        this.hide();
        this.options.onStartGame(this.selectedMode, save);
      });
    });
  }

  /**
   * Modal: Load Game (Slots 1, 2, 3)
   */
  private showLoadGameModal(): void {
    const modalHost = this.container.querySelector("#sm-modal-container");
    if (!modalHost) return;

    const renderSlots = () => {
      const slots = getSaveSlots();
      modalHost.innerHTML = `
        <div class="sm-modal-overlay">
          <div class="sm-modal-card sm-modal-lg">
            <div class="sm-modal-header">
              <h3>Load Game</h3>
              <button class="sm-modal-close" id="sm-load-game-close">&times;</button>
            </div>

            <div class="sm-modal-body">
              <div class="sm-slots-grid">
                ${[1, 2, 3]
                  .map((slotNum) => {
                    const slot = slots[slotNum - 1];
                    if (!slot) {
                      return `
                        <div class="sm-slot-card empty">
                          <div class="sm-slot-header">
                            <span class="sm-slot-tag">Slot ${slotNum}</span>
                            <span class="sm-slot-status">Empty</span>
                          </div>
                          <div class="sm-slot-empty-content">
                            <span class="sm-slot-empty-icon">📭</span>
                            <p>No saved progress in this slot.</p>
                          </div>
                          <button class="modal-btn modal-btn-secondary sm-btn-slot-start" data-slot="${slotNum}">Start Game Here</button>
                        </div>
                      `;
                    }

                    const homeroomInfo = HOMEROOM_INFO[slot.profile.homeroom] || HOMEROOM_INFO.UCLA;
                    const formattedDate = new Date(slot.lastSaved).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    const stampPct = Math.round((slot.objectives.stampsCount / 16) * 100);

                    return `
                      <div class="sm-slot-card active">
                        <div class="sm-slot-header">
                          <span class="sm-slot-tag">Slot ${slotNum}</span>
                          <span class="sm-slot-mode-tag">${slot.mode === "singleplayer" ? "Single Player" : "Multiplayer"}</span>
                        </div>
                        <div class="sm-slot-char-row">
                          <span class="sm-slot-avatar-badge" style="background: ${homeroomInfo.shirtColor}">${slot.profile.name.charAt(0).toUpperCase()}</span>
                          <div class="sm-slot-char-meta">
                            <div class="sm-slot-char-name">${slot.name}</div>
                            <div class="sm-slot-homeroom" style="color: ${homeroomInfo.shirtColor}">Homeroom: ${slot.profile.homeroom}</div>
                          </div>
                        </div>

                        <div class="sm-slot-progress-block">
                          <div class="sm-slot-progress-labels">
                            <span>Objectives / Stamps</span>
                            <span class="sm-slot-stamp-count">${slot.objectives.stampsCount} / 16 Stamps</span>
                          </div>
                          <div class="sm-progress-track">
                            <div class="sm-progress-fill" style="width: ${stampPct}%"></div>
                          </div>
                        </div>

                        <div class="sm-slot-saved-time">Last played: ${formattedDate}</div>

                        <div class="sm-slot-actions">
                          <button class="modal-btn modal-btn-primary sm-btn-slot-load" data-slot="${slotNum}">▶ Load Game</button>
                          <button class="modal-btn modal-btn-danger sm-btn-slot-delete" data-slot="${slotNum}" title="Delete this save">🗑</button>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>

            <div class="sm-modal-footer">
              <button id="sm-load-close-btn" class="modal-btn modal-btn-secondary">Back to Start Menu</button>
            </div>
          </div>
        </div>
      `;

      // Close handlers
      modalHost.querySelector("#sm-load-game-close")?.addEventListener("click", () => {
        modalHost.innerHTML = "";
      });
      modalHost.querySelector("#sm-load-close-btn")?.addEventListener("click", () => {
        modalHost.innerHTML = "";
      });

      // Load Game buttons
      modalHost.querySelectorAll<HTMLElement>(".sm-btn-slot-load").forEach((btn) => {
        btn.addEventListener("click", () => {
          const slotNum = parseInt(btn.dataset.slot || "1", 10);
          const save = loadSlot(slotNum);
          if (save) {
            setActiveSlotId(slotNum);
            modalHost.innerHTML = "";
            this.hide();
            this.options.onStartGame(save.mode, save);
          }
        });
      });

      // Start in Empty Slot buttons
      modalHost.querySelectorAll<HTMLElement>(".sm-btn-slot-start").forEach((btn) => {
        btn.addEventListener("click", () => {
          const slotNum = parseInt(btn.dataset.slot || "1", 10);
          modalHost.innerHTML = "";
          this.selectedSlotForNewGame = slotNum;
          this.showNewGameModal();
        });
      });

      // Delete Slot buttons
      modalHost.querySelectorAll<HTMLElement>(".sm-btn-slot-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          const slotNum = parseInt(btn.dataset.slot || "1", 10);
          if (confirm(`Are you sure you want to delete Slot ${slotNum}? This cannot be undone.`)) {
            deleteSlot(slotNum);
            renderSlots();
          }
        });
      });
    };

    renderSlots();
  }
}
