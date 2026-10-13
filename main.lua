
-- VIP License Panel - Lua demo
-- Standalone console version

local API_URL = "https://rebrand-saja-2.onrender.com/api/verify"

local function show_panel()
    print("")
    print("==============================")
    print("       VIP ACCESS PANEL")
    print("==============================")
    print("Lisans anahtarini gir:")
    io.write("> ")

    local key = io.read("*l")
    if not key or key == "" then
        print("Hata: Anahtar bos olamaz.")
        return
    end

    print("Anahtar alindi.")
    print("Sunucu dogrulamasi icin HTTP istemcisi gerekir.")
    print("API: " .. API_URL)
end

show_panel()
