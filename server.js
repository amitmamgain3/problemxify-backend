import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.send("✅ Problemxify Backend is Running 🚀");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Chat API
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        reply: "❌ Please send a message"
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: message
      })
    });

    const data = await response.json();

    let reply = "⚠️ No response from AI";

    if (data?.output?.[0]?.content?.[0]?.text) {
      reply = data.output[0].content[0].text;
    }

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      reply: "🚨 Server error, try again"
    });
  }
});

// PORT (Render compatible)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
