const serverUrl = "https://temp-test-server-anton-tonic.onrender.com/chat";

let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChatId;

if (Object.keys(chats).length > 0) {
  currentChatId = Object.keys(chats)[0];
} else {
  createNewChat();
}

function createNewChat() {
  const id = "chat_" + Date.now();
  chats[id] = [];
  currentChatId = id;
  saveChats();
  renderChatList();
  renderMessages();
  return id;
}

let tokenStats = {
  input: 0,
  output: 0,
  cost: 0,
};

async function sendMessage() {
  const input = document.getElementById("userInput");
  const fullMessage = input.value.trim();
  if (!fullMessage) return;

  input.value = "";
  toggleTyping(true);

  const maxChunkSize = 8000;

  if (fullMessage.length <= 10000) {
    await handleChunk(fullMessage, 1, 1);
    toggleTyping(false);
    return;
  }

  const parts = [];
  for (let i = 0; i < fullMessage.length; i += maxChunkSize) {
    parts.push(fullMessage.slice(i, i + maxChunkSize));
  }

  for (let i = 0; i < parts.length; i++) {
    await handleChunk(parts[i], i + 1, parts.length);
  }

  toggleTyping(false);
}

async function handleChunk(text, partNum, totalParts) {
  const isLast = partNum === totalParts;
  const prefix = totalParts > 1 ? `Часть ${partNum}/${totalParts}:\n` : "";
  const suffix =
    isLast && totalParts > 1
      ? "\nЗаключительная часть. Пожалуйста, обработай весь текст целиком."
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

    const data = await res.json();
    addMessage("assistant", data.reply || "❓ Пустой ответ");
    renderMessages();

    const inputTokens = estimateTokens(chunkMessage);
    const outputTokens = estimateTokens(data.reply || "");
    const total = inputTokens * 0.005 + outputTokens * 0.015;
    const safeCost = Math.max(total, 0.0001);

    tokenStats.input += inputTokens;
    tokenStats.output += outputTokens;
    tokenStats.cost += safeCost;

    updateStatsUI();
    maybeSummarize();
  } catch (e) {
    addMessage("assistant", "❌ Ошибка запроса");
    renderMessages();
  }
}

function buildMessagesForAPI() {
  const raw = chats[currentChatId] || [];
  const summary = chats[currentChatId].summary;

  if (summary) {
    return [
      { role: "system", content: `Резюме предыдущего диалога: ${summary}` },
      ...raw.slice(-10),
    ];
  }

  return raw;
}

async function maybeSummarize() {
  const raw = chats[currentChatId];
  if (!raw || raw.length < 12 || chats[currentChatId].summary) return;

  const summaryPrompt = [
    {
      role: "system",
      content:
        "Сделай краткое резюме диалога: опиши суть обсуждения, ход действий, проблематику и решения. Не добавляй новый текст — только сжать то, что есть.",
    },
    ...raw.slice(0, 12),
  ];

  try {
    const res = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: summaryPrompt }),
    });
    const data = await res.json();

    if (data.reply) {
      chats[currentChatId].summary = data.reply;
      saveChats();
      console.log("💡 Summary сохранено:", data.reply);
    }
  } catch (e) {
    console.warn("Не удалось сжать историю:", e);
  }
}

function estimateTokens(text) {
  return Math.min(Math.ceil(text.length / 3.7), 10000);
}

function updateStatsUI() {
  const stats = document.getElementById("usageStats");
  stats.innerHTML = `
      💰 Потрачено: $${tokenStats.cost.toFixed(3)}<br/>
      🔁 Вход: ${tokenStats.input} токенов<br/>
      📤 Выход: ${tokenStats.output} токенов
    `;
}

function addMessage(role, content) {
  chats[currentChatId].push({ role, content });
  saveChats();
  renderChatList();
}

function renderMessages() {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";

  chats[currentChatId].forEach((msg) => {
    const div = document.createElement("div");
    div.className = "msg " + msg.role;

    if (msg.role === "assistant") {
      div.innerHTML = marked.parse(msg.content);
    } else {
      div.textContent = msg.content;
    }

    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

function toggleTyping(show) {
  const typing = document.getElementById("typing");
  typing.classList.toggle("hidden", !show);
}

function renderChatList() {
  const chatList = document.getElementById("chatList");
  chatList.innerHTML = "";

  Object.entries(chats).forEach(([id, messages]) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.marginBottom = "5px";

    const btn = document.createElement("button");
    const title =
      chats[id].title ||
      messages.find((m) => m.role === "user")?.content?.slice(0, 40) ||
      "Новый чат";
    btn.textContent = title;
    btn.style.flex = "1";
    btn.onclick = () => {
      currentChatId = id;
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
    <button onclick="exportChats()">📁 Экспорт</button>
    <input type="file" id="importInput" accept=".json" hidden />
    <button onclick="document.getElementById('importInput').click()">📂 Импорт</button>
  `;
  extra.style.marginTop = "10px";
  chatList.appendChild(extra);

  document.getElementById("importInput").onchange = importChats;
}

function renameChat(id) {
  const firstUserMessage =
    chats[id].find((m) => m.role === "user")?.content || "";
  const newTitle = prompt("Новое имя чата:", firstUserMessage.slice(0, 40));
  if (newTitle) {
    chats[id].title = newTitle;
    saveChats();
    renderChatList();
  }
}

function deleteChat(id) {
  if (confirm("Удалить этот чат?")) {
    delete chats[id];
    if (currentChatId === id) {
      const remaining = Object.keys(chats);
      currentChatId = remaining[0] || createNewChat();
    }
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
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      chats = { ...chats, ...imported };
      saveChats();
      renderChatList();
      renderMessages();
    } catch (err) {
      alert("Невозможно загрузить файл: " + err.message);
    }
  };
  reader.readAsText(file);
}

function saveChats() {
  localStorage.setItem("chats", JSON.stringify(chats));
}

// Обработка нажатия Enter / Shift+Enter + счётчик символов
const input = document.getElementById("userInput");
const maxChars = 10000;
const charCountDisplay = document.getElementById("charCount");

input.addEventListener("input", () => {
  const length = input.value.length;
  charCountDisplay.textContent = length;

  const counterEl = charCountDisplay.parentElement;
  counterEl.classList.remove("warning", "danger");

  if (length > maxChars * 0.8 && length < maxChars) {
    counterEl.classList.add("warning");
  } else if (length >= maxChars) {
    counterEl.classList.add("danger");
  }
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Инициализация
document.getElementById("newChatBtn").onclick = createNewChat;
renderChatList();
renderMessages();
