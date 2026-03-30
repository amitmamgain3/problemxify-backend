const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    let text = "";
    const filePath = req.file.path;
    const type = req.file.mimetype;
    const mode = req.body.mode || "solution";

    // 📄 PDF
    if (type === "application/pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      text = data.text;
    }

    // 🖼 IMAGE (AI OCR 🔥)
    else if (type.startsWith("image/")) {
      const base64 = fs.readFileSync(filePath, { encoding: "base64" });

      const vision = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL text exactly. Preserve math equations, formatting, and structure."
              },
              {
                type: "image_url",
                image_url: `data:image/jpeg;base64,${base64}`
              }
            ]
          }
        ]
      });

      text = vision.choices[0].message.content;
    }

    // 📄 WORD
    else if (type.includes("word") || type.includes("officedocument")) {
      const data = await mammoth.extractRawText({ path: filePath });
      text = data.value;
    }

    // 📊 EXCEL
    else if (type.includes("spreadsheet")) {
      const wb = xlsx.readFile(filePath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      text = xlsx.utils.sheet_to_csv(sheet);
    }

    // 🎯 MODE CONTROL
    let prompt = "";

    if (mode === "text") {
      prompt = "Clean and return only text properly formatted.";
    } else if (mode === "answer") {
      prompt = "Give short and direct answers only.";
    } else {
      prompt = "Solve all questions step-by-step clearly with formatting.";
    }

    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text }
      ]
    });

    fs.unlinkSync(filePath);

    res.json({
      extracted: text,
      result: ai.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Processing failed" });
  }
});

app.listen(3000, () => console.log("Server running"));
