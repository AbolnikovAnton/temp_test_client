const serverUrl = "https://temp-test-server-anton-tonic.onrender.com/chat";

const STORAGE_KEY = "chats";
const MAX_INPUT_CHARS = 10000;
const CHUNK_SIZE = 8000;
const SUMMARY_TRIGGER_MESSAGES = 12;
const SUMMARY_TAIL_MESSAGES = 10;

let chats = loadChats();
let isSending = false;
let currentChatId = "";
currentChatId = initCurrentChat();

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
    Spent: $${tokenStats.cost.toFixed(4)}<br/>
    Input: ${tokenStats.input} tokens<br/>
    Output: ${tokenStats.output} tokens
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

function getChatListTitle(chat) {
  return (
    chat.title ||
    chat.messages.find((message) => message.role === "user")?.content?.slice(
      0,
      40,
    ) ||
    "New chat"
  );
}

function getChatListPreview(chat) {
  for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
    const content = chat.messages[i]?.content?.trim();
    if (content) {
      return content.replace(/\s+/g, " ").slice(0, 72);
    }
  }

  return "Empty conversation";
}

function renderChatList() {
  const chatList = document.getElementById("chatList");
  if (!chatList) return;

  chatList.innerHTML = "";

  Object.entries(chats).forEach(([id, chat]) => {
    const item = document.createElement("div");
    item.className = "chat-list-item";

    if (id === currentChatId) {
      item.classList.add("active");
    }

    const mainButton = document.createElement("button");
    mainButton.type = "button";
    mainButton.className = "chat-list-main";
    mainButton.onclick = () => {
      currentChatId = id;
      renderChatList();
      renderMessages();
    };

    const title = document.createElement("span");
    title.className = "chat-list-title";
    title.textContent = getChatListTitle(chat);

    const preview = document.createElement("span");
    preview.className = "chat-list-preview";
    preview.textContent = getChatListPreview(chat);

    const meta = document.createElement("span");
    meta.className = "chat-list-meta";
    meta.textContent = `${chat.messages.length} messages`;

    mainButton.append(title, preview, meta);

    const tools = document.createElement("div");
    tools.className = "chat-list-tools";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "icon-button";
    renameButton.textContent = "Rename";
    renameButton.setAttribute("aria-label", "Rename chat");
    renameButton.onclick = (event) => {
      event.stopPropagation();
      renameChat(id);
    };

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button danger";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", "Delete chat");
    deleteButton.onclick = (event) => {
      event.stopPropagation();
      deleteChat(id);
    };

    tools.append(renameButton, deleteButton);
    item.append(mainButton, tools);
    chatList.appendChild(item);
  });

  const actions = document.createElement("div");
  actions.className = "chat-list-actions";
  actions.innerHTML = `
    <button type="button" onclick="exportChats()">Export</button>
    <input type="file" id="importInput" accept=".json" hidden />
    <button type="button" onclick="document.getElementById('importInput').click()">Import</button>
  `;
  chatList.appendChild(actions);

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

      for (let i = 0; i < parts.length; i += 1) {
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
    chat.messages.find((message) => message.role === "user")?.content || "";
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

  const link = document.createElement("a");
  link.href = url;
  link.download = "my_chats.json";
  link.click();

  URL.revokeObjectURL(url);
}

function importChats(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const imported = JSON.parse(loadEvent.target.result);
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
  }

  if (input) {
    input.addEventListener("input", updateCharCounter);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
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
