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
            content: "You are a helpful AI assistant. Always respond clearly. If user asks for code, follow their requested programming language strictly."
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
   🔹 TEACHER TOOL (IMAGE → TEXT)
========================= */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");

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
                text: "Extract all text from this image clearly. Keep formatting clean and readable."
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

    const extractedText =
      data.output?.[0]?.content?.[0]?.text || "No text found.";

    res.json({ text: extractedText });

  } catch (error) {
    console.error(error);
    res.status(500).json({ text: "Error processing image" });
  }
});

/* =========================
   🔹 TEST ROUTE (optional)
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
