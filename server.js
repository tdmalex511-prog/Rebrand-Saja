const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');

const REPO_OWNER = "NivoCheats";
const REPO_NAME = "json";
const BRANCH = "main";

// Cihaz sınırlarını takip etmek için bellek içi yapı
const hwidStorage = {};

const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Invalid Method');
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const params = querystring.parse(body);
            const userKey = params.key;
            const userHWID = params.hwid;

            if (!userKey || !userHWID) {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('return { status = "error", message = "Missing Params" }');
                return;
            }

            // 1. GitHub'dan keylist.lua dosyasını çekme
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/keylist.lua`;
            
            https.get(rawUrl, (githubRes) => {
                let luaContent = '';
                githubRes.on('data', chunk => { luaContent += chunk; });
                githubRes.on('end', () => {
                    if (githubRes.statusCode !== 200) {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('return { status = "error", message = "DB Error" }');
                        return;
                    }

                    // 2. Anahtarı ve detaylarını bulma
                    const keyPattern = new RegExp(`\\["${userKey}"\\]\\s*=\\s*\\{([^}]+)\\}`, 's');
                    const match = luaContent.match(keyPattern);

                    if (!match) {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('return { status = "error", message = "Key Not Found" }');
                        return;
                    }

                    const details = match[1];
                    if (details.includes('valid = false')) {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('return { status = "error", message = "Key Blocked" }');
                        return;
                    }

                    // Cihaz limitini okuma (belirtilmemişse varsayılan 1)
                    const limitMatch = details.match(/max_devices\s*=\s*(\d+)/);
                    const maxDevices = limitMatch ? parseInt(limitMatch[1]) : 1;

                    // 3. HWID ve Cihaz Sınırı Kontrolü
                    if (!hwidStorage[userKey]) {
                        hwidStorage[userKey] = [];
                    }
                    let hwidList = hwidStorage[userKey];

                    if (!hwidList.includes(userHWID)) {
                        if (hwidList.length < maxDevices) {
                            hwidList.push(userHWID);
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/plain' });
                            res.end(`return { status = "error", message = "Limit Reached (${maxDevices} Devices Only)" }`);
                            return;
                        }
                    }

                    // BAŞARILI YANITI
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end(`return { status = "success", message = "Active", limit = ${maxDevices} }`);
                });
            }).on('error', (err) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(`return { status = "error", message = "Network Error" }`);
            });

        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`return { status = "error", message = "Server Error" }`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
