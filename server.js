const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph } = require("docx");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ dest: "uploads/" });

const SECRET = "mysecretkey";
let users = [];

/* ================= AUTH ================= */

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);
    users.push({ email, password: hashed });

    res.json({ message: "User created" });
  } catch {
    res.status(500).json({ error: "Signup failed" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ email }, SECRET, { expiresIn: "7d" });

    res.json({ token });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

/* ================= CHAT ================= */

app.post("/chat", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: req.body.message
    });

    const reply = response.output_text;

    res.json({ reply });
  } catch (err) {
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

    // IMAGE (AI OCR)
    else if (type.startsWith("image/")) {
      const base64 = fs.readFileSync(filePath, { encoding: "base64" });

      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Extract all text clearly including math."
              },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${base64}`
              }
            ]
          }
        ]
      });

      text = response.output_text;
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

    // MODE CONTROL
    let prompt = "";
    if (mode === "text") prompt = "Clean and return text only.";
    else if (mode === "answer") prompt = "Give short direct answers.";
    else prompt = "Solve step-by-step clearly.";

    const ai = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `${prompt}\n\n${text}`
    });

    fs.unlinkSync(filePath);

    res.json({
      extracted: text,
      result: ai.output_text
    });

  } catch (err) {
    console.error(err);
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
    sections: [
      {
        children: [
          new Paragraph("AI Result"),
          new Paragraph(text)
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);

  res.setHeader("Content-Disposition", "attachment; filename=result.docx");
  res.send(buffer);
});

/* ================= START ================= */

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
