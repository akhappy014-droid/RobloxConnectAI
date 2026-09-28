# Connect AI for Roblox Studio

A Lemonade-style starting point for Roblox Studio:
- Dockable AI chat inside Studio.
- Accepts arbitrary user messages.
- AI uses OpenAI Responses API.
- No API key is placed in the Roblox plugin.
- Optional GitHub repository write endpoint.
- Optional Studio object creation hooks can be extended safely.

## 1. Start the bridge

Install Node.js 18+.

Windows PowerShell:

    $env:OPENAI_API_KEY="YOUR_OPENAI_KEY"
    $env:OPENAI_MODEL="gpt-5.6-luna"
    $env:GITHUB_TOKEN="YOUR_GITHUB_TOKEN"
    $env:GITHUB_OWNER="YOUR_GITHUB_USERNAME"
    $env:GITHUB_REPO="YOUR_REPO"
    $env:GITHUB_BRANCH="main"
    node bridge/server.js

GitHub variables are optional for chat. The bridge can run without them.

## 2. Install the Studio plugin

In Roblox Studio, create/install a local plugin from `plugin/ConnectAI.plugin.lua`
using Studio's plugin development workflow. The plugin is Studio-side code, not a
game Script in ServerScriptService or StarterPlayer.

The plugin talks only to:
    http://127.0.0.1:48721

Roblox documents that Studio plugins can use HttpService and can communicate with
localhost software. You may be prompted to allow the plugin's web permission.

## 3. Important

GitHub Models' inference API was retired July 30, 2026, so this project does NOT
depend on the retired GitHub Models service. GitHub is used as repository storage
and the AI is supplied by a separate provider.

Never put a private API token directly into a distributed Roblox plugin.

## Extending scene generation

The plugin already has an `actions` channel. Add validated actions such as:
- create_model
- create_ui
- move_instance
- resize_instance
- rename_instance

Keep actions allow-listed and validate all values before modifying Studio.
