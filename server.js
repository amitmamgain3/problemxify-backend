import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: "Please enter a message" });
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
            content: "You are an AI tutor. Always give correct and clear answers. If user asks for a specific programming language like C++, Java, or Python, respond ONLY in that language. Do not switch languages."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    // Error handling
    if (data.error) {
      return res.json({ reply: "Error: " + data.error.message });
    }

    const reply = data.choices[0].message.content;

    res.json({ reply });

  } catch (error) {
    res.status(500).json({ reply: "Server error. Please try again." });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
