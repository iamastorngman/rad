const list = document.getElementById("messages");
const form = document.getElementById("composer");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const attachButton = document.getElementById("attachButton");
const fileInput = document.getElementById("fileInput");
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
    const body = document.createElement("div");
    body.textContent = message.body;
    bubble.appendChild(body);
  }

  if (message.attachment_url) {
    const kind = message.attachment_type;
    if (kind === "image") {
      const image = document.createElement("img");
      image.className = "chat-image";
      image.src = message.attachment_url;
      image.alt = message.attachment_name || "Shared image";
      image.loading = "lazy";
      image.addEventListener("click", () => window.open(image.src, "_blank", "noopener"));
      bubble.appendChild(image);
    } else if (kind === "video") {
      const video = document.createElement("video");
      video.className = "chat-video";
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      const source = document.createElement("source");
      source.src = message.attachment_url;
      video.appendChild(source);
      bubble.appendChild(video);
    } else {
      const link = document.createElement("a");
      link.className = "file-attachment";
      link.href = message.attachment_url;
      link.download = message.attachment_name || "download";
      link.textContent = "↓  " + (message.attachment_name || "Download file");
      bubble.appendChild(link);
    }
    if (message.attachment_name) {
      const name = document.createElement("div");
      name.className = "attachment-name";
      name.textContent = message.attachment_name;
      bubble.appendChild(name);
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

attachButton?.addEventListener("click", () => fileInput?.click());

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
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
  } catch (error) {
    alert(error.message || "Could not upload that file.");
    uploadStatus.textContent = "";
  } finally {
    attachButton.disabled = false;
    fileInput.value = "";
    setTimeout(() => { uploadStatus.textContent = ""; }, 3500);
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
