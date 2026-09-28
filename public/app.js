const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const newChat = document.getElementById("newChat");
const serverStatus = document.getElementById("serverStatus");

let history = [];

function addMessage(role, text) {
    const welcome = document.querySelector(".welcome");

    if (welcome) {
        welcome.remove();
    }

    const message = document.createElement("div");
    message.className = `message ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    message.appendChild(bubble);
    messages.appendChild(message);

    messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(message) {
    addMessage("user", message);

    history.push({
        role: "user",
        content: message
    });

    sendButton.disabled = true;
    input.disabled = true;

    const thinking = document.createElement("div");
    thinking.className = "message ai";
    thinking.id = "thinking";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = "Thinking...";

    thinking.appendChild(bubble);
    messages.appendChild(thinking);

    messages.scrollTop = messages.scrollHeight;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                history
            })
        });

        const data = await response.json();

        thinking.remove();

        if (!response.ok) {
            throw new Error(
                data.error || "Request failed."
            );
        }

        const reply = data.reply || "No response.";

        addMessage("ai", reply);

        history.push({
            role: "assistant",
            content: reply
        });

    } catch (error) {
        thinking.remove();

        addMessage(
            "ai",
            "Error: " + error.message
        );
    }

    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
        return;
    }

    input.value = "";
    input.style.height = "42px";

    await sendMessage(message);
});

input.addEventListener("input", () => {
    input.style.height = "42px";
    input.style.height =
        Math.min(input.scrollHeight, 150) + "px";
});

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

newChat.addEventListener("click", () => {
    history = [];

    messages.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">✦</div>
            <h2>How can I help?</h2>
            <p>
                Send a message and Connect AI will respond.
            </p>
        </div>
    `;

    input.value = "";
    input.focus();
});

async function checkServer() {
    try {
        const response = await fetch("/health");

        if (!response.ok) {
            throw new Error();
        }

        serverStatus.textContent = "Online";
    } catch {
        serverStatus.textContent = "Offline";
    }
}

checkServer();
