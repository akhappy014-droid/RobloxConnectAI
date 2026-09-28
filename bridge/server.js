const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 48721);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

if (!OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY is not set.");
    console.error("Set your OpenAI API key before starting the bridge.");
    process.exit(1);
}

function sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data);

    res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });

    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 5 * 1024 * 1024) {
                reject(new Error("Request body is too large."));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Invalid JSON."));
            }
        });

        req.on("error", reject);
    });
}

function requestJSON(url, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);

        const req = https.request(
            {
                hostname: target.hostname,
                port: target.port || 443,
                path: target.pathname + target.search,
                method: options.method || "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {}),
                },
            },
            res => {
                let data = "";

                res.on("data", chunk => {
                    data += chunk;
                });

                res.on("end", () => {
                    let parsed;

                    try {
                        parsed = data ? JSON.parse(data) : {};
                    } catch {
                        parsed = {
                            raw: data,
                        };
                    }

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        const error = new Error(
                            `HTTP ${res.statusCode}: ${data}`
                        );

                        error.statusCode = res.statusCode;
                        error.response = parsed;

                        reject(error);
                    }
                });
            }
        );

        req.on("error", reject);

        if (body !== null) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function openAIChat(message, context = {}) {
    const systemPrompt = `
You are Connect AI, an AI assistant built into Roblox Studio.

The user can send you ANY normal message.

You should understand:
- Normal questions
- Roblox Studio questions
- Lua/Luau
- Game development
- UI creation
- Map creation
- Parts
- Models
- Folders
- Scripts
- RemoteEvents
- RemoteFunctions
- GUIs
- Workspace objects
- ServerScriptService
- ReplicatedStorage
- StarterGui
- StarterPlayer
- ServerStorage
- Studio plugins
- GitHub projects
- Debugging
- Code generation
- Code explanations
- Game design
- Building instructions

Do not require the user to use a special command format.

If the user asks a normal question, answer normally.

If the user asks for code, provide complete usable code.

If the user asks for a Roblox object to be created, explain exactly what should be created and where.

If the user asks to modify an existing object, use the supplied Studio context.

Be concise but useful.

Never pretend that an action was actually performed in Roblox Studio unless the bridge/plugin confirms it.

Studio context:
${JSON.stringify(context, null, 2)}
`;

    const payload = {
        model: OPENAI_MODEL,
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: systemPrompt,
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: message,
                    },
                ],
            },
        ],
    };

    const result = await requestJSON(
        "https://api.openai.com/v1/responses",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
        },
        payload
    );

    let text = "";

    if (typeof result.output_text === "string") {
        text = result.output_text;
    }

    if (!text && Array.isArray(result.output)) {
        for (const item of result.output) {
            if (!Array.isArray(item.content)) continue;

            for (const content of item.content) {
                if (
                    content.type === "output_text" &&
                    typeof content.text === "string"
                ) {
                    text += content.text;
                }
            }
        }
    }

    if (!text) {
        text = "The AI returned an empty response.";
    }

    return {
        text,
        model: OPENAI_MODEL,
    };
}

async function githubPutFile(data) {
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
        throw new Error(
            "GitHub is not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO."
        );
    }

    const path = String(data.path || "").replace(/^\/+/, "");

    if (!path) {
        throw new Error("GitHub file path is required.");
    }

    const content = String(data.content || "");

    const encodedContent = Buffer.from(content, "utf8").toString("base64");

    const apiPath =
        `/repos/${encodeURIComponent(GITHUB_OWNER)}` +
        `/${encodeURIComponent(GITHUB_REPO)}` +
        `/contents/${path}`;

    let existingFile = null;

    try {
        existingFile = await requestJSON(
            `https://api.github.com${apiPath}?ref=${encodeURIComponent(
                data.branch || GITHUB_BRANCH
            )}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "Roblox-Connect-AI",
                },
            }
        );
    } catch (error) {
        if (error.statusCode !== 404) {
            throw error;
        }
    }

    const payload = {
        message:
            data.commitMessage ||
            `Connect AI: update ${path}`,
        content: encodedContent,
        branch: data.branch || GITHUB_BRANCH,
    };

    if (existingFile && existingFile.sha) {
        payload.sha = existingFile.sha;
    }

    return await requestJSON(
        `https://api.github.com${apiPath}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "Roblox-Connect-AI",
            },
        },
        payload
    );
}

async function handleRequest(req, res) {
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        });

        res.end();
        return;
    }

    const url = new URL(
        req.url,
        `http://127.0.0.1:${PORT}`
    );

    if (req.method === "GET" && url.pathname === "/health") {
        sendJSON(res, 200, {
            ok: true,
            service: "Connect AI Bridge",
            port: PORT,
            githubConfigured:
                Boolean(
                    GITHUB_TOKEN &&
                    GITHUB_OWNER &&
                    GITHUB_REPO
                ),
            openAIConfigured: Boolean(OPENAI_API_KEY),
            model: OPENAI_MODEL,
        });

        return;
    }

    if (req.method === "POST" && url.pathname === "/chat") {
        try {
            const data = await readBody(req);

            const message = String(data.message || "").trim();

            if (!message) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Message is required.",
                });

                return;
            }

            const result = await openAIChat(
                message,
                data.context || {}
            );

            sendJSON(res, 200, {
                ok: true,
                text: result.text,
                model: result.model,
                actions: [],
            });
        } catch (error) {
            console.error("Chat error:", error);

            sendJSON(res, 500, {
                ok: false,
                error: error.message || "AI request failed.",
            });
        }

        return;
    }

    if (req.method === "POST" && url.pathname === "/github/put") {
        try {
            const data = await readBody(req);

            const result = await githubPutFile(data);

            sendJSON(res, 200, {
                ok: true,
                message: "File uploaded to GitHub.",
                result,
            });
        } catch (error) {
            console.error("GitHub error:", error);

            sendJSON(res, 500, {
                ok: false,
                error: error.message || "GitHub request failed.",
            });
        }

        return;
    }

    sendJSON(res, 404, {
        ok: false,
        error: "Not found.",
    });
}

const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(error => {
        console.error("Unhandled error:", error);

        sendJSON(res, 500, {
            ok: false,
            error: "Internal server error.",
        });
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("======================================");
    console.log("       Connect AI Bridge");
    console.log("======================================");
    console.log(`Running on: http://127.0.0.1:${PORT}`);
    console.log(`Model: ${OPENAI_MODEL}`);
    console.log(
        `GitHub: ${
            GITHUB_TOKEN &&
            GITHUB_OWNER &&
            GITHUB_REPO
                ? "configured"
                : "not configured"
        }`
    );
    console.log("======================================");
});
