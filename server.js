const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph } = require("docx");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ================= CHAT ================= */

app.post("/chat", async (req, res) => {
  try {

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: req.body.message
    });

    res.json({ reply: response.output_text });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ reply: "Server error" });
  }
});

/* ================= UPLOAD ================= */

app.post("/upload", upload.single("file"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let text = "";
    const filePath = req.file.path;
    const type = req.file.mimetype;

    console.log("📂 File type:", type);

    /* ===== FILE HANDLING ===== */

    if (type === "application/pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      text = data.text;
    }

    else if (type.startsWith("image/")) {
      const base64 = fs.readFileSync(filePath, { encoding: "base64" });

      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extract text clearly" },
              { type: "input_image", image_url: `data:image/jpeg;base64,${base64}` }
            ]
          }
        ]
      });

      text = response.output_text;
    }

    else if (
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      type === "application/msword"
    ) {
      const data = await mammoth.extractRawText({ path: filePath });
      text = data.value;
    }

    else if (
      type === "application/vnd.ms-excel" ||
      type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const wb = xlsx.readFile(filePath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      text = xlsx.utils.sheet_to_csv(sheet);
    }

    else {
      text = "Unsupported file format";
    }

    /* ===== AI PROCESS ===== */

    const mode = req.body.mode || "solution";

    let prompt = "";
    if (mode === "text") prompt = "Return clean text";
    else if (mode === "answer") prompt = "Give short answers";
    else prompt = "Solve step-by-step clearly";

    const ai = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `${prompt}\n\n${text}`
    });

    fs.unlinkSync(filePath);

    res.json({ result: ai.output_text });

  } catch (err) {
    console.error("🔥 Upload error:", err);
    res.status(500).json({ error: "Processing failed", details: err.message });
  }
});

/* ================= DOWNLOAD ================= */

app.post("/download-pdf", (req, res) => {
  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=result.pdf");

  doc.pipe(res);
  doc.text(req.body.text);
  doc.end();
});

app.post("/download-docx", async (req, res) => {

  const lines = req.body.text.split("\n");

  const paragraphs = lines.map(line =>
    new Paragraph({
      text: line,
      bullet: { level: 0 },
      spacing: { after: 200 }
    })
  );

  const doc = new Document({
    sections: [{ children: paragraphs }]
  });

  const buffer = await Packer.toBuffer(doc);

  res.setHeader("Content-Disposition", "attachment; filename=result.docx");
  res.send(buffer);
});

/* ================= START ================= */

app.listen(3000, () => console.log("🔥 Server running (NO LOGIN MODE)"));
