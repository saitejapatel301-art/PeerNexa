require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "20kb" }));

const PORT = process.env.PORT || 3000;
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

const razorpay = KEY_ID && KEY_SECRET
? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET })
: null;

const allowedSpots = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "09"]);

app.use((req, res, next) => {
if (FRONTEND_ORIGIN && req.headers.origin === FRONTEND_ORIGIN) {
res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
res.setHeader("Vary", "Origin");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

if (req.method === "OPTIONS") return res.sendStatus(204);
next();
});

app.get("/health", (_req, res) => {
res.json({ ok: true, service: "PeerNexa payment server" });
});

app.post("/api/create-order", async (req, res) => {
try {
if (!razorpay) {
return res.status(503).json({
message: "Payment server keys are not configured."
});
}

```
const { spotId, name, email } = req.body || {};

if (
  !allowedSpots.has(String(spotId)) ||
  typeof name !== "string" ||
  !name.trim() ||
  typeof email !== "string" ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  return res.status(400).json({
    message: "Please provide a valid spot, name, and email."
  });
}

const order = await razorpay.orders.create({
  amount: 9900,
  currency: "INR",
  receipt: "pn_spot_" + String(spotId) + "_" + Date.now(),
  notes: {
    product: "PeerNexa spot claim",
    spot_id: String(spotId),
    buyer_name: name.trim().slice(0, 80),
    buyer_email: email.trim().slice(0, 120)
  }
});

return res.json({
  keyId: KEY_ID,
  orderId: order.id,
  amount: order.amount,
  currency: order.currency
});
```

} catch (error) {
console.error("Create order failed:", error.message);
return res.status(500).json({
message: "Could not create a payment order."
});
}
});
