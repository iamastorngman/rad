const list = document.getElementById("messages");
const form = document.getElementById("composer");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
let lastId = 0;
let hasMessages = false;

function addMessage(message) {
  const welcome = list.querySelector(".welcome");
  if (welcome) welcome.remove();
  hasMessages = true;
  const item = document.createElement("article");
  item.className = "message" + (message.username === window.CURRENT_USERNAME ? " mine" : "");
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const date = new Date(message.created_at);
  meta.textContent = `${message.username} · ${date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = message.body;
  item.append(meta, bubble);
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
  lastId = Math.max(lastId, message.id);
}

async function loadMessages() {
  try {
    const response = await fetch(`/api/messages?after=${lastId}`);
    if (response.status === 401) { location.href = "/login"; return; }
    if (!response.ok) return;
    const messages = await response.json();
    messages.forEach(addMessage);
  } catch (error) {
    console.error("Could not load messages", error);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = input.value.trim();
  if (!body) return;
  sendButton.disabled = true;
  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({body})
    });
    const result = await response.json();
    if (!response.ok) { alert(result.error || "Message could not be sent."); return; }
    addMessage(result);
    input.value = "";
    input.style.height = "39px";
  } catch (error) {
    alert("Could not reach the chat server. Check your connection.");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
input.addEventListener("input", () => {
  input.style.height = "39px";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

loadMessages();
setInterval(loadMessages, 1800);
