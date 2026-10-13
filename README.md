# Connect AI — GitHub + Render + Roblox Studio

This is an original AI development assistant for Roblox Studio. The website is hosted on Render, source code is stored in GitHub, and a Studio plugin bridges the AI to the open place.

## Features
- Chat with an AI provider that supports the OpenAI Chat Completions API format.
- Send selected object names, classes, paths, and limited selected-script source to the AI for context.
- Create Parts, Models, Folders, Scripts, LocalScripts, and ModuleScripts.
- Rewrite the source of a selected script with an exact matching name.
- AI-generated Studio actions are queued automatically. There is no “Send scripts to Studio” button on the website. The Studio plugin shows **Approve changes** / **Reject** so you can review before modifying your place.

## A. Configure locally
1. Install Node.js 18 or newer from https://nodejs.org/.
2. Extract the project.
3. Copy `.env.example` to `.env`.
4. Set `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and a long random `BRIDGE_TOKEN`.
5. In Command Prompt, change directory to the project folder and run:
   ```bash
   npm install
   npm start
   ```
6. Visit http://localhost:3000.

`AI_BASE_URL` is the API base URL, normally ending in `/v1`; the server adds `/chat/completions`. Use your provider's documented model name. Never put your API key in website JavaScript or the Studio plugin.

## B. Push to GitHub
1. Create a new repository on GitHub.
2. Upload `server.js`, `package.json`, `.env.example`, `README.md`, `ConnectAI.plugin.lua`, and the `public` folder.
3. Do not upload `.env` or any API key/secret.

## C. Deploy on Render
1. In Render, create a **Web Service** and connect your GitHub repository.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables in Render:
   - `AI_BASE_URL`
   - `AI_API_KEY`
   - `AI_MODEL`
   - `BRIDGE_TOKEN`
5. Deploy. Open your Render URL and `/api/health`; `aiConfigured` should be `true`.

## D. Connect Roblox Studio
1. Open `ConnectAI.plugin.lua` in a text editor.
2. Replace `https://YOUR-RENDER-SERVICE.onrender.com` with your actual Render URL (no trailing slash).
3. Replace `PUT_THE_SAME_RANDOM_SECRET_HERE` with the exact same `BRIDGE_TOKEN` stored in Render.
4. Install the script using the local plugin workflow supported by your Roblox Studio version. A regular Script inside `ServerScriptService` is not a Studio plugin.
5. Restart Studio if the plugin does not appear. Click **Connect AI** in the Plugins toolbar.
6. Allow HTTP requests if Studio asks, and keep the plugin widget open.
7. Open your Render website in a browser and ask for a change.

## E. How changes are applied
1. The AI reads the selection context sent by the plugin.
2. When it generates valid structured actions, the server queues them automatically.
3. The plugin polls Render and shows the proposed change count.
4. Click **Approve changes** in the plugin to write the proposed instances/scripts into Studio, or **Reject** to discard the batch.
5. Check the plugin log and Studio Output. Use Undo if needed.

The site intentionally has no button for manually sending scripts. Approval remains in the Studio plugin as a safety check before modifying your project.

## Security and limitations
- This is a starter project, not a production public service. Without login and rate limits, anyone who can access the public chat endpoint may consume your AI API quota. Add authentication, usage limits, and abuse protection before sharing it widely.
- Keep `BRIDGE_TOKEN` private and use a long random value. Anyone who obtains it may read bridge context and poll queued actions.
- Selection context can include up to 6,000 characters of source for a selected script. Do not select scripts containing secrets.
- AI-generated code may be wrong. Review it before playtesting or publishing.
- The current bridge supports a limited safe action list. It does not execute arbitrary generated Lua, delete objects, or guarantee that an entire complex system will work perfectly in one request.
- `set_script_source` requires a selected Lua script with the exact name specified by the AI.
- A script's source is written through Studio's plugin API; scripts do not automatically run in edit mode. Test the place in Studio.
- Render free services may sleep when idle and take time to wake up.
- If the plugin cannot send HTTP requests, check Studio's security settings and current plugin API requirements. Studio menus and API details can change by version.
