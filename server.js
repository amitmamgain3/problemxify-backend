const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ dest: "uploads/" });

// CHAT
app.post("/chat", async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: req.body.message }]
    });

    res.json({ reply: response.choices[0].message.content });
  } catch {
    res.status(500).json({ reply: "Server error" });
  }
});

// TEACHER TOOL
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    let text = "";
    const filePath = req.file.path;

    if (req.file.mimetype === "application/pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      text = data.text;
    } else {
      const result = await Tesseract.recognize(filePath, "eng");
      text = result.data.text;
    }

    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Solve questions clearly with proper steps and formatting."
        },
        { role: "user", content: text }
      ]
    });

    fs.unlinkSync(filePath);

    res.json({
      extracted: text,
      answer: ai.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: "Processing failed" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
