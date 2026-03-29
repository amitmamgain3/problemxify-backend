import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const history = req.body.history || [];

  if (!userMessage || userMessage.trim() === "") {
    return res.status(400).json({ reply: "Please enter a valid message." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are an AI assistant for students.

Rules:
1. Understand any language (Hindi, English, Hinglish).
2. Always reply in English unless user asks otherwise.
3. Remember previous conversation context.
4. If user already specified programming language, DO NOT ask again.
5. If user asks for code, respond only in that language.
6. Give clean and structured answers.
`
          },
          ...history,
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.json({ reply: "Error: " + data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || "No response.";

    res.json({ reply });

  } catch (error) {
    res.status(500).json({ reply: "Server error." });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
