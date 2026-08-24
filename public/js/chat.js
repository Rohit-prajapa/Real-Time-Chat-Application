// ====================================
// CHATWAVE - CHAT JAVASCRIPT
// ====================================

const socket = io();

// ====================================
// CHAT ELEMENTS
// ====================================

const chatApp = document.querySelector(".chat-app");
const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const typingIndicator = document.getElementById("typingIndicator");
const allUsers = document.getElementById("allUsers");
const userSearchInput = document.getElementById("userSearchInput");

// ====================================
// CURRENT CHAT DATA
// ====================================

const currentUser = chatApp?.dataset.currentUser || "";
const currentRoom = chatApp?.dataset.currentRoom || "";
const privateChat = chatApp?.dataset.privateChat === "true";
const targetUser = chatApp?.dataset.targetUser || "";

// ====================================
// MESSAGE SEARCH
// ====================================

const messageSearchInput =
  document.getElementById("messageSearchInput");

const clearMessageSearch =
  document.getElementById("clearMessageSearch");

let searchResultCount =
  document.getElementById("searchResultCount");

if (messageSearchInput && !searchResultCount) {
  searchResultCount = document.createElement("span");
  searchResultCount.id = "searchResultCount";
  searchResultCount.className = "search-result-count";

  if (messageSearchInput.parentElement) {
    messageSearchInput.parentElement.appendChild(
      searchResultCount
    );
  }
}

// ====================================
// ESCAPE HTML
// ====================================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// ====================================
// SCROLL TO BOTTOM
// ====================================

function scrollToBottom() {
  if (!messagesContainer) {
    return;
  }

  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;
}

// ====================================
// SEARCH HIGHLIGHT
// ====================================

function highlightText(element, searchText) {
  if (!element) {
    return;
  }

  const originalText =
    element.dataset.originalText ||
    element.textContent ||
    "";

  if (!element.dataset.originalText) {
    element.dataset.originalText = originalText;
  }

  if (!searchText) {
    element.textContent = originalText;
    return;
  }

  const escapedSearch =
    searchText.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const regex =
    new RegExp(`(${escapedSearch})`, "gi");

  const parts = originalText.split(regex);

  element.innerHTML = parts
    .map((part) => {
      if (
        part.toLowerCase() ===
        searchText.toLowerCase()
      ) {
        return `
          <mark class="message-search-highlight">
            ${escapeHtml(part)}
          </mark>
        `;
      }

      return escapeHtml(part);
    })
    .join("");
}

// ====================================
// SEARCH MESSAGES
// ====================================

function searchMessages() {
  if (!messageSearchInput) {
    return;
  }

  const searchText =
    messageSearchInput.value
      .trim()
      .toLowerCase();

  const messageElements =
    document.querySelectorAll(
      "#messages .message"
    );

  let matchCount = 0;

  messageElements.forEach(
    (messageElement) => {
      const textElement =
        messageElement.querySelector(
          ".message-bubble > p"
        );

      if (!textElement) {
        return;
      }

      const originalText =
        textElement.dataset.originalText ||
        textElement.textContent ||
        "";

      if (!textElement.dataset.originalText) {
        textElement.dataset.originalText =
          originalText;
      }

      if (!searchText) {
        messageElement.style.display = "";
        messageElement.classList.remove(
          "search-match"
        );
        messageElement.classList.remove(
          "search-no-match"
        );

        textElement.textContent =
          originalText;

        return;
      }

      if (
        originalText
          .toLowerCase()
          .includes(searchText)
      ) {
        matchCount++;

        messageElement.style.display = "";

        messageElement.classList.add(
          "search-match"
        );

        messageElement.classList.remove(
          "search-no-match"
        );

        highlightText(
          textElement,
          searchText
        );
      } else {
        messageElement.style.display =
          "none";

        messageElement.classList.remove(
          "search-match"
        );

        messageElement.classList.add(
          "search-no-match"
        );

        textElement.textContent =
          originalText;
      }
    }
  );

  if (searchResultCount) {
    if (!searchText) {
      searchResultCount.textContent = "";
    } else if (matchCount === 0) {
      searchResultCount.textContent =
        "No messages found";
    } else {
      searchResultCount.textContent =
        `${matchCount} ${
          matchCount === 1
            ? "message"
            : "messages"
        } found`;
    }
  }
}

// ====================================
// SEARCH INPUT
// ====================================

if (messageSearchInput) {
  messageSearchInput.addEventListener(
    "input",
    searchMessages
  );
}

// ====================================
// CLEAR SEARCH
// ====================================

if (clearMessageSearch) {
  clearMessageSearch.addEventListener(
    "click",
    () => {
      if (!messageSearchInput) {
        return;
      }

      messageSearchInput.value = "";

      searchMessages();

      messageSearchInput.focus();
    }
  );
}

// ====================================
// ESC TO CLEAR SEARCH
// ====================================

if (messageSearchInput) {
  messageSearchInput.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        messageSearchInput.value = "";
        searchMessages();
      }
    }
  );
}

// ====================================
// JOIN PUBLIC ROOM
// ====================================

if (!privateChat && currentRoom) {
  socket.emit("joinRoom", {
    username: currentUser,
    room: currentRoom,
  });
}

// ====================================
// JOIN PRIVATE CHAT
// ====================================

if (
  privateChat &&
  currentUser &&
  targetUser
) {
  socket.emit("joinPrivateChat", {
    username: currentUser,
    receiver: targetUser,
  });
}

// ====================================
// USER ONLINE
// ====================================

if (currentUser) {
  socket.emit("userOnline", {
    username: currentUser,
  });
}

// ====================================
// REPLY STATE
// ====================================

let replyingToMessage = null;

const replyPreview =
  document.getElementById("replyPreview");

const replyPreviewText =
  document.getElementById(
    "replyPreviewText"
  );

const cancelReply =
  document.getElementById("cancelReply");

// ====================================
// SEND MESSAGE
// ====================================

if (messageForm) {
  messageForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const message =
        messageInput?.value.trim();

      if (!message) {
        return;
      }

      const replyData =
        replyingToMessage
          ? {
              messageId:
                replyingToMessage.messageId,
              text:
                replyingToMessage.text,
            }
          : null;

      if (privateChat) {
        socket.emit("privateMessage", {
          username: currentUser,
          receiver: targetUser,
          message,
          replyTo: replyData,
        });
      } else {
        socket.emit("chatMessage", {
          username: currentUser,
          message,
          room: currentRoom,
          replyTo: replyData,
        });
      }

      if (messageInput) {
        messageInput.value = "";
      }

      replyingToMessage = null;

      if (replyPreview) {
        replyPreview.style.display = "none";
      }

      if (replyPreviewText) {
        replyPreviewText.textContent = "";
      }

      stopTyping();

      if (messageInput) {
        messageInput.focus();
      }
    }
  );
}

// ====================================
// RECEIVE PUBLIC MESSAGE
// ====================================

socket.on("message", (message) => {
  if (
    privateChat ||
    !message ||
    message.room !== currentRoom
  ) {
    return;
  }

  addMessage(message);
  scrollToBottom();
});

// ====================================
// RECEIVE PRIVATE MESSAGE
// ====================================

socket.on(
  "privateMessage",
  (message) => {
    if (
      !privateChat ||
      !message
    ) {
      return;
    }

    const validMessage =
      (message.username === currentUser &&
        message.receiver === targetUser) ||
      (message.username === targetUser &&
        message.receiver === currentUser);

    if (!validMessage) {
      return;
    }

    addMessage(message);
    scrollToBottom();

    if (
      message.receiver === currentUser
    ) {
      socket.emit(
        "messageDelivered",
        {
          messageId: message._id,
          username: currentUser,
        }
      );

      socket.emit("messageSeen", {
        messageId: message._id,
        username: currentUser,
      });
    }
  }
);

// ====================================
// ADD MESSAGE
// ====================================

function addMessage(message) {
  if (
    !messagesContainer ||
    !message ||
    !message._id
  ) {
    return;
  }

  const existing =
    document.querySelector(
      `[data-message-id="${message._id}"]`
    );

  if (existing) {
    return;
  }

  // SAFETY FIX:
  // Always convert username to a string.
  const messageUsername =
    String(
      message.username ||
        "Unknown User"
    );

  const isMine =
    messageUsername === currentUser;

  const messageElement =
    document.createElement("div");

  messageElement.className =
    `message ${
      isMine
        ? "my-message"
        : "other-message"
    }`;

  messageElement.dataset.messageId =
    message._id;

  messageElement.dataset.messageDate =
    message.createdAt || "";

  const date =
    message.createdAt
      ? new Date(
          message.createdAt
        ).toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : "";

  // ====================================
  // STATUS
  // ====================================

  let statusHtml = "";

  if (privateChat && isMine) {
    let status = "✓";

    if (message.seen) {
      status = "✓✓";
    } else if (message.delivered) {
      status = "✓✓";
    }

    statusHtml = `
      <span
        class="message-status ${
          message.seen ? "seen" : ""
        }"
        data-status-for="${message._id}"
      >
        ${status}
      </span>
    `;
  }

  // ====================================
  // REPLY
  // ====================================

  const replyHtml =
    message.replyTo
      ? `
        <div class="message-reply">
          <strong>↩️ Reply</strong>
          <span>
            ${escapeHtml(
              message.replyTo.text ||
                ""
            )}
          </span>
        </div>
      `
      : "";

  // ====================================
  // REACTIONS
  // ====================================

  const reactions =
    message.reactions || [];

  const reactionsHtml =
    reactions
      .map(
        (reaction) => `
          <span class="reaction-result">
            ${escapeHtml(
              reaction.emoji || ""
            )}
          </span>
        `
      )
      .join("");

  // ====================================
  // MESSAGE MENU
  // ====================================

  const messageMenu =
    isMine
      ? `
        <div class="message-menu-wrapper">

          <button
            type="button"
            class="message-menu-btn"
            data-message-id="${message._id}"
            title="More options"
          >
            ⋮
          </button>

          <div
            class="message-menu"
            data-menu-for="${message._id}"
          >

            <button
              type="button"
              class="reply-message-btn"
              data-message-id="${message._id}"
            >
              ↩️ Reply
            </button>

            <button
              type="button"
              class="copy-message-btn"
              data-message-id="${message._id}"
            >
              📋 Copy
            </button>

            <button
              type="button"
              class="edit-message-btn"
              data-message-id="${message._id}"
            >
              ✏️ Edit
            </button>

            <button
              type="button"
              class="delete-message-btn"
              data-message-id="${message._id}"
            >
              🗑️ Delete
            </button>

          </div>
        </div>
      `
      : "";

  // ====================================
  // MESSAGE HTML
  // ====================================

  messageElement.innerHTML = `
    <div class="message-avatar">
      ${escapeHtml(
        messageUsername
          .charAt(0)
          .toUpperCase()
      )}
    </div>

    <div class="message-content">

      <div class="message-bubble">

        <div class="message-info">

          <strong>
            ${escapeHtml(
              messageUsername
            )}
          </strong>

          <span>
            ${date}
          </span>

          ${statusHtml}

          ${messageMenu}

        </div>

        ${replyHtml}

        <p
          data-original-text="${escapeHtml(
            message.message || ""
          )}"
        >
          ${escapeHtml(
            message.message || ""
          )}
        </p>

      </div>

      <div class="message-reactions">

        <button
          type="button"
          class="reaction-btn"
          data-message-id="${message._id}"
          data-reaction="❤️"
          title="Love"
        >
          ❤️
        </button>

        <button
          type="button"
          class="reaction-btn"
          data-message-id="${message._id}"
          data-reaction="👍"
          title="Like"
        >
          👍
        </button>

        <button
          type="button"
          class="reaction-btn"
          data-message-id="${message._id}"
          data-reaction="😂"
          title="Laugh"
        >
          😂
        </button>

        <button
          type="button"
          class="reaction-btn"
          data-message-id="${message._id}"
          data-reaction="😮"
          title="Surprised"
        >
          😮
        </button>

        <button
          type="button"
          class="reaction-btn"
          data-message-id="${message._id}"
          data-reaction="😢"
          title="Sad"
        >
          😢
        </button>

        <button
          type="button"
          class="reaction-btn"
          data-message-id="${message._id}"
          data-reaction="🔥"
          title="Fire"
        >
          🔥
        </button>

      </div>

      <div
        class="reaction-results"
        data-reactions-for="${message._id}"
      >
        ${reactionsHtml}
      </div>

    </div>
  `;

  messagesContainer.appendChild(
    messageElement
  );

  attachReactionButtons(
    messageElement
  );

  if (
    messageSearchInput &&
    messageSearchInput.value.trim()
  ) {
    searchMessages();
  }
}

// ====================================
// ADD MENU TO EXISTING MESSAGES
// ====================================

function addMenusToExistingMessages() {
  if (!messagesContainer) {
    return;
  }

  const existingMessages =
    messagesContainer.querySelectorAll(
      ".message"
    );

  existingMessages.forEach(
    (messageElement) => {
      const usernameElement =
        messageElement.querySelector(
          ".message-info strong"
        );

      if (!usernameElement) {
        return;
      }

      const username =
        usernameElement.textContent.trim();

      if (username !== currentUser) {
        return;
      }

      const oldWrapper =
        messageElement.querySelector(
          ".message-menu-wrapper"
        );

      if (oldWrapper) {
        oldWrapper.remove();
      }

      const messageId =
        messageElement.dataset.messageId;

      if (!messageId) {
        return;
      }

      const messageInfo =
        messageElement.querySelector(
          ".message-info"
        );

      if (!messageInfo) {
        return;
      }

      const wrapper =
        document.createElement("div");

      wrapper.className =
        "message-menu-wrapper";

      wrapper.innerHTML = `
        <button
          type="button"
          class="message-menu-btn"
          data-message-id="${messageId}"
          title="More options"
        >
          ⋮
        </button>

        <div
          class="message-menu"
          data-menu-for="${messageId}"
        >

          <button
            type="button"
            class="reply-message-btn"
            data-message-id="${messageId}"
          >
            ↩️ Reply
          </button>

          <button
            type="button"
            class="copy-message-btn"
            data-message-id="${messageId}"
          >
            📋 Copy
          </button>

          <button
            type="button"
            class="edit-message-btn"
            data-message-id="${messageId}"
          >
            ✏️ Edit
          </button>

          <button
            type="button"
            class="delete-message-btn"
            data-message-id="${messageId}"
          >
            🗑️ Delete
          </button>

        </div>
      `;

      messageInfo.appendChild(
        wrapper
      );

      const textElement =
        messageElement.querySelector(
          ".message-content > p"
        );

      if (
        textElement &&
        !textElement.dataset.originalText
      ) {
        textElement.dataset.originalText =
          textElement.textContent.trim();
      }
    }
  );
}

// ====================================
// INITIALIZE EXISTING MESSAGE MENUS
// ====================================

addMenusToExistingMessages();

// ====================================
// MENU BUTTON CLICK
// ====================================

if (messagesContainer) {
  messagesContainer.addEventListener(
    "click",
    (event) => {
      const menuButton =
        event.target.closest(
          ".message-menu-btn"
        );

      if (!menuButton) {
        return;
      }

      event.stopPropagation();

      const messageId =
        menuButton.dataset.messageId;

      document
        .querySelectorAll(
          ".message-menu.show"
        )
        .forEach((menu) => {
          if (
            menu.dataset.menuFor !==
            messageId
          ) {
            menu.classList.remove(
              "show"
            );
          }
        });

      const menu =
        document.querySelector(
          `.message-menu[data-menu-for="${messageId}"]`
        );

      if (menu) {
        menu.classList.toggle("show");
      }
    }
  );
}

// ====================================
// CLOSE MENUS
// ====================================

document.addEventListener(
  "click",
  (event) => {
    if (
      !event.target.closest(
        ".message-menu-wrapper"
      )
    ) {
      document
        .querySelectorAll(
          ".message-menu.show"
        )
        .forEach((menu) => {
          menu.classList.remove(
            "show"
          );
        });
    }
  }
);

// ====================================
// EDIT MESSAGE
// ====================================

if (messagesContainer) {
  messagesContainer.addEventListener(
    "click",
    async (event) => {
      const editButton =
        event.target.closest(
          ".edit-message-btn"
        );

      if (!editButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const messageId =
        editButton.dataset.messageId;

      const messageElement =
        document.querySelector(
          `[data-message-id="${messageId}"]`
        );

      if (!messageElement) {
        return;
      }

      const textElement =
        messageElement.querySelector(
          ".message-bubble > p"
        );

      if (!textElement) {
        return;
      }

      const currentText =
        textElement.dataset.originalText ||
        textElement.textContent.trim();

      if (
        messageElement.querySelector(
          ".inline-edit-box"
        )
      ) {
        return;
      }

      const editBox =
        document.createElement("div");

      editBox.className =
        "inline-edit-box";

      editBox.innerHTML = `
        <textarea
          class="inline-edit-input"
          maxlength="5000"
        >${escapeHtml(
          currentText
        )}</textarea>

        <div class="inline-edit-actions">

          <button
            type="button"
            class="cancel-edit-btn"
          >
            Cancel
          </button>

          <button
            type="button"
            class="save-edit-btn"
          >
            Save
          </button>

        </div>
      `;

      textElement.style.display =
        "none";

      textElement.parentElement.appendChild(
        editBox
      );

      const textarea =
        editBox.querySelector(
          ".inline-edit-input"
        );

      textarea.focus();

      textarea.setSelectionRange(
        textarea.value.length,
        textarea.value.length
      );

      const cancelButton =
        editBox.querySelector(
          ".cancel-edit-btn"
        );

      cancelButton.addEventListener(
        "click",
        () => {
          editBox.remove();
          textElement.style.display =
            "";
        }
      );

      const saveButton =
        editBox.querySelector(
          ".save-edit-btn"
        );

      saveButton.addEventListener(
        "click",
        async () => {
          const newText =
            textarea.value.trim();

          if (!newText) {
            alert(
              "Message cannot be empty."
            );
            return;
          }

          if (newText === currentText) {
            editBox.remove();
            textElement.style.display =
              "";
            return;
          }

          saveButton.disabled = true;

          try {
            const response =
              await fetch(
                `/api/messages/${messageId}`,
                {
                  method: "PUT",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    message: newText,
                  }),
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                data.error ||
                  "Unable to edit message."
              );
            }

            textElement.textContent =
              data.message ||
              newText;

            textElement.dataset.originalText =
              data.message ||
              newText;

            editBox.remove();

            textElement.style.display =
              "";

          } catch (error) {
            console.error(
              "Edit message error:",
              error
            );

            alert(
              error.message ||
                "Unable to edit message."
            );

            saveButton.disabled =
              false;
          }
        }
      );
    }
  );
}

// ====================================
// RECEIVE MESSAGE EDITED
// ====================================

socket.on(
  "messageEdited",
  (data) => {
    if (
      !data ||
      !data.messageId
    ) {
      return;
    }

    const messageElement =
      document.querySelector(
        `[data-message-id="${data.messageId}"]`
      );

    if (!messageElement) {
      return;
    }

    const textElement =
      messageElement.querySelector(
        ".message-bubble > p"
      );

    if (!textElement) {
      return;
    }

    const newMessage =
      data.message || "";

    textElement.textContent =
      newMessage;

    textElement.dataset.originalText =
      newMessage;

    if (
      !textElement.querySelector(
        ".edited-label"
      )
    ) {
      const editedLabel =
        document.createElement(
          "span"
        );

      editedLabel.className =
        "edited-label";

      editedLabel.textContent =
        " (edited)";

      textElement.appendChild(
        editedLabel
      );
    }
  }
);

// ====================================
// RECEIVE MESSAGE DELETED
// ====================================

socket.on(
  "messageDeleted",
  (data) => {
    if (
      !data ||
      !data.messageId
    ) {
      return;
    }

    const messageElement =
      document.querySelector(
        `[data-message-id="${data.messageId}"]`
      );

    if (!messageElement) {
      return;
    }

    const textElement =
      messageElement.querySelector(
        ".message-bubble > p"
      );

    if (textElement) {
      textElement.textContent =
        "This message was deleted.";

      textElement.dataset.originalText =
        "This message was deleted.";
    }

    messageElement.classList.add(
      "deleted-message"
    );

    const menuWrapper =
      messageElement.querySelector(
        ".message-menu-wrapper"
      );

    if (menuWrapper) {
      menuWrapper.remove();
    }
  }
);

// ====================================
// DELETE MESSAGE
// ====================================

if (messagesContainer) {
  messagesContainer.addEventListener(
    "click",
    async (event) => {
      const deleteButton =
        event.target.closest(
          ".delete-message-btn"
        );

      if (!deleteButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const messageId =
        deleteButton.dataset.messageId;

      const confirmed =
        confirm(
          "Delete this message?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/messages/${messageId}`,
            {
              method: "DELETE",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to delete message."
          );
        }

        const messageElement =
          document.querySelector(
            `[data-message-id="${messageId}"]`
          );

        if (messageElement) {
          messageElement.classList.add(
            "deleted-message"
          );

          const textElement =
            messageElement.querySelector(
              ".message-content > p"
            );

          if (textElement) {
            textElement.textContent =
              "This message was deleted.";

            textElement.dataset.originalText =
              "This message was deleted.";
          }

          const menu =
            messageElement.querySelector(
              ".message-menu"
            );

          if (menu) {
            menu.remove();
          }

          const menuWrapper =
            messageElement.querySelector(
              ".message-menu-wrapper"
            );

          if (menuWrapper) {
            menuWrapper.remove();
          }
        }

      } catch (error) {
        console.error(
          "Delete message error:",
          error
        );

        alert(
          error.message ||
            "Unable to delete message."
        );
      }
    }
  );
}

// ====================================
// COPY MESSAGE
// ====================================

if (messagesContainer) {
  messagesContainer.addEventListener(
    "click",
    async (event) => {
      const copyButton =
        event.target.closest(
          ".copy-message-btn"
        );

      if (!copyButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const messageId =
        copyButton.dataset.messageId;

      const messageElement =
        document.querySelector(
          `[data-message-id="${messageId}"]`
        );

      if (!messageElement) {
        return;
      }

      const textElement =
        messageElement.querySelector(
          ".message-bubble > p"
        );

      if (!textElement) {
        return;
      }

      const text =
        textElement.dataset.originalText ||
        textElement.textContent.trim();

      try {
        await navigator.clipboard.writeText(
          text
        );

        copyButton.textContent =
          "✅ Copied";

        setTimeout(() => {
          copyButton.textContent =
            "📋 Copy";
        }, 1200);

      } catch (error) {
        console.error(
          "Copy message error:",
          error
        );

        alert(
          "Unable to copy message."
        );
      }
    }
  );
}

// ====================================
// REPLY TO MESSAGE
// ====================================

if (messagesContainer) {
  messagesContainer.addEventListener(
    "click",
    (event) => {
      const replyButton =
        event.target.closest(
          ".reply-message-btn"
        );

      if (!replyButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const messageId =
        replyButton.dataset.messageId;

      const messageElement =
        document.querySelector(
          `[data-message-id="${messageId}"]`
        );

      if (!messageElement) {
        return;
      }

      const textElement =
        messageElement.querySelector(
          ".message-bubble > p"
        );

      if (!textElement) {
        return;
      }

      const text =
        textElement.dataset.originalText ||
        textElement.textContent.trim();

      replyingToMessage = {
        messageId,
        text,
      };

      if (
        replyPreview &&
        replyPreviewText
      ) {
        replyPreviewText.textContent =
          text;

        replyPreview.style.display =
          "flex";
      }

      if (messageInput) {
        messageInput.focus();
      }

      const menu =
        replyButton.closest(
          ".message-menu"
        );

      if (menu) {
        menu.classList.remove(
          "show"
        );
      }
    }
  );
}

// ====================================
// CANCEL REPLY
// ====================================

if (cancelReply) {
  cancelReply.addEventListener(
    "click",
    () => {
      replyingToMessage = null;

      if (replyPreview) {
        replyPreview.style.display =
          "none";
      }

      if (replyPreviewText) {
        replyPreviewText.textContent =
          "";
      }

      if (messageInput) {
        messageInput.focus();
      }
    }
  );
}

// ====================================
// REACTION BUTTONS
// ====================================

function attachReactionButtons(
  container
) {
  if (!container) {
    return;
  }

  const buttons =
    container.querySelectorAll(
      ".reaction-btn"
    );

  buttons.forEach((button) => {
    if (
      button.dataset.reactionAttached ===
      "true"
    ) {
      return;
    }

    button.dataset.reactionAttached =
      "true";

    button.addEventListener(
      "click",
      () => {
        const messageId =
          button.dataset.messageId;

        const reaction =
          button.dataset.reaction;

        if (
          !messageId ||
          !reaction
        ) {
          return;
        }

        socket.emit(
          "addReaction",
          {
            messageId,
            username: currentUser,
            emoji: reaction,
          }
        );
      }
    );
  });
}

// ====================================
// INITIAL REACTION BUTTONS
// ====================================

if (messagesContainer) {
  attachReactionButtons(
    messagesContainer
  );
}

// ====================================
// REACTION UPDATE
// ====================================

socket.on(
  "reactionUpdated",
  (data) => {
    if (!data) {
      return;
    }

    const messageElement =
      document.querySelector(
        `[data-message-id="${data.messageId}"]`
      );

    if (!messageElement) {
      return;
    }

    const reactionResults =
      messageElement.querySelector(
        ".reaction-results"
      );

    if (!reactionResults) {
      return;
    }

    const reactions =
      data.reactions || [];

    reactionResults.innerHTML =
      reactions
        .map(
          (reaction) => `
            <span class="reaction-result">
              ${escapeHtml(
                reaction.emoji || ""
              )}
            </span>
          `
        )
        .join("");
  }
);

// ====================================
// TYPING STATE
// ====================================

let typingTimeout = null;
let isTyping = false;

// ====================================
// START / STOP TYPING
// ====================================

function stopTyping() {
  if (!isTyping) {
    return;
  }

  isTyping = false;

  clearTimeout(typingTimeout);

  if (privateChat) {
    socket.emit(
      "stopPrivateTyping",
      {
        username: currentUser,
        receiver: targetUser,
      }
    );
  } else {
    socket.emit(
      "stopTyping",
      {
        username: currentUser,
        room: currentRoom,
      }
    );
  }
}

if (messageInput) {
  messageInput.addEventListener(
    "input",
    () => {
      const hasText =
        Boolean(
          messageInput.value.trim()
        );

      if (!hasText) {
        stopTyping();
        return;
      }

      if (!isTyping) {
        isTyping = true;

        if (privateChat) {
          socket.emit(
            "privateTyping",
            {
              username: currentUser,
              receiver: targetUser,
            }
          );
        } else {
          socket.emit(
            "typing",
            {
              username: currentUser,
              room: currentRoom,
            }
          );
        }
      }

      clearTimeout(
        typingTimeout
      );

      typingTimeout =
        setTimeout(
          () => {
            stopTyping();
          },
          1200
        );
    }
  );

  messageInput.addEventListener(
    "blur",
    stopTyping
  );
}

// ====================================
// TYPING INDICATOR HELPERS
// ====================================

let typingHideTimeout = null;

function showTypingIndicator(
  username
) {
  if (
    !typingIndicator ||
    !username
  ) {
    return;
  }

  clearTimeout(
    typingHideTimeout
  );

  typingIndicator.textContent =
    `${username} is typing...`;

  typingIndicator.style.display =
    "block";

  typingHideTimeout =
    setTimeout(
      () => {
        hideTypingIndicator();
      },
      2500
    );
}

function hideTypingIndicator() {
  if (!typingIndicator) {
    return;
  }

  typingIndicator.textContent = "";
  typingIndicator.style.display =
    "none";
}

// ====================================
// PUBLIC TYPING
// ====================================

socket.on(
  "typing",
  (data) => {
    if (
      privateChat ||
      !data ||
      !data.username
    ) {
      return;
    }

    if (
      data.username ===
      currentUser
    ) {
      return;
    }

    showTypingIndicator(
      data.username
    );
  }
);

socket.on(
  "stopTyping",
  () => {
    if (privateChat) {
      return;
    }

    hideTypingIndicator();
  }
);

// ====================================
// PRIVATE TYPING
// ====================================

socket.on(
  "privateTyping",
  (data) => {
    if (
      !privateChat ||
      !data ||
      !data.username
    ) {
      return;
    }

    if (
      data.username !==
      targetUser
    ) {
      return;
    }

    showTypingIndicator(
      data.username
    );
  }
);

socket.on(
  "stopPrivateTyping",
  () => {
    if (!privateChat) {
      return;
    }

    hideTypingIndicator();
  }
);

// ====================================
// USER LIST
// ====================================

async function loadUsers() {
  if (!allUsers) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/users"
      );

    if (!response.ok) {
      throw new Error(
        "Unable to load users"
      );
    }

    const users =
      await response.json();

    renderUsers(users);

  } catch (error) {
    console.error(
      "Users loading error:",
      error
    );

    allUsers.innerHTML = `
      <li class="user-error">
        Unable to load users
      </li>
    `;
  }
}

// ====================================
// RENDER USERS
// ====================================

function renderUsers(users) {
  if (!allUsers) {
    return;
  }

  allUsers.innerHTML = "";

  if (
    !users ||
    users.length === 0
  ) {
    allUsers.innerHTML = `
      <li class="no-users">
        No other users found.
      </li>
    `;

    return;
  }

  users.forEach((user) => {

    // SAFETY FIX:
    // Ignore malformed user records.
    if (
      !user ||
      !user.username
    ) {
      return;
    }

    const li =
      document.createElement("li");

    li.className =
      "user-item";

    li.dataset.username =
      user.username;

    li.dataset.userId =
      user._id || "";

    const isOnline =
      user.isOnline === true;

    const username =
      String(user.username);

    const firstLetter =
      username
        .charAt(0)
        .toUpperCase();

    li.innerHTML = `
      <div class="user-avatar">
        ${escapeHtml(firstLetter)}
      </div>

      <div class="user-details">

        <strong>
          ${escapeHtml(username)}
        </strong>

        <span
          class="user-status ${
            isOnline
              ? "online"
              : "offline"
          }"
        >
          ${
            isOnline
              ? "Online"
              : formatLastSeen(
                  user.lastSeen
                )
          }
        </span>

      </div>

      ${
        user.unreadMessages > 0
          ? `
            <span class="unread-badge">
              ${user.unreadMessages}
            </span>
          `
          : ""
      }
    `;

    li.addEventListener(
      "click",
      () => {
        if (user._id) {
          window.location.href =
            `/chat?user=${encodeURIComponent(
              user._id
            )}`;
        }
      }
    );

    allUsers.appendChild(li);
  });

  updateActiveUser();
}

// ====================================
// FORMAT LAST SEEN
// ====================================

function formatLastSeen(
  lastSeen
) {
  if (!lastSeen) {
    return "Offline";
  }

  const date =
    new Date(lastSeen);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Offline";
  }

  return `Last seen ${date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )}`;
}

// ====================================
// ACTIVE USER
// ====================================

function updateActiveUser() {
  if (!allUsers) {
    return;
  }

  allUsers
    .querySelectorAll(
      ".user-item"
    )
    .forEach((item) => {
      if (
        item.dataset.username ===
        targetUser
      ) {
        item.classList.add(
          "active"
        );
      } else {
        item.classList.remove(
          "active"
        );
      }
    });
}

// ====================================
// USER SEARCH
// ====================================

if (userSearchInput) {
  userSearchInput.addEventListener(
    "input",
    () => {
      const search =
        userSearchInput.value
          .trim()
          .toLowerCase();

      const items =
        allUsers?.querySelectorAll(
          ".user-item"
        ) || [];

      items.forEach((item) => {
        const username =
          item.dataset.username
            ?.toLowerCase() || "";

        item.style.display =
          username.includes(search)
            ? ""
            : "none";
      });
    }
  );
}

// ====================================
// LOAD USERS
// ====================================

loadUsers();

// ====================================
// ONLINE USER UPDATE
// ====================================

socket.on(
  "usersUpdated",
  (users) => {
    renderUsers(users);
  }
);

// ====================================
// USER ONLINE EVENT
// ====================================

socket.on(
  "userOnline",
  (data) => {
    if (!data) {
      return;
    }

    updateUserStatus(
      data.username,
      true,
      data.lastSeen
    );
  }
);

// ====================================
// USER OFFLINE EVENT
// ====================================

socket.on(
  "userOffline",
  (data) => {
    if (!data) {
      return;
    }

    updateUserStatus(
      data.username,
      false,
      data.lastSeen
    );
  }
);

// ====================================
// UPDATE USER STATUS
// ====================================

function updateUserStatus(
  username,
  online,
  lastSeen
) {
  if (!allUsers || !username) {
    return;
  }

  const item =
    allUsers.querySelector(
      `.user-item[data-username="${CSS.escape(
        username
      )}"]`
    );

  if (!item) {
    return;
  }

  const status =
    item.querySelector(
      ".user-status"
    );

  if (!status) {
    return;
  }

  status.classList.toggle(
    "online",
    online
  );

  status.classList.toggle(
    "offline",
    !online
  );

  status.textContent =
    online
      ? "Online"
      : formatLastSeen(
          lastSeen
        );
}

// ====================================
// TARGET USER STATUS
// ====================================

socket.on(
  "targetUserStatus",
  (data) => {
    if (
      !privateChat ||
      !data
    ) {
      return;
    }

    if (
      data.username !==
      targetUser
    ) {
      return;
    }

    const statusElement =
      document.getElementById(
        "targetUserStatus"
      );

    if (!statusElement) {
      return;
    }

    if (data.isOnline) {
      statusElement.textContent =
        "● Online";

      statusElement.classList.add(
        "online"
      );

      statusElement.classList.remove(
        "offline"
      );
    } else {
      statusElement.textContent =
        formatLastSeen(
          data.lastSeen
        );

      statusElement.classList.add(
        "offline"
      );

      statusElement.classList.remove(
        "online"
      );
    }
  }
);

// ====================================
// MESSAGE DELIVERED
// ====================================

socket.on(
  "messageDelivered",
  (data) => {
    if (!data) {
      return;
    }

    const statusElement =
      document.querySelector(
        `[data-status-for="${data.messageId}"]`
      );

    if (!statusElement) {
      return;
    }

    statusElement.textContent =
      "✓✓";
  }
);

// ====================================
// MESSAGE SEEN
// ====================================

socket.on(
  "messageSeen",
  (data) => {
    if (!data) {
      return;
    }

    const statusElement =
      document.querySelector(
        `[data-status-for="${data.messageId}"]`
      );

    if (!statusElement) {
      return;
    }

    statusElement.textContent =
      "✓✓";

    statusElement.classList.add(
      "seen"
    );
  }
);

// ====================================
// UNREAD MESSAGE UPDATE
// ====================================

socket.on(
  "unreadUpdated",
  (data) => {
    if (!data) {
      return;
    }

    if (
      data.username ===
      currentUser
    ) {
      return;
    }

    updateUnreadBadge(
      data.username,
      data.count
    );
  }
);

// ====================================
// UPDATE UNREAD BADGE
// ====================================

function updateUnreadBadge(
  username,
  count
) {
  if (!allUsers || !username) {
    return;
  }

  const item =
    allUsers.querySelector(
      `.user-item[data-username="${CSS.escape(
        username
      )}"]`
    );

  if (!item) {
    return;
  }

  const existingBadge =
    item.querySelector(
      ".unread-badge"
    );

  if (
    !count ||
    count <= 0
  ) {
    if (existingBadge) {
      existingBadge.remove();
    }

    return;
  }

  if (existingBadge) {
    existingBadge.textContent =
      count;

    return;
  }

  const badge =
    document.createElement(
      "span"
    );

  badge.className =
    "unread-badge";

  badge.textContent =
    count;

  item.appendChild(badge);
}

// ====================================
// MARK CURRENT PRIVATE CHAT SEEN
// ====================================

function markCurrentChatSeen() {
  if (
    !privateChat ||
    !targetUser
  ) {
    return;
  }

  const messages =
    messagesContainer?.querySelectorAll(
      ".message"
    ) || [];

  messages.forEach(
    (messageElement) => {
      const usernameElement =
        messageElement.querySelector(
          ".message-info strong"
        );

      if (!usernameElement) {
        return;
      }

      const username =
        usernameElement.textContent.trim();

      if (
        username !==
        targetUser
      ) {
        return;
      }

      const messageId =
        messageElement.dataset.messageId;

      if (!messageId) {
        return;
      }

      socket.emit(
        "messageSeen",
        {
          messageId,
          username: currentUser,
        }
      );
    }
  );
}

// ====================================
// INITIAL SEEN
// ====================================

if (privateChat) {
  setTimeout(
    markCurrentChatSeen,
    500
  );
}

// ====================================
// SOCKET CONNECT / RECONNECT
// ====================================

socket.on(
  "connect",
  () => {
    console.log(
      "Connected to server:",
      socket.id
    );

    if (currentUser) {
      socket.emit(
        "userOnline",
        {
          username: currentUser,
        }
      );
    }

    if (
      privateChat &&
      targetUser
    ) {
      socket.emit(
        "joinPrivateChat",
        {
          username: currentUser,
          receiver: targetUser,
        }
      );
    } else if (currentRoom) {
      socket.emit(
        "joinRoom",
        {
          username: currentUser,
          room: currentRoom,
        }
      );
    }
  }
);