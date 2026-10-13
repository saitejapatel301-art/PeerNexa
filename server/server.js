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

const allowedSpots = new Set([
"01", "02", "03", "04", "05",
"06", "07", "08", "09"
]);

const allowedOrigins = new Set([
"https://saitejapatel301-art.github.io",
FRONTEND_ORIGIN
].filter(Boolean));

// Allow requests from the PeerNexa website
app.use((req, res, next) => {
const origin = req.headers.origin;

if (origin && allowedOrigins.has(origin)) {
res.setHeader("Access-Control-Allow-Origin", origin);
res.setHeader("Vary", "Origin");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

if (req.method === "OPTIONS") {
return res.sendStatus(204);
}

next();
});

// Health check
app.get("/health", (_req, res) => {
res.json({
ok: true,
service: "PeerNexa payment server"
});
});

// Create a ₹99 spot order
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
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
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

```
return res.status(500).json({
  message: "Could not create a payment order."
});
```

}
});

// Verify Razorpay payment signature
app.post("/api/verify-payment", (req, res) => {
try {
if (!KEY_SECRET) {
return res.status(503).json({
verified: false,
message: "Payment server keys are not configured."
});
}

```
const {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
} = req.body || {};

if (
  typeof razorpay_order_id !== "string" ||
  typeof razorpay_payment_id !== "string" ||
  typeof razorpay_signature !== "string" ||
  !/^[a-f0-9]{64}$/i.test(razorpay_signature)
) {
  return res.status(400).json({
    verified: false,
    message: "Missing or invalid payment details."
  });
}

const expectedSignature = crypto
  .createHmac("sha256", KEY_SECRET)
  .update(razorpay_order_id + "|" + razorpay_payment_id)
  .digest("hex");

const actualBuffer = Buffer.from(razorpay_signature, "hex");
const expectedBuffer = Buffer.from(expectedSignature, "hex");

if (
  actualBuffer.length !== expectedBuffer.length ||
  !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
) {
  return res.status(400).json({
    verified: false,
    message: "Payment signature verification failed."
  });
}

return res.json({
  verified: true,
  message: "Payment signature verified successfully."
});
```

} catch (error) {
console.error("Payment verification failed:", error.message);

```
return res.status(500).json({
  verified: false,
  message: "Could not verify payment."
});
```

}
});

// Start the server
app.listen(PORT, () => {
console.log("PeerNexa server listening on port " + PORT);
});
