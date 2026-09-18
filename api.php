local userKey = tostring(getgenv().InputKey or "") 
local panelUrl = "http://starbabvip.kesug.com/api.php?key=" .. userKey

local success, response = pcall(function()
    return game:HttpGet(panelUrl)
end)

if success and response == "success" then
    local BRPlayerCharacterBase = {
        ServerRPC = {},
        ClientRPC = {},
        MulticastRPC = {},
        LuaEventContainer = {}
    }
    
    -- (Devamındaki orijinal kodlarınız burada yer alacak)
else
    return
end
