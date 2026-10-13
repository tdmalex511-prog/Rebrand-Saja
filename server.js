
const express = require("express");

const app = express();
app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 3000;

// Demo key. Gerçek kullanımda Render Environment
// değişkeni üzerinden ayarlayın.
const VIP_KEY = process.env.VIP_KEY;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "VIP License API",
    version: "1.0.0"
  });
});

app.post("/api/verify", (req, res) => {
  const key =
    typeof req.body?.key === "string"
      ? req.body.key.trim()
      : "";

  if (!key) {
    return res.status(400).json({
      valid: false,
      message: "Key girilmedi."
    });
  }

  if (!VIP_KEY) {
    return res.status(503).json({
      valid: false,
      message: "Lisans sistemi yapılandırılmamış."
    });
  }

  if (key !== VIP_KEY) {
    return res.status(401).json({
      valid: false,
      message: "Geçersiz key."
    });
  }

  return res.json({
    valid: true,
    message: "Lisans doğrulandı."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`VIP License API listening on port ${PORT}`);
});
