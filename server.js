import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🔹 ROOT CHECK
app.get("/", (req, res) => {
  res.send("✅ Problemxify Backend Running 🚀");
});

// 🔹 HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 🔹 CHAT API
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // ❌ Empty message check
    if (!message || message.trim() === "") {
      return res.status(400).json({
        reply: "❌ Please send a message"
      });
    }

    // 🔥 OpenAI API call
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

    // 🔍 Safe response extract
    let reply = "⚠️ No response from AI";

    if (data?.output?.[0]?.content?.[0]?.text) {
      reply = data.output[0].content[0].text;
    }

    res.json({ reply });

  } catch (error) {
    console.error("❌ ERROR:", error);

    res.status(500).json({
      reply: "🚨 Server error, try again later"
    });
  }
});

// 🔹 PORT (Render compatible)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
