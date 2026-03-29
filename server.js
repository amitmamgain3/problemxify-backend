import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import pdfParse from "pdf-parse";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const mode = req.body.mode || "text";
    const file = req.file;

    let extractedText = "";

    // 🔥 FILE TYPE CHECK
    if (file.mimetype === "application/pdf") {
      // PDF extract
      const data = await pdfParse(file.buffer);
      extractedText = data.text;
    } else {
      // Image processing (AI)
      const base64Image = file.buffer.toString("base64");

      let promptText = "";

      if (mode === "answer") {
        promptText = `
Extract all questions and generate answers clearly.
Format:
Q1. Question
Ans: Answer
`;
      } else {
        promptText = `
Extract text exactly as it appears.
Preserve formatting.
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
                { type: "input_text", text: promptText },
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
      extractedText = data.output?.[0]?.content?.[0]?.text || "";
    }

    // 🔥 ANSWER GENERATION FOR PDF OR TEXT
    if (mode === "answer") {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: `Generate answers for the following:\n${extractedText}`
        })
      });

      const data = await response.json();
      extractedText = data.output?.[0]?.content?.[0]?.text || extractedText;
    }

    res.json({ text: extractedText });

  } catch (error) {
    console.error(error);
    res.status(500).json({ text: "Error processing file" });
  }
});

app.listen(PORT, () => {
  console.log("Server running...");
});
