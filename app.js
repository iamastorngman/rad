const list = document.getElementById("messages");
const form = document.getElementById("composer");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const fileInput = document.getElementById("fileInput");
const attachButton = document.getElementById("attachButton");
const uploadStatus = document.getElementById("uploadStatus");
let lastId = 0;

function addMessage(message) {
  const welcome = list.querySelector(".welcome");
  if (welcome) welcome.remove();
  const item = document.createElement("article");
  item.className = "message" + (message.username === window.CURRENT_USERNAME ? " mine" : "");
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const date = new Date(message.created_at);
  meta.textContent = `${message.username} · ${date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (message.body) {
    const text = document.createElement("div");
    text.textContent = message.body;
    bubble.appendChild(text);
  }
  if (message.attachment_url) {
    const url = message.attachment_url;
    const name = message.attachment_name || "Shared file";
    if (message.attachment_type === "image") {
      const image = document.createElement("img");
      image.className = "chat-image";
      image.src = url;
      image.alt = name;
      image.loading = "lazy";
      image.addEventListener("click", () => window.open(url, "_blank", "noopener"));
      bubble.appendChild(image);
    } else if (message.attachment_type === "video") {
      const video = document.createElement("video");
      video.className = "chat-video";
      video.src = url;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      bubble.appendChild(video);
    } else {
      const link = document.createElement("a");
      link.className = "file-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "↧  " + name;
      bubble.appendChild(link);
    }
  }
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
    (await response.json()).forEach(addMessage);
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

attachButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (file.size > 24 * 1024 * 1024) {
    alert("That file is too large. The limit is 24 MB.");
    fileInput.value = "";
    return;
  }
  const data = new FormData();
  data.append("file", file);
  attachButton.disabled = true;
  uploadStatus.textContent = "Uploading " + file.name + "…";
  try {
    const response = await fetch("/api/upload", {method:"POST", body:data});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed.");
    addMessage(result);
    uploadStatus.textContent = "File shared.";
    setTimeout(() => { uploadStatus.textContent = ""; }, 2500);
  } catch (error) {
    uploadStatus.textContent = error.message;
    alert(error.message);
  } finally {
    attachButton.disabled = false;
    fileInput.value = "";
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
