const serverUrl = "https://temp-test-server-anton-tonic.onrender.com/chat";

const STORAGE_KEY = "chats";
const MAX_INPUT_CHARS = 10000;
const CHUNK_SIZE = 8000;
const SUMMARY_TRIGGER_MESSAGES = 12;
const SUMMARY_TAIL_MESSAGES = 10;

let chats = loadChats();
let currentChatId = initCurrentChat();
let isSending = false;

const tokenStats = {
  input: 0,
  output: 0,
  cost: 0,
};

function createEmptyChat() {
  return {
    title: "",
    summary: "",
    lastSummarizedCount: 0,
    messages: [],
  };
}

function normalizeChatRecord(rawChat) {
  if (Array.isArray(rawChat)) {
    return {
      title: "",
      summary: "",
      lastSummarizedCount: 0,
      messages: rawChat.filter((item) => item && item.role && item.content),
    };
  }

  return {
    title: rawChat?.title || "",
    summary: rawChat?.summary || "",
    lastSummarizedCount: rawChat?.lastSummarizedCount || 0,
    messages: Array.isArray(rawChat?.messages)
      ? rawChat.messages.filter((item) => item && item.role && item.content)
      : [],
  };
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    const normalized = {};

    for (const id of Object.keys(parsed)) {
      normalized[id] = normalizeChatRecord(parsed[id]);
    }

    return normalized;
  } catch (err) {
    console.error("Failed to load chats:", err);
    return {};
  }
}

function saveChats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error("Failed to save chats:", err);
    alert(
      "Could not save chat history. Browser storage may be full. Try exporting and removing old chats.",
    );
  }
}

function initCurrentChat() {
  const ids = Object.keys(chats);
  if (ids.length > 0) return ids[0];
  return createNewChat();
}

function getCurrentChat() {
  if (!chats[currentChatId]) {
    chats[currentChatId] = createEmptyChat();
  }
  return chats[currentChatId];
}

function createNewChat() {
  const id = `chat_${Date.now()}`;
  chats[id] = createEmptyChat();
  currentChatId = id;
  saveChats();
  renderChatList();
  renderMessages();
  renderEmptyState();
  return id;
}

function addMessage(role, content) {
  const chat = getCurrentChat();
  chat.messages.push({ role, content });
  saveChats();
  renderChatList();
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 3.7);
}

function updateStatsUI() {
  const stats = document.getElementById("usageStats");
  if (!stats) return;

  stats.innerHTML = `
    💰 Spent: $${tokenStats.cost.toFixed(4)}<br/>
    🔁 Input: ${tokenStats.input} tokens<br/>
    📤 Output: ${tokenStats.output} tokens
  `;
}

function renderEmptyState() {
  const chat = getCurrentChat();
  const chatBox = document.getElementById("chatBox");
  if (!chatBox || !chat) return;

  if (!chat.messages.length) {
    chatBox.innerHTML = `<div class="empty-state">Start a new conversation</div>`;
  }
}

function renderMessages() {
  const chatBox = document.getElementById("chatBox");
  const chat = getCurrentChat();
  if (!chatBox || !chat) return;

  chatBox.innerHTML = "";

  if (!chat.messages.length) {
    renderEmptyState();
    return;
  }

  chat.messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `msg ${msg.role}`;

    if (msg.role === "assistant") {
      const rawHtml = marked.parse(msg.content || "", {
        breaks: true,
        gfm: true,
      });

      div.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
    } else {
      div.textContent = msg.content;
    }

    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderChatList() {
  const chatList = document.getElementById("chatList");
  if (!chatList) return;

  chatList.innerHTML = "";

  Object.entries(chats).forEach(([id, chat]) => {
    const container = document.createElement("div");
    container.className = "chat-list-item";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.marginBottom = "5px";

    if (id === currentChatId) {
      container.classList.add("active");
    }

    const btn = document.createElement("button");
    const title =
      chat.title ||
      chat.messages.find((m) => m.role === "user")?.content?.slice(0, 40) ||
      "New chat";

    btn.textContent = title;
    btn.style.flex = "1";
    btn.onclick = () => {
      currentChatId = id;
      renderChatList();
      renderMessages();
    };

    const tools = document.createElement("div");
    tools.style.display = "flex";
    tools.style.gap = "5px";

    const renameBtn = document.createElement("button");
    renameBtn.textContent = "✏️";
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      renameChat(id);
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(id);
    };

    tools.appendChild(renameBtn);
    tools.appendChild(deleteBtn);

    container.appendChild(btn);
    container.appendChild(tools);
    chatList.appendChild(container);
  });

  const extra = document.createElement("div");
  extra.innerHTML = `
    <button onclick="exportChats()">📁 Export</button>
    <input type="file" id="importInput" accept=".json" hidden />
    <button onclick="document.getElementById('importInput').click()">📂 Import</button>
  `;
  extra.style.marginTop = "10px";
  chatList.appendChild(extra);

  const importInput = document.getElementById("importInput");
  if (importInput) {
    importInput.onchange = importChats;
  }
}

function toggleTyping(show) {
  const typing = document.getElementById("typing");
  if (!typing) return;
  typing.classList.toggle("hidden", !show);
}

function setSendingState(sending) {
  isSending = sending;

  const sendBtn = document.getElementById("sendBtn");
  const input = document.getElementById("userInput");

  if (sendBtn) sendBtn.disabled = sending;
  if (input) input.disabled = sending;
}

function buildMessagesForAPI(chunkMessage = null) {
  const chat = getCurrentChat();
  const baseMessages = chat.messages;

  let messages = [];

  if (chat.summary) {
    messages.push({
      role: "system",
      content: `Summary of previous conversation: ${chat.summary}`,
    });
    messages.push(...baseMessages.slice(-SUMMARY_TAIL_MESSAGES));
  } else {
    messages.push(...baseMessages);
  }

  if (chunkMessage) {
    messages.push({ role: "user", content: chunkMessage });
  }

  return messages;
}

async function sendMessage() {
  if (isSending) return;

  const input = document.getElementById("userInput");
  if (!input) return;

  const fullMessage = input.value.trim();
  if (!fullMessage) return;

  input.value = "";
  updateCharCounter();
  setSendingState(true);
  toggleTyping(true);

  try {
    if (fullMessage.length <= MAX_INPUT_CHARS) {
      await handleChunk(fullMessage, 1, 1);
    } else {
      const parts = [];
      for (let i = 0; i < fullMessage.length; i += CHUNK_SIZE) {
        parts.push(fullMessage.slice(i, i + CHUNK_SIZE));
      }

      for (let i = 0; i < parts.length; i++) {
        await handleChunk(parts[i], i + 1, parts.length);
      }
    }
  } finally {
    toggleTyping(false);
    setSendingState(false);
  }
}

async function handleChunk(text, partNum, totalParts) {
  const isLast = partNum === totalParts;
  const prefix = totalParts > 1 ? `Part ${partNum}/${totalParts}:\n` : "";
  const suffix =
    isLast && totalParts > 1
      ? "\nFinal part. Please process the whole text as a single message."
      : "";

  const chunkMessage = prefix + text + suffix;

  addMessage("user", chunkMessage);
  renderMessages();

  try {
    const messages = buildMessagesForAPI();

    const res = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const reply = data.reply || "Empty response";

    addMessage("assistant", reply);
    renderMessages();

    const inputTokens = estimateTokens(chunkMessage);
    const outputTokens = estimateTokens(reply);
    const totalCost =
      (inputTokens / 1000) * 0.005 + (outputTokens / 1000) * 0.015;

    tokenStats.input += inputTokens;
    tokenStats.output += outputTokens;
    tokenStats.cost += totalCost;

    updateStatsUI();
    await maybeSummarize();
  } catch (err) {
    console.error(err);

    let errorText = "Request failed";
    if (err.message?.includes("Failed to fetch")) {
      errorText = "Could not connect to server. Please try again in a moment.";
    } else if (err.message) {
      errorText = err.message;
    }

    addMessage("assistant", `Error: ${errorText}`);
    renderMessages();
  }
}

async function maybeSummarize() {
  const chat = getCurrentChat();
  if (!chat) return;

  const totalMessages = chat.messages.length;
  const unsummarizedCount = totalMessages - (chat.lastSummarizedCount || 0);

  if (unsummarizedCount < SUMMARY_TRIGGER_MESSAGES) return;

  const sliceStart = Math.max(0, totalMessages - 20);
  const recentMessages = chat.messages.slice(sliceStart);

  const summaryPrompt = [
    {
      role: "system",
      content:
        "Create a concise rolling summary of this conversation. Capture key context, goals, decisions, problems, and solutions. Do not invent anything. Keep it compact and useful for continuing the chat later.",
    },
  ];

  if (chat.summary) {
    summaryPrompt.push({
      role: "system",
      content: `Existing summary: ${chat.summary}`,
    });
  }

  summaryPrompt.push(...recentMessages);

  try {
    const res = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: summaryPrompt }),
    });

    if (!res.ok) {
      throw new Error(`Summary failed: ${res.status}`);
    }

    const data = await res.json();

    if (data.reply) {
      chat.summary = data.reply;
      chat.lastSummarizedCount = totalMessages;
      saveChats();
    }
  } catch (err) {
    console.warn("Failed to summarize chat history:", err);
  }
}

function renameChat(id) {
  const chat = chats[id];
  const firstUserMessage =
    chat.messages.find((m) => m.role === "user")?.content || "";
  const suggested = (chat.title || firstUserMessage).slice(0, 40);
  const newTitle = prompt("New chat name:", suggested);

  if (newTitle && newTitle.trim()) {
    chat.title = newTitle.trim();
    saveChats();
    renderChatList();
  }
}

function deleteChat(id) {
  if (!confirm("Delete this chat?")) return;

  delete chats[id];

  const remaining = Object.keys(chats);
  if (!remaining.length) {
    createNewChat();
  } else {
    currentChatId = remaining[0];
    saveChats();
    renderChatList();
    renderMessages();
  }
}

function exportChats() {
  const dataStr = JSON.stringify(chats, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "my_chats.json";
  a.click();

  URL.revokeObjectURL(url);
}

function importChats(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      const normalized = {};

      for (const id of Object.keys(imported)) {
        normalized[id] = normalizeChatRecord(imported[id]);
      }

      chats = { ...chats, ...normalized };
      saveChats();
      renderChatList();
      renderMessages();
    } catch (err) {
      alert(`Unable to import file: ${err.message}`);
    }
  };

  reader.readAsText(file);
}

function updateCharCounter() {
  const input = document.getElementById("userInput");
  const charCountDisplay = document.getElementById("charCount");
  if (!input || !charCountDisplay) return;

  const length = input.value.length;
  charCountDisplay.textContent = length;

  const counterEl = charCountDisplay.parentElement;
  if (!counterEl) return;

  counterEl.classList.remove("warning", "danger");

  if (length > MAX_INPUT_CHARS * 0.8 && length < MAX_INPUT_CHARS) {
    counterEl.classList.add("warning");
  } else if (length >= MAX_INPUT_CHARS) {
    counterEl.classList.add("danger");
  }
}

let isAppInitialized = false;

function initApp() {
  if (isAppInitialized) return;
  isAppInitialized = true;

  const input = document.getElementById("userInput");
  const newChatBtn = document.getElementById("newChatBtn");
  const sendBtn = document.getElementById("sendBtn");

  if (newChatBtn) {
    newChatBtn.onclick = createNewChat;
  }

  if (sendBtn) {
    sendBtn.onclick = sendMessage;
    sendBtn.addEventListener("click", sendMessage);
    sendBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  if (input) {
    input.addEventListener("input", updateCharCounter);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  renderChatList();
  renderMessages();
  renderEmptyState();
  updateStatsUI();
  updateCharCounter();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

window.addEventListener("load", initApp);
