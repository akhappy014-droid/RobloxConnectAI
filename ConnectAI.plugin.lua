-- Connect AI Studio Plugin
-- Set BASE_URL and BRIDGE_TOKEN to match your Render deployment.
-- Uses an in-plugin approval panel before writing generated changes into the place.

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local StudioService = game:GetService("StudioService")

local BASE_URL = "https://YOUR-RENDER-SERVICE.onrender.com"
local BRIDGE_TOKEN = "PUT_THE_SAME_RANDOM_SECRET_HERE"
local POLL_SECONDS = 3

local toolbar = plugin:CreateToolbar("Connect AI")
local openButton = toolbar:CreateButton("ConnectAI", "Open Connect AI", "rbxassetid://4458901886")
openButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 390, 540, 320, 380)
local widget = plugin:CreateDockWidgetPluginGui("ConnectAI_Bridge_v2", widgetInfo)
widget.Title = "Connect AI"

local function make(className, props, parent)
    local obj = Instance.new(className)
    for k, v in pairs(props or {}) do obj[k] = v end
    obj.Parent = parent
    return obj
end
local root = make("Frame", {BackgroundColor3 = Color3.fromRGB(15,17,25), Size = UDim2.fromScale(1,1)}, widget)
make("UIPadding", {PaddingTop=UDim.new(0,12), PaddingBottom=UDim.new(0,12), PaddingLeft=UDim.new(0,12), PaddingRight=UDim.new(0,12)}, root)
make("TextLabel", {BackgroundTransparency=1, Size=UDim2.new(1,0,0,30), Font=Enum.Font.GothamBold, Text="CONNECT AI", TextSize=20, TextColor3=Color3.fromRGB(255,76,105), TextXAlignment=Enum.TextXAlignment.Left}, root)
local status = make("TextLabel", {BackgroundTransparency=1, Position=UDim2.new(0,0,0,32), Size=UDim2.new(1,0,0,48), Font=Enum.Font.Gotham, Text="Set the Render URL and bridge secret in this plugin script.", TextSize=12, TextWrapped=true, TextColor3=Color3.fromRGB(190,195,210), TextXAlignment=Enum.TextXAlignment.Left, TextYAlignment=Enum.TextYAlignment.Top}, root)
local webButton = make("TextButton", {Position=UDim2.new(0,0,0,82), Size=UDim2.new(1,0,0,34), BackgroundColor3=Color3.fromRGB(255,49,84), TextColor3=Color3.new(1,1,1), Font=Enum.Font.GothamBold, TextSize=13, Text="Open website"}, root)
make("UICorner", {CornerRadius=UDim.new(0,8)}, webButton)
local contextButton = make("TextButton", {Position=UDim2.new(0,0,0,122), Size=UDim2.new(1,0,0,34), BackgroundColor3=Color3.fromRGB(38,42,57), TextColor3=Color3.new(1,1,1), Font=Enum.Font.GothamSemibold, TextSize=13, Text="Refresh selected objects"}, root)
make("UICorner", {CornerRadius=UDim.new(0,8)}, contextButton)
local pendingLabel = make("TextLabel", {Position=UDim2.new(0,0,0,166), Size=UDim2.new(1,0,0,44), BackgroundTransparency=1, Text="No pending changes.", TextWrapped=true, TextColor3=Color3.fromRGB(235,235,242), Font=Enum.Font.GothamSemibold, TextSize=13, TextXAlignment=Enum.TextXAlignment.Left}, root)
local approve = make("TextButton", {Position=UDim2.new(0,0,0,210), Size=UDim2.new(0.49,0,0,35), BackgroundColor3=Color3.fromRGB(42,145,91), TextColor3=Color3.new(1,1,1), Font=Enum.Font.GothamBold, TextSize=13, Text="Approve changes", Visible=false}, root)
make("UICorner", {CornerRadius=UDim.new(0,8)}, approve)
local reject = make("TextButton", {Position=UDim2.new(0.51,0,0,210), Size=UDim2.new(0.49,0,0,35), BackgroundColor3=Color3.fromRGB(145,48,66), TextColor3=Color3.new(1,1,1), Font=Enum.Font.GothamBold, TextSize=13, Text="Reject", Visible=false}, root)
make("UICorner", {CornerRadius=UDim.new(0,8)}, reject)
local log = make("TextLabel", {Position=UDim2.new(0,0,0,254), Size=UDim2.new(1,0,1,-254), BackgroundColor3=Color3.fromRGB(20,22,32), TextColor3=Color3.fromRGB(220,224,235), Font=Enum.Font.Code, TextSize=12, TextWrapped=true, TextYAlignment=Enum.TextYAlignment.Top, TextXAlignment=Enum.TextXAlignment.Left, Text="Connect AI ready.\nWaiting for the website…"}, root)
make("UIPadding", {PaddingTop=UDim.new(0,8), PaddingLeft=UDim.new(0,8), PaddingRight=UDim.new(0,8)}, log)
make("UICorner", {CornerRadius=UDim.new(0,8)}, log)

local function logLine(s)
    log.Text = os.date("%H:%M:%S") .. "  " .. tostring(s) .. "\n\n" .. log.Text
    if #log.Text > 6000 then log.Text = string.sub(log.Text,1,6000) end
end
local function request(method, route, body)
    local options = {Url=BASE_URL..route, Method=method, Headers={["x-bridge-token"]=BRIDGE_TOKEN, ["Content-Type"]="application/json"}}
    if body ~= nil then options.Body=HttpService:JSONEncode(body) end
    local response=HttpService:RequestAsync(options)
    if not response.Success then error("HTTP "..tostring(response.StatusCode)..": "..response.Body) end
    return HttpService:JSONDecode(response.Body)
end
local function selectionSummary()
    local result={}
    for _, inst in ipairs(Selection:Get()) do
        local item={name=inst.Name,className=inst.ClassName,fullName=inst:GetFullName()}
        if inst:IsA("BasePart") then
            item.position={inst.Position.X,inst.Position.Y,inst.Position.Z}
            item.size={inst.Size.X,inst.Size.Y,inst.Size.Z}
        elseif inst:IsA("LuaSourceContainer") then
            local ok, source=pcall(function() return inst.Source end)
            if ok then item.source=string.sub(source,1,6000) end
        end
        table.insert(result,item)
    end
    return result
end
local function sendContext()
    request("POST","/api/bridge/context",{placeName=game.Name,selection=selectionSummary()})
    status.Text="Connected to Render. Selection context updates automatically."
end
local function findParent(parentPath)
    local current=game
    for _, name in ipairs(parentPath or {}) do
        local nextObject=current:FindFirstChild(name)
        if not nextObject then
            nextObject=Instance.new("Folder")
            nextObject.Name=name
            nextObject.Parent=current
        end
        current=nextObject
    end
    return current
end
local materials={Plastic=Enum.Material.Plastic,Neon=Enum.Material.Neon,Wood=Enum.Material.Wood,Metal=Enum.Material.Metal,Grass=Enum.Material.Grass,Concrete=Enum.Material.Concrete,SmoothPlastic=Enum.Material.SmoothPlastic,Glass=Enum.Material.Glass,Brick=Enum.Material.Brick,Slate=Enum.Material.Slate,Sand=Enum.Material.Sand}
local function applyAction(a)
    if a.type=="create_part" then
        local s=a.size or {4,1,4}; local p=a.position or {0,5,0}
        local part=Instance.new("Part")
        part.Name=string.sub(tostring(a.name or "GeneratedPart"),1,80)
        part.Size=Vector3.new(math.clamp(tonumber(s[1]) or 4,0.2,512),math.clamp(tonumber(s[2]) or 1,0.2,512),math.clamp(tonumber(s[3]) or 4,0.2,512))
        part.Position=Vector3.new(math.clamp(tonumber(p[1]) or 0,-100000,100000),math.clamp(tonumber(p[2]) or 5,-100000,100000),math.clamp(tonumber(p[3]) or 0,-100000,100000))
        part.Anchored=a.anchored~=false
        part.Material=materials[a.material] or Enum.Material.Plastic
        local ok, bc=pcall(function() return BrickColor.new(tostring(a.color or "Bright blue")) end)
        if ok then part.BrickColor=bc end
        part.Parent=workspace
        return "Created Part "..part.Name
    elseif a.type=="create_model" then
        local m=Instance.new("Model"); m.Name=string.sub(tostring(a.name or "GeneratedModel"),1,80); m.Parent=workspace
        return "Created Model "..m.Name
    elseif a.type=="create_folder" then
        local parent=findParent(a.parentPath or {})
        local f=Instance.new("Folder"); f.Name=string.sub(tostring(a.name or "GeneratedFolder"),1,80); f.Parent=parent
        return "Created Folder "..f:GetFullName()
    elseif a.type=="create_script" then
        local parent=findParent(a.parentPath or {})
        local allowed={Script=true,LocalScript=true,ModuleScript=true}
        local className=allowed[a.className] and a.className or "Script"
        local obj=Instance.new(className); obj.Name=string.sub(tostring(a.name or "GeneratedScript"),1,80)
        obj.Source=tostring(a.source or ""); obj.Parent=parent
        return "Wrote "..className.." "..obj:GetFullName()
    elseif a.type=="set_script_source" then
        local target
        for _, inst in ipairs(Selection:Get()) do
            if inst:IsA("LuaSourceContainer") and inst.Name==a.name then target=inst break end
        end
        if not target then error("Select the exact script named "..tostring(a.name).." before asking to replace it.") end
        target.Source=tostring(a.source or "")
        return "Rewrote "..target:GetFullName()
    end
    error("Unsupported action: "..tostring(a.type))
end

local pendingJob=nil
local busy=false
local function clearPending()
    pendingJob=nil
    approve.Visible=false
    reject.Visible=false
    pendingLabel.Text="No pending changes."
end
approve.Activated:Connect(function()
    if not pendingJob or busy then return end
    busy=true; approve.Active=false; reject.Active=false
    local recording
    pcall(function() recording=ChangeHistoryService:TryBeginRecording("Connect AI changes") end)
    local successes, failures=0,0
    for _, action in ipairs(pendingJob.actions or {}) do
        local ok, result=pcall(applyAction,action)
        if ok then successes+=1; logLine(result) else failures+=1; logLine("FAILED: "..tostring(result)) end
    end
    if recording then pcall(function() ChangeHistoryService:FinishRecording(recording,Enum.FinishRecordingOperation.Commit) end) end
    status.Text="Finished: "..successes.." succeeded, "..failures.." failed. Use Studio Undo if needed."
    clearPending()
    busy=false; approve.Active=true; reject.Active=true
end)
reject.Activated:Connect(function()
    if pendingJob then logLine("Rejected pending AI changes.") end
    clearPending()
end)
webButton.Activated:Connect(function()
    local ok,err=pcall(function() StudioService:OpenUrl(BASE_URL) end)
    if not ok then status.Text="Open this website manually: "..BASE_URL; logLine(err) end
end)
contextButton.Activated:Connect(function()
    local ok,err=pcall(sendContext)
    if ok then logLine("Selection context refreshed.") else status.Text="Connection failed. Check URL/token/HTTP settings."; logLine(err) end
end)
openButton.Click:Connect(function() widget.Enabled=not widget.Enabled end)

local running=true
task.spawn(function()
    while running do
        task.wait(POLL_SECONDS)
        if widget.Parent and not busy then
            local ok,err=pcall(function()
                sendContext()
                if not pendingJob then
                    local job=request("GET","/api/bridge/next")
                    if job and job.actions and #job.actions>0 then
                        pendingJob=job
                        pendingLabel.Text="AI proposes "..#job.actions.." change(s). Approve to write into Studio."
                        approve.Visible=true; reject.Visible=true
                        logLine("Received "..#job.actions.." proposed change(s). Review and approve.")
                    end
                end
            end)
            if not ok then status.Text="Bridge connection error. Check Render URL, token, and HTTP settings."; logLine(err) end
        end
    end
end)
plugin.Unloading:Connect(function() running=false end)
