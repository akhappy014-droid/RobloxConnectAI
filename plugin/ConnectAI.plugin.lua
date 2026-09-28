-- Roblox Connect AI - Studio Plugin
-- Install this file as a Studio plugin. It is NOT a game/server script.
-- The plugin talks to the local bridge at http://127.0.0.1:48721

local HttpService = game:GetService("HttpService")
local StudioService = game:GetService("StudioService")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local toolbar = plugin:CreateToolbar("Connect AI")
local button = toolbar:CreateButton("Connect AI", "Open Connect AI", "")

local info = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right,
	true, true, 420, 650, 320, 420
)
local widget = plugin:CreateDockWidgetPluginGui("ConnectAIWidget", info)
widget.Title = "Connect AI"

local function new(className, props, parent)
	local o = Instance.new(className)
	for k,v in pairs(props or {}) do o[k] = v end
	o.Parent = parent
	return o
end

local root = new("Frame", {BackgroundColor3=Color3.fromRGB(20,20,24), Size=UDim2.fromScale(1,1)}, widget)
local top = new("Frame", {BackgroundColor3=Color3.fromRGB(28,28,34), Size=UDim2.new(1,0,0,48)}, root)
new("TextLabel", {
	BackgroundTransparency=1, Position=UDim2.new(0,14,0,0), Size=UDim2.new(1,-28,1,0),
	Text="CONNECT AI", TextColor3=Color3.fromRGB(255,255,255), TextSize=18,
	Font=Enum.Font.GothamBold, TextXAlignment=Enum.TextXAlignment.Left
}, top)

local status = new("TextLabel", {
	BackgroundTransparency=1, Position=UDim2.new(0,14,0,31), Size=UDim2.new(1,-28,0,14),
	Text="Bridge: checking...", TextColor3=Color3.fromRGB(150,150,160), TextSize=10,
	Font=Enum.Font.Gotham
}, top)

local chat = new("ScrollingFrame", {
	BackgroundTransparency=1, Position=UDim2.new(0,8,0,56), Size=UDim2.new(1,-16,1,-130),
	CanvasSize=UDim2.new(), AutomaticCanvasSize=Enum.AutomaticSize.Y,
	ScrollBarThickness=5, BorderSizePixel=0
}, root)
new("UIListLayout", {Padding=UDim.new(0,8), SortOrder=Enum.SortOrder.LayoutOrder}, chat)
new("UIPadding", {PaddingTop=UDim.new(0,6), PaddingBottom=UDim.new(0,10)}, chat)

local input = new("TextBox", {
	BackgroundColor3=Color3.fromRGB(31,31,38), Position=UDim2.new(0,10,1,-62),
	Size=UDim2.new(1,-88,0,48), ClearTextOnFocus=false, MultiLine=true,
	PlaceholderText="Ask Connect AI anything...", Text="", TextColor3=Color3.fromRGB(240,240,245),
	PlaceholderColor3=Color3.fromRGB(120,120,130), TextSize=14, Font=Enum.Font.Gotham,
	TextXAlignment=Enum.TextXAlignment.Left, TextYAlignment=Enum.TextYAlignment.Top
}, root)
new("UICorner", {CornerRadius=UDim.new(0,8)}, input)

local send = new("TextButton", {
	BackgroundColor3=Color3.fromRGB(80,120,255), Position=UDim2.new(1,-70,1,-62),
	Size=UDim2.new(0,60,0,48), Text="Send", TextColor3=Color3.new(1,1,1),
	TextSize=13, Font=Enum.Font.GothamBold
}, root)
new("UICorner", {CornerRadius=UDim.new(0,8)}, send)

local function bubble(text, mine)
	local f = new("Frame", {
		BackgroundColor3=mine and Color3.fromRGB(48,70,125) or Color3.fromRGB(34,34,42),
		AutomaticSize=Enum.AutomaticSize.Y, Size=UDim2.new(1,-4,0,0)
	}, chat)
	new("UICorner", {CornerRadius=UDim.new(0,8)}, f)
	local l = new("TextLabel", {
		BackgroundTransparency=1, AutomaticSize=Enum.AutomaticSize.Y,
		Size=UDim2.new(1,-20,0,0), Position=UDim2.new(0,10,0,8),
		Text=text, TextWrapped=true, TextColor3=Color3.fromRGB(235,235,240),
		TextSize=13, Font=Enum.Font.Gotham, TextXAlignment=Enum.TextXAlignment.Left,
		TextYAlignment=Enum.TextYAlignment.Top
	}, f)
	new("UIPadding", {PaddingBottom=UDim.new(0,8)}, f)
	task.defer(function()
		chat.CanvasPosition = Vector2.new(0, math.max(0, chat.AbsoluteCanvasSize.Y))
	end)
end

local function request(path, body)
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = "http://127.0.0.1:48721" .. path,
			Method = "POST",
			Headers = {["Content-Type"]="application/json"},
			Body = HttpService:JSONEncode(body or {})
		})
	end)
	if not ok then return false, tostring(result) end
	if not result.Success then return false, result.Body or ("HTTP "..result.StatusCode) end
	local decodeOk, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
	if not decodeOk then return false, result.Body end
	return true, data
end

local history = {}

local function sendMessage()
	local msg = input.Text:gsub("^%s+",""):gsub("%s+$","")
	if msg == "" then return end
	input.Text = ""
	bubble(msg, true)

	task.spawn(function()
		send.Active = false
		send.Text = "..."
		local ok, data = request("/chat", {
			message = msg,
			history = history,
			selection = (function()
				local out = {}
				for _, inst in ipairs(Selection:Get()) do
					table.insert(out, inst:GetFullName())
				end
				return out
			end)()
		})
		send.Active = true
		send.Text = "Send"

		if not ok then
			bubble("Bridge error: "..tostring(data), false)
			return
		end

		local answer = data.answer or "No answer returned."
		bubble(answer, false)
		table.insert(history, {role="user", content=msg})
		table.insert(history, {role="assistant", content=answer})

		-- Optional structured scene actions returned by the bridge.
		if type(data.actions) == "table" and #data.actions > 0 then
			local record = ChangeHistoryService:TryBeginRecording("Connect AI")
			local made = 0
			for _, a in ipairs(data.actions) do
				if a.type == "create_part" then
					local p = Instance.new("Part")
					p.Name = tostring(a.name or "AI_Part")
					p.Size = Vector3.new(
						tonumber(a.sizeX) or 4, tonumber(a.sizeY) or 1, tonumber(a.sizeZ) or 4
					)
					p.Position = Vector3.new(
						tonumber(a.x) or 0, tonumber(a.y) or 3, tonumber(a.z) or 0
					)
					p.Anchored = true
					p.Parent = workspace
					made += 1
				elseif a.type == "create_folder" then
					local f = Instance.new("Folder")
					f.Name = tostring(a.name or "AI_Folder")
					f.Parent = workspace
					made += 1
				end
			end
			if record then ChangeHistoryService:FinishRecording(record, Enum.FinishRecordingOperation.Commit) end
			if made > 0 then bubble("Created "..made.." Studio object(s).", false) end
		end
	end)
end

send.MouseButton1Click:Connect(sendMessage)
input.FocusLost:Connect(function(enterPressed)
	if enterPressed and not input.MultiLine then sendMessage() end
end)

button.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

task.spawn(function()
	local ok, data = request("/health", {})
	if ok and data.ok then
		status.Text = "Bridge: connected"
		status.TextColor3 = Color3.fromRGB(90,220,130)
	else
		status.Text = "Bridge: offline — start bridge"
	end
end)
