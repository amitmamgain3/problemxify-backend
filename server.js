import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// File upload setup
const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   🔹 AI CHAT ROUTE
========================= */
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant. Always reply in the same language as the user. If user asks for code, strictly follow the requested programming language."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data.output?.[0]?.content?.[0]?.text || "No response";

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Server error" });
  }
});

/* =========================
   🔹 TEACHER TOOL (OCR + ANSWER MODE)
========================= */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const mode = req.body.mode || "text"; // text or answer
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");

    let promptText = "";

    if (mode === "answer") {
      promptText = `
Extract all questions from this image and generate accurate answers.
Format properly like:

Q1. Question
Ans: Answer

Q2. Question
Ans: Answer

Keep answers clear and correct.
`;
    } else {
      promptText = `
Extract all text EXACTLY as it appears in the image.
Preserve line breaks, formatting, numbering, and math equations.
Do not change anything.
`;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: promptText
              },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${base64Image}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    const result =
      data.output?.[0]?.content?.[0]?.text || "No result found.";

    res.json({ text: result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ text: "Error processing image" });
  }
});

/* =========================
   🔹 TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Problemxify Backend Running 🚀");
});

/* =========================
   🔹 SERVER START
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
