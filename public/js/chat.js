const socket = io();

const messageForm =
  document.getElementById("messageForm");

const messageInput =
  document.getElementById("messageInput");

const messages =
  document.getElementById("messages");

const onlineUsers =
  document.getElementById("onlineUsers");

const typingIndicator =
  document.getElementById("typingIndicator");

// ====================================
// JOIN ROOM
// ====================================

socket.emit("joinRoom", {
  username: CURRENT_USER,
  room: CURRENT_ROOM
});

// ====================================
// SEND MESSAGE
// ====================================

messageForm.addEventListener("submit", (event) => {

  event.preventDefault();

  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  socket.emit("chatMessage", {
    username: CURRENT_USER,
    message,
    room: CURRENT_ROOM
  });

  messageInput.value = "";

  socket.emit("stopTyping", {
    room: CURRENT_ROOM
  });

  messageInput.focus();
});

// ====================================
// RECEIVE MESSAGE
// ====================================

socket.on("message", (data) => {

  const messageDiv =
    document.createElement("div");

  messageDiv.classList.add("message");

  if (data.username === CURRENT_USER) {
    messageDiv.classList.add("my-message");
  }

  const time =
    new Date(data.createdAt).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  const avatar =
    data.username
      .charAt(0)
      .toUpperCase();

  const avatarDiv =
    document.createElement("div");

  avatarDiv.className = "message-avatar";
  avatarDiv.textContent = avatar;

  const contentDiv =
    document.createElement("div");

  contentDiv.className = "message-content";

  const infoDiv =
    document.createElement("div");

  infoDiv.className = "message-info";

  const strong =
    document.createElement("strong");

  strong.textContent = data.username;

  const timeSpan =
    document.createElement("span");

  timeSpan.textContent = time;

  infoDiv.appendChild(strong);
  infoDiv.appendChild(timeSpan);

  const text =
    document.createElement("p");

  text.textContent = data.message;

  contentDiv.appendChild(infoDiv);
  contentDiv.appendChild(text);

  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);

  messages.appendChild(messageDiv);

  scrollToBottom();
});

// ====================================
// SYSTEM MESSAGE
// ====================================

socket.on("systemMessage", (data) => {

  const systemMessage =
    document.createElement("div");

  systemMessage.className =
    "system-message";

  systemMessage.textContent =
    data.message;

  messages.appendChild(systemMessage);

  scrollToBottom();
});

// ====================================
// ONLINE USERS
// ====================================

socket.on("onlineUsers", (users) => {

  onlineUsers.innerHTML = "";

  users.forEach((username) => {

    const li =
      document.createElement("li");

    const dot =
      document.createElement("span");

    dot.textContent = "●";

    li.appendChild(dot);

    li.appendChild(
      document.createTextNode(
        ` ${username}`
      )
    );

    onlineUsers.appendChild(li);
  });
});

// ====================================
// TYPING
// ====================================

let typingTimeout;

messageInput.addEventListener("input", () => {

  socket.emit("typing", {
    username: CURRENT_USER,
    room: CURRENT_ROOM
  });

  clearTimeout(typingTimeout);

  typingTimeout =
    setTimeout(() => {

      socket.emit("stopTyping", {
        room: CURRENT_ROOM
      });

    }, 1000);
});

socket.on("typing", (data) => {

  typingIndicator.textContent =
    `${data.username} is typing...`;

});

socket.on("stopTyping", () => {

  typingIndicator.textContent = "";

});

// ====================================
// SCROLL
// ====================================

function scrollToBottom() {

  messages.scrollTop =
    messages.scrollHeight;

}

scrollToBottom();