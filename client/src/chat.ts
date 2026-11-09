import { getSocket } from "./net";

export interface ChatReactions {
  likes: string[];
  hearts: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isPrivate: boolean;
  recipientName?: string;
  recipientId?: string;
  isSystem?: boolean;
  reactions: ChatReactions;
}

export interface OnlineUser {
  socketId: string;
  name: string;
}

let updateNameCallback: ((name: string) => void) | null = null;

export function setLocalPlayerName(name: string): void {
  const clean = name.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").slice(0, 16);
  if (!clean) return;
  localStorage.setItem("eld_player_name", clean);
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit("player:rename", { name: clean });
  }
  if (updateNameCallback) {
    updateNameCallback(clean);
  }
}

export function initChat(): void {
  const socket = getSocket();

  let myName = localStorage.getItem("eld_player_name") || "";
  let myId = socket.id || "";
  let onlineUsers: OnlineUser[] = [];
  const messages: ChatMessage[] = [];
  let activeTab: "all" | "private" = "all";
  let selectedRecipient = "";
  let isCollapsed = false;
  let unreadCount = 0;

  // Render Chat UI into DOM
  const chatContainer = document.createElement("div");
  chatContainer.id = "chat-widget";
  chatContainer.className = "chat-widget";
  chatContainer.innerHTML = `
    <!-- Collapsed pill button -->
    <div id="chat-collapsed-pill" class="chat-collapsed-pill" style="display: none;">
      <span class="chat-pill-icon">💬</span>
      <span class="chat-pill-title">Chat</span>
      <span id="chat-pill-badge" class="chat-unread-badge" style="display: none;">0</span>
    </div>

    <!-- Main Chat Window -->
    <div id="chat-window" class="chat-window">
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-header-title">
          <span class="chat-logo">💬</span>
          <span class="chat-title-text">Campus Chat</span>
          <span class="chat-online-pill">
            <span class="chat-online-dot"></span>
            <span id="chat-online-count">1 online</span>
          </span>
        </div>
        <div class="chat-header-actions">
          <button id="chat-profile-btn" class="chat-profile-btn" title="Click to change your username">
            <span class="chat-user-icon">👤</span>
            <span id="chat-my-name-display" class="chat-my-name">${escapeHtml(myName || "You")}</span>
            <span class="chat-edit-icon">✎</span>
          </button>
          <button id="chat-collapse-btn" class="chat-header-btn" title="Minimize chat">─</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="chat-tabs">
        <button id="chat-tab-all" class="chat-tab active">
          <span>🌐 Server (All)</span>
        </button>
        <button id="chat-tab-private" class="chat-tab">
          <span>🔒 Private DM</span>
          <span id="chat-dm-badge" class="chat-tab-badge" style="display: none;">●</span>
        </button>
      </div>

      <!-- Private DM Selector Bar (visible in Private tab) -->
      <div id="chat-dm-bar" class="chat-dm-bar" style="display: none;">
        <span class="chat-dm-label">To:</span>
        <select id="chat-recipient-select" class="chat-recipient-select">
          <option value="">Select an online player...</option>
        </select>
        <button id="chat-clear-recipient-btn" class="chat-clear-btn" title="Clear recipient">✕</button>
      </div>

      <!-- System Notice Banner (errors/status) -->
      <div id="chat-notice-banner" class="chat-notice-banner" style="display: none;"></div>

      <!-- Message History Container -->
      <div id="chat-messages" class="chat-messages">
        <div class="chat-empty-hint">Welcome to the server! Say hello or type @username to start a private conversation.</div>
      </div>

      <!-- Input Bar -->
      <div class="chat-input-bar">
        <div id="chat-dm-indicator" class="chat-dm-indicator" style="display: none;">
          <span class="chat-dm-lock">🔒 Direct Message to</span>
          <span id="chat-dm-target-name" class="chat-dm-target">@Target</span>
          <button id="chat-cancel-dm-btn" class="chat-cancel-dm" title="Cancel DM">✕</button>
        </div>
        <div class="chat-input-row">
          <input
            id="chat-input"
            type="text"
            class="chat-input"
            placeholder="Type a message... (or @name for DM)"
            maxlength="500"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="chat-send-btn" class="chat-send-btn" title="Send (Enter)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(chatContainer);

  // Cache elements
  const chatWindow = document.getElementById("chat-window") as HTMLElement;
  const collapsedPill = document.getElementById("chat-collapsed-pill") as HTMLElement;
  const pillBadge = document.getElementById("chat-pill-badge") as HTMLElement;
  const collapseBtn = document.getElementById("chat-collapse-btn") as HTMLElement;
  const tabAll = document.getElementById("chat-tab-all") as HTMLElement;
  const tabPrivate = document.getElementById("chat-tab-private") as HTMLElement;
  const dmBar = document.getElementById("chat-dm-bar") as HTMLElement;
  const recipientSelect = document.getElementById("chat-recipient-select") as HTMLSelectElement;
  const clearRecipientBtn = document.getElementById("chat-clear-recipient-btn") as HTMLElement;
  const noticeBanner = document.getElementById("chat-notice-banner") as HTMLElement;
  const messagesEl = document.getElementById("chat-messages") as HTMLElement;
  const chatInput = document.getElementById("chat-input") as HTMLInputElement;
  const sendBtn = document.getElementById("chat-send-btn") as HTMLElement;
  const dmIndicator = document.getElementById("chat-dm-indicator") as HTMLElement;
  const dmTargetName = document.getElementById("chat-dm-target-name") as HTMLElement;
  const cancelDmBtn = document.getElementById("chat-cancel-dm-btn") as HTMLElement;
  const profileBtn = document.getElementById("chat-profile-btn") as HTMLElement;
  const myNameDisplay = document.getElementById("chat-my-name-display") as HTMLElement;
  const onlineCountDisplay = document.getElementById("chat-online-count") as HTMLElement;

  updateNameCallback = (n: string) => {
    myName = n;
    if (myNameDisplay) myNameDisplay.textContent = n;
  };

  // Auto-register with server
  function registerWithServer() {
    socket.emit("player:join", { name: myName });
  }

  if (socket.connected) {
    registerWithServer();
  } else {
    socket.on("connect", () => {
      myId = socket.id || "";
      registerWithServer();
    });
  }

  // Socket: Player assignment
  socket.on("player:assigned", (data: { name: string; socketId: string }) => {
    myName = data.name;
    myId = data.socketId || socket.id || "";
    localStorage.setItem("eld_player_name", myName);
    if (myNameDisplay) myNameDisplay.textContent = myName;
  });

  // Socket: Online Users
  socket.on("chat:users", (users: OnlineUser[]) => {
    onlineUsers = users;
    const count = users.length;
    onlineCountDisplay.textContent = `${count} online`;

    // Refresh recipient select options
    const prevSelected = selectedRecipient;
    recipientSelect.innerHTML = `<option value="">Select an online player...</option>`;
    for (const u of users) {
      if (u.name.toLowerCase() === myName.toLowerCase()) continue; // skip self
      const opt = document.createElement("option");
      opt.value = u.name;
      opt.textContent = `@${u.name}`;
      if (u.name === prevSelected) opt.selected = true;
      recipientSelect.appendChild(opt);
    }
  });

  // Socket: Message History
  socket.on("chat:history", (history: ChatMessage[]) => {
    messages.length = 0;
    for (const msg of history) {
      messages.push(msg);
    }
    renderMessages();
  });

  // Socket: New Message
  socket.on("chat:message", (msg: ChatMessage) => {
    // Avoid duplicate
    if (!messages.some((m) => m.id === msg.id)) {
      messages.push(msg);
    }
    if (isCollapsed) {
      unreadCount++;
      updateUnreadPill();
    }
    renderMessages();
    scrollToBottom();
  });

  // Socket: Reaction Updated
  socket.on("chat:reaction_updated", (data: { messageId: string; reactions: ChatReactions }) => {
    const existing = messages.find((m) => m.id === data.messageId);
    if (existing) {
      existing.reactions = data.reactions;
      updateMessageReactionsInDom(data.messageId, data.reactions);
    }
  });

  // Socket: Chat Error / System Notice
  socket.on("chat:error", (data: { text: string }) => {
    showNotice(data.text, "error");
  });

  function showNotice(text: string, type: "error" | "info" = "info") {
    noticeBanner.textContent = text;
    noticeBanner.className = `chat-notice-banner ${type}`;
    noticeBanner.style.display = "block";
    setTimeout(() => {
      noticeBanner.style.display = "none";
    }, 4500);
  }

  // Collapse / Expand toggle
  function setCollapsed(collapsed: boolean) {
    isCollapsed = collapsed;
    if (collapsed) {
      chatWindow.style.display = "none";
      collapsedPill.style.display = "flex";
      updateUnreadPill();
    } else {
      chatWindow.style.display = "flex";
      collapsedPill.style.display = "none";
      unreadCount = 0;
      updateUnreadPill();
      scrollToBottom();
    }
  }

  function updateUnreadPill() {
    if (unreadCount > 0) {
      pillBadge.style.display = "inline-flex";
      pillBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    } else {
      pillBadge.style.display = "none";
    }
  }

  collapseBtn.addEventListener("click", () => setCollapsed(true));
  collapsedPill.addEventListener("click", () => setCollapsed(false));

  // Tabs switching
  tabAll.addEventListener("click", () => {
    activeTab = "all";
    tabAll.classList.add("active");
    tabPrivate.classList.remove("active");
    dmBar.style.display = "none";
    updateDmIndicator();
    renderMessages();
    scrollToBottom();
  });

  tabPrivate.addEventListener("click", () => {
    activeTab = "private";
    tabPrivate.classList.add("active");
    tabAll.classList.remove("active");
    dmBar.style.display = "flex";
    updateDmIndicator();
    renderMessages();
    scrollToBottom();
  });

  // Recipient selector
  recipientSelect.addEventListener("change", () => {
    selectedRecipient = recipientSelect.value;
    updateDmIndicator();
    renderMessages();
  });

  clearRecipientBtn.addEventListener("click", () => {
    selectedRecipient = "";
    recipientSelect.value = "";
    updateDmIndicator();
    renderMessages();
  });

  cancelDmBtn.addEventListener("click", () => {
    selectedRecipient = "";
    recipientSelect.value = "";
    updateDmIndicator();
  });

  function updateDmIndicator() {
    if (selectedRecipient) {
      dmIndicator.style.display = "flex";
      dmTargetName.textContent = `@${selectedRecipient}`;
      chatInput.placeholder = `Direct message to @${selectedRecipient}...`;
    } else {
      dmIndicator.style.display = "none";
      chatInput.placeholder = activeTab === "private"
        ? "Select an online recipient above or type @name..."
        : "Type a message... (or @name for DM)";
    }
  }

  // Change Profile Username
  profileBtn.addEventListener("click", () => {
    const current = myName;
    const input = prompt("Choose your campus username (1-16 characters):", current);
    if (input !== null) {
      const clean = input.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").slice(0, 16);
      if (clean && clean !== current) {
        myName = clean;
        localStorage.setItem("eld_player_name", myName);
        if (myNameDisplay) myNameDisplay.textContent = myName;
        socket.emit("player:rename", { name: clean });
      }
    }
  });

  // Send message function
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    let isPrivate = activeTab === "private";
    let recipient = selectedRecipient;

    // Check if input begins with @mention
    const match = text.match(/^@([a-zA-Z0-9_\-]+)[:\s]+(.*)$/);
    if (match) {
      isPrivate = true;
      recipient = match[1];
    }

    if (isPrivate && !recipient) {
      showNotice("Please select a recipient or type @username to send a private message.", "error");
      return;
    }

    socket.emit("chat:send", {
      text,
      isPrivate,
      recipientName: recipient,
    });

    chatInput.value = "";
    chatInput.focus();
  }

  sendBtn.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    } else if (e.key === "Escape") {
      chatInput.blur();
    }
  });

  // Global shortcut: press Enter when game canvas is active to quickly focus chat
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement !== chatInput) {
      const target = e.target as HTMLElement | null;
      if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")) {
        e.preventDefault();
        if (isCollapsed) setCollapsed(false);
        chatInput.focus();
      }
    }
  });

  // Render messages
  function renderMessages() {
    // Filter messages based on activeTab
    const filtered = messages.filter((m) => {
      if (m.isSystem) return true;
      if (activeTab === "all") {
        // Show public messages and private messages involving this player
        if (!m.isPrivate) return true;
        return (
          m.senderId === myId ||
          m.senderName.toLowerCase() === myName.toLowerCase() ||
          m.recipientName?.toLowerCase() === myName.toLowerCase()
        );
      } else {
        // "private" tab: only show private messages
        if (!m.isPrivate) return false;
        const involvesMe =
          m.senderId === myId ||
          m.senderName.toLowerCase() === myName.toLowerCase() ||
          m.recipientName?.toLowerCase() === myName.toLowerCase();
        if (!involvesMe) return false;

        // If a specific recipient is selected, filter to conversation with them
        if (selectedRecipient) {
          const target = selectedRecipient.toLowerCase();
          const matchSender = m.senderName.toLowerCase() === target;
          const matchRecipient = m.recipientName?.toLowerCase() === target;
          return matchSender || matchRecipient;
        }
        return true;
      }
    });

    if (filtered.length === 0) {
      messagesEl.innerHTML = `
        <div class="chat-empty-hint">
          ${activeTab === "private"
            ? (selectedRecipient ? `No private messages with @${selectedRecipient} yet.` : "No direct messages yet. Select someone or type @name to start!")
            : "No messages yet. Be the first to say something!"}
        </div>
      `;
      return;
    }

    messagesEl.innerHTML = "";
    for (const msg of filtered) {
      const msgItem = createMessageElement(msg);
      messagesEl.appendChild(msgItem);
    }
  }

  function createMessageElement(msg: ChatMessage): HTMLElement {
    const el = document.createElement("div");
    el.className = `chat-msg-item ${msg.isPrivate ? "private-msg" : ""} ${msg.isSystem ? "system-msg" : ""}`;
    el.id = `chat-msg-${msg.id}`;

    if (msg.isSystem) {
      el.innerHTML = `
        <div class="chat-system-content">
          <span class="chat-sys-icon">⚡</span>
          <span class="chat-sys-text">${escapeHtml(msg.text)}</span>
        </div>
      `;
      return el;
    }

    const isMe = msg.senderId === myId || msg.senderName.toLowerCase() === myName.toLowerCase();
    const timeStr = formatTime(msg.timestamp);
    const colorHex = getUserColor(msg.senderName);

    // Private banner badge if private
    let privateBadgeHtml = "";
    if (msg.isPrivate) {
      if (isMe) {
        privateBadgeHtml = `<span class="chat-dm-tag">🔒 DM to @${escapeHtml(msg.recipientName || "Someone")}</span>`;
      } else {
        privateBadgeHtml = `<span class="chat-dm-tag">🔒 DM from @${escapeHtml(msg.senderName)}</span>`;
      }
    }

    // Highlight @mentions in message body
    const formattedText = formatMessageText(msg.text);

    // Reaction counts and states
    const likeCount = msg.reactions?.likes?.length || 0;
    const heartCount = msg.reactions?.hearts?.length || 0;
    const hasLiked = msg.reactions?.likes?.includes(socket.id || myId);
    const hasHearted = msg.reactions?.hearts?.includes(socket.id || myId);

    el.innerHTML = `
      <div class="chat-msg-header">
        <span class="chat-msg-sender" style="color: ${colorHex};" data-username="${escapeHtml(msg.senderName)}">
          ${escapeHtml(msg.senderName)}
        </span>
        ${privateBadgeHtml}
        <span class="chat-msg-time">${timeStr}</span>
      </div>
      <div class="chat-msg-body">${formattedText}</div>
      <div class="chat-msg-reactions" id="rx-${msg.id}">
        <button class="chat-rx-btn ${hasLiked ? "reacted" : ""}" data-rx="like" title="Like this message">
          <span class="rx-emoji">👍</span>
          <span class="rx-count">${likeCount > 0 ? likeCount : ""}</span>
        </button>
        <button class="chat-rx-btn ${hasHearted ? "reacted heart" : "heart"}" data-rx="heart" title="Heart this message">
          <span class="rx-emoji">❤️</span>
          <span class="rx-count">${heartCount > 0 ? heartCount : ""}</span>
        </button>
      </div>
    `;

    // Clicking username inserts @mention or switches to DM
    const senderSpan = el.querySelector(".chat-msg-sender") as HTMLElement;
    senderSpan?.addEventListener("click", () => {
      const u = senderSpan.dataset.username;
      if (u && u.toLowerCase() !== myName.toLowerCase()) {
        selectedRecipient = u;
        recipientSelect.value = u;
        updateDmIndicator();
        chatInput.value = `@${u} `;
        chatInput.focus();
      }
    });

    // Reaction buttons click handlers
    const rxButtons = el.querySelectorAll(".chat-rx-btn");
    rxButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const rxType = (btn as HTMLElement).dataset.rx as "like" | "heart";
        socket.emit("chat:react", { messageId: msg.id, reaction: rxType });
      });
    });

    return el;
  }

  function updateMessageReactionsInDom(messageId: string, rx: ChatReactions) {
    const rxContainer = document.getElementById(`rx-${messageId}`);
    if (!rxContainer) return;

    const likeCount = rx?.likes?.length || 0;
    const heartCount = rx?.hearts?.length || 0;
    const hasLiked = rx?.likes?.includes(socket.id || myId);
    const hasHearted = rx?.hearts?.includes(socket.id || myId);

    const likeBtn = rxContainer.querySelector('[data-rx="like"]') as HTMLElement;
    const heartBtn = rxContainer.querySelector('[data-rx="heart"]') as HTMLElement;

    if (likeBtn) {
      likeBtn.className = `chat-rx-btn ${hasLiked ? "reacted" : ""}`;
      const countEl = likeBtn.querySelector(".rx-count");
      if (countEl) countEl.textContent = likeCount > 0 ? String(likeCount) : "";
    }

    if (heartBtn) {
      heartBtn.className = `chat-rx-btn ${hasHearted ? "reacted heart" : "heart"}`;
      const countEl = heartBtn.querySelector(".rx-count");
      if (countEl) countEl.textContent = heartCount > 0 ? String(heartCount) : "";
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  function formatMessageText(text: string): string {
    const escaped = escapeHtml(text);
    // Highlight @usernames
    return escaped.replace(/@([a-zA-Z0-9_\-]+)/g, '<span class="chat-mention">@$1</span>');
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getUserColor(username: string): string {
    const colors = [
      "#38bdf8", // Sky blue
      "#a78bfa", // Purple/violet
      "#34d399", // Emerald
      "#fbbf24", // Amber
      "#f472b6", // Pink
      "#4ade80", // Lime
      "#fb923c", // Orange
      "#e879f9", // Fuchsia
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
