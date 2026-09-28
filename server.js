const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "Connect AI",
        status: "online"
    });
});

app.post("/api/chat", async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                error: "Message is required."
            });
        }

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is not configured on the server."
            });
        }

        const input = [];

        for (const item of history) {
            if (!item || !item.role || !item.content) continue;

            if (
                item.role !== "user" &&
                item.role !== "assistant"
            ) {
                continue;
            }

            input.push({
                role: item.role,
                content: item.content
            });
        }

        input.push({
            role: "user",
            content: message
        });

        const response = await fetch(
            "https://api.openai.com/v1/responses",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-5",
                    input: input
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI error:", data);

            return res.status(response.status).json({
                error:
                    data?.error?.message ||
                    "OpenAI request failed."
            });
        }

        const answer =
            data.output_text ||
            extractResponseText(data);

        if (!answer) {
            return res.status(500).json({
                error: "The AI returned an empty response."
            });
        }

        res.json({
            reply: answer
        });
    } catch (error) {
        console.error("Server error:", error);

        res.status(500).json({
            error: "Internal server error."
        });
    }
});

function extractResponseText(data) {
    try {
        let text = "";

        for (const output of data.output || []) {
            for (const content of output.content || []) {
                if (
                    content.type === "output_text" &&
                    typeof content.text === "string"
                ) {
                    text += content.text;
                }
            }
        }

        return text.trim();
    } catch {
        return "";
    }
}

app.listen(PORT, () => {
    console.log(`Connect AI running on port ${PORT}`);
});
