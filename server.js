const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const { OpenAI } = require("openai");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph } = require("docx");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ dest: "uploads/" });

/* ================= CHAT ================= */
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

/* ================= TEACHER TOOL ================= */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    let text = "";
    const filePath = req.file.path;
    const type = req.file.mimetype;
    const mode = req.body.mode || "solution";

    // PDF
    if (type === "application/pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      text = data.text;
    }

    // IMAGE (AI OCR 🔥)
    else if (type.startsWith("image/")) {
      const base64 = fs.readFileSync(filePath, { encoding: "base64" });

      const vision = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract text exactly with math formatting." },
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

    // WORD
    else if (type.includes("word") || type.includes("officedocument")) {
      const data = await mammoth.extractRawText({ path: filePath });
      text = data.value;
    }

    // EXCEL
    else if (type.includes("spreadsheet")) {
      const wb = xlsx.readFile(filePath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      text = xlsx.utils.sheet_to_csv(sheet);
    }

    // MODE
    let prompt = "";
    if (mode === "text") prompt = "Return clean formatted text only.";
    else if (mode === "answer") prompt = "Give short direct answers.";
    else prompt = "Solve step-by-step clearly.";

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
    res.status(500).json({ error: "Processing failed" });
  }
});

/* ================= PDF DOWNLOAD ================= */
app.post("/download-pdf", (req, res) => {
  const text = req.body.text;

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=result.pdf");

  doc.pipe(res);

  doc.fontSize(18).text("AI Result", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(text);

  doc.end();
});

/* ================= DOCX DOWNLOAD ================= */
app.post("/download-docx", async (req, res) => {
  const text = req.body.text;

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph("AI Result"),
        new Paragraph(text)
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);

  res.setHeader("Content-Disposition", "attachment; filename=result.docx");
  res.send(buffer);
});

app.listen(3000, () => console.log("Server running"));
