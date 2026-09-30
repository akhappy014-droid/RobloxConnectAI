const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json({
    limit: "5mb"
}));

/*
    ============================================
    PROVIDERS
    ============================================

    PROVIDER can be:

    openai
    gemini
    anthropic
    openai-compatible

    Example Render environment variables:

    AI_PROVIDER=openai
    AI_MODEL=gpt-5
    OPENAI_API_KEY=...

    OR

    AI_PROVIDER=gemini
    AI_MODEL=gemini-3.1-pro
    GEMINI_API_KEY=...

    OR

    AI_PROVIDER=anthropic
    AI_MODEL=...
    ANTHROPIC_API_KEY=...
*/

const PROVIDER =
    process.env.AI_PROVIDER || "openai";

const MODEL =
    process.env.AI_MODEL || "gpt-5";

const SYSTEM_PROMPT = `
You are Connect AI, an expert Roblox Studio development agent.

Your job is to understand the user's Roblox Studio request
and produce structured actions that a Roblox Studio plugin can execute.

You can create:

- Parts
- MeshParts
- Folders
- Models
- SpawnLocations
- Scripts
- LocalScripts
- ModuleScripts
- Attachments
- ProximityPrompts
- ClickDetectors
- StringValues
- NumberValues
- BoolValues
- IntValues
- ObjectValues
- GUIs
- Lighting settings
- Properties
- CFrames
- Colors
- Materials
- Sizes
- Positions
- Scripts and Luau code

You can also modify or delete objects when explicitly requested.

IMPORTANT:

Never return executable actions outside the JSON format.

Return ONLY valid JSON.

The JSON format is:

{
    "message": "short explanation",
    "actions": [
        {
            "type": "...",
            "...": "..."
        }
    ]
}

Available actions:

create_part
create_folder
create_model
create_spawn
create_script
create_localscript
create_modulescript
set_property
delete_instance

For create_part:

{
    "type": "create_part",
    "name": "PartName",
    "parent": "Workspace",
    "size": [10, 1, 10],
    "position": [0, 5, 0],
    "color": [255, 0, 0],
    "material": "Plastic",
    "anchored": true,
    "canCollide": true
}

For create_script:

{
    "type": "create_script",
    "name": "ScriptName",
    "parent": "Workspace",
    "source": "print('Hello')"
}

For create_localscript:

{
    "type": "create_localscript",
    "name": "ClientScript",
    "parent": "StarterPlayer.StarterPlayerScripts",
    "source": "print('Hello')"
}

For create_modulescript:

{
    "type": "create_modulescript",
    "name": "Module",
    "parent": "ReplicatedStorage",
    "source": "local Module = {}\\nreturn Module"
}

For set_property:

{
    "type": "set_property",
    "path": "Workspace.Part",
    "property": "Transparency",
    "value": 0.5
}

For delete_instance:

{
    "type": "delete_instance",
    "path": "Workspace.Part"
}

When creating scripts, write complete working Luau.

When the user asks for a game system, create all required
objects and scripts instead of only explaining how to build them.

Use the project context supplied by the plugin.

Do not invent objects that the plugin says do not exist.

If a request is ambiguous, make a reasonable Roblox-development
assumption and explain it in the "message" field.

Return valid JSON only.
`;

/* ============================================
   HELPERS
============================================ */

function cleanJSON(text) {
    if (!text) {
        throw new Error("AI returned an empty response.");
    }

    text = text.trim();

    if (text.startsWith("```")) {
        text = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "");
    }

    return JSON.parse(text);
}

/* ============================================
   OPENAI
============================================ */

async function callOpenAI(prompt) {

    const key = process.env.OPENAI_API_KEY;

    if (!key) {
        throw new Error(
            "OPENAI_API_KEY is missing."
        );
    }

    const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`
            },

            body: JSON.stringify({
                model: MODEL,

                input: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "OpenAI request failed."
        );
    }

    return data.output_text;
}

/* ============================================
   GEMINI
============================================ */

async function callGemini(prompt) {

    const key = process.env.GEMINI_API_KEY;

    if (!key) {
        throw new Error(
            "GEMINI_API_KEY is missing."
        );
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key
        },

        body: JSON.stringify({
            systemInstruction: {
                parts: [
                    {
                        text: SYSTEM_PROMPT
                    }
                ]
            },

            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],

            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "Gemini request failed."
        );
    }

    return (
        data
            ?.candidates?.[0]
            ?.content?.parts?.[0]
            ?.text || ""
    );
}

/* ============================================
   ANTHROPIC
============================================ */

async function callAnthropic(prompt) {

    const key =
        process.env.ANTHROPIC_API_KEY;

    if (!key) {
        throw new Error(
            "ANTHROPIC_API_KEY is missing."
        );
    }

    const response = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01"
            },

            body: JSON.stringify({
                model: MODEL,

                max_tokens: 20000,

                system: SYSTEM_PROMPT,

                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "Anthropic request failed."
        );
    }

    return (
        data?.content
            ?.filter(x => x.type === "text")
            ?.map(x => x.text)
            ?.join("") || ""
    );
}

/* ============================================
   OPENAI COMPATIBLE
============================================ */

async function callOpenAICompatible(prompt) {

    const key =
        process.env.AI_API_KEY;

    const base =
        process.env.AI_BASE_URL;

    if (!key) {
        throw new Error(
            "AI_API_KEY is missing."
        );
    }

    if (!base) {
        throw new Error(
            "AI_BASE_URL is missing."
        );
    }

    const response = await fetch(
        `${base.replace(/\/$/, "")}/chat/completions`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`
            },

            body: JSON.stringify({
                model: MODEL,

                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],

                temperature: 0
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "Compatible AI request failed."
        );
    }

    return (
        data?.choices?.[0]
            ?.message?.content || ""
    );
}

/* ============================================
   PROVIDER ROUTER
============================================ */

async function askAI(prompt) {

    switch (PROVIDER.toLowerCase()) {

        case "openai":
            return callOpenAI(prompt);

        case "gemini":
            return callGemini(prompt);

        case "anthropic":
            return callAnthropic(prompt);

        case "openai-compatible":
            return callOpenAICompatible(prompt);

        default:
            throw new Error(
                `Unknown AI provider: ${PROVIDER}`
            );
    }
}

/* ============================================
   API
============================================ */

app.get("/health", (req, res) => {

    res.json({
        ok: true,
        service: "Connect AI",
        provider: PROVIDER,
        model: MODEL
    });

});

app.post("/api/build", async (req, res) => {

    try {

        const {
            message,
            project
        } = req.body;

        if (
            typeof message !== "string" ||
            !message.trim()
        ) {

            return res.status(400).json({
                error: "message is required"
            });

        }

        const prompt = `
USER REQUEST:

${message}

ROBLOX STUDIO PROJECT CONTEXT:

${JSON.stringify(
    project || {},
    null,
    2
)}

Generate the required Roblox Studio actions.
`;

        const raw = await askAI(prompt);

        const result = cleanJSON(raw);

        if (
            !result ||
            !Array.isArray(result.actions)
        ) {

            throw new Error(
                "AI response does not contain actions."
            );

        }

        res.json(result);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});

/* ============================================
   START
============================================ */

app.listen(PORT, () => {

    console.log(
        `Connect AI running on port ${PORT}`
    );

    console.log(
        `Provider: ${PROVIDER}`
    );

    console.log(
        `Model: ${MODEL}`
    );

});
