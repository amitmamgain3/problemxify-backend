import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Chat API
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

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
1. Understand any language (Hindi, English, Hinglish, etc.).
2. ALWAYS reply in English unless user clearly asks for another language.
3. If user asks for programming code, respond ONLY in that programming language (C++, Python, Java, etc.).
4. Do not switch languages randomly.
5. Keep answers clean, structured, and easy to read.
6. Give short and correct answers.
`
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    // Handle API error
    if (data.error) {
      console.error(data.error);
      return res.json({ reply: "API Error: " + data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || "No response received.";

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Server error. Please try again." });
  }
});

// Server start
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
