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
return res.status(503).json({ message: "Payment keys are not configured." });
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
  return res.status(400).json({ message: "Enter a valid spot, name, and email." });
}

const order = await razorpay.orders.create({
  amount: 9900,
  currency: "INR",
  receipt: `pn_spot_${spotId}_${Date.now()}`,
  notes: {
    product: "PeerNexa spot claim",
    spot_id: String(spotId),
    buyer_name: name.trim().slice(0, 80),
    buyer_email: email.trim().slice(0, 120)
  }
});

res.json({
  keyId: KEY_ID,
  orderId: order.id,
  amount: order.amount,
  currency: order.currency
});
```

} catch (error) {
console.error("Create order failed:", error.message);
res.status(500).json({ message: "Could not create payment order." });
}
});

app.post("/api/verify-payment", async (req, res) => {
try {
if (!KEY_SECRET) {
return res.status(503).json({ verified: false, message: "Payment keys are not configured." });
}

```
const {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  spotId
} = req.body || {};

if (
  !razorpay_order_id ||
  !razorpay_payment_id ||
  !razorpay_signature ||
  !allowedSpots.has(String(spotId))
) {
  return res.status(400).json({ verified: false, message: "Invalid payment details." });
}

const expected = crypto
  .createHmac("sha256", KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest("hex");

const a = Buffer.from(expected, "hex");
const b = Buffer.from(String(razorpay_signature), "hex");

if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return res.status(400).json({ verified: false, message: "Payment signature did not match." });
}

res.json({
  verified: true,
  message: "Signature verified; spot ownership storage is not configured."
});
```

} catch (error) {
console.error("Verification failed:", error.message);
res.status(500).json({ verified: false, message: "Could not verify payment." });
}
});

app.listen(PORT, () => {
console.log(`PeerNexa server listening on port ${PORT}`);
});
