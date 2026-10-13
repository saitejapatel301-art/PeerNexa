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

const razorpay =
KEY_ID && KEY_SECRET
? new Razorpay({
key_id: KEY_ID,
key_secret: KEY_SECRET
})
: null;

const allowedSpots = new Set([
"01", "02", "03", "04", "05",
"06", "07", "08", "09"
]);

// CORS configuration for the PeerNexa website
app.use((req, res, next) => {
if (FRONTEND_ORIGIN && req.headers.origin === FRONTEND_ORIGIN) {
res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
res.setHeader("Vary", "Origin");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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

// Create a Razorpay order for a ₹99 spot
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
  typeof razorpay_signature !== "string"
) {
  return res.status(400).json({
    verified: false,
    message: "Missing payment verification details."
  });
}

const expectedSignature = crypto
  .createHmac("sha256", KEY_SECRET)
  .update(razorpay_order_id + "|" + razorpay_payment_id)
  .digest("hex");

const signaturesMatch =
  expectedSignature.length === razorpay_signature.length &&
  crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(razorpay_signature, "hex")
  );

if (!signaturesMatch) {
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

// Start the server (required for Render)
app.listen(PORT, () => {
console.log("PeerNexa server listening on port " + PORT);
});
