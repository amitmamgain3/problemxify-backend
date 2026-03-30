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

// USERS STORAGE
let users = [];

/* ================= AUTH ================= */

// SIGNUP
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  users.push({
    email,
    password: hashed,
    usage: 0,
    plan: "free"
  });

  res.json({ message: "User created" });
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign({ email }, SECRET, { expiresIn: "7d" });

  res.json({ token });
});

/* ================= AUTH MIDDLEWARE ================= */

function authMiddleware(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ================= USAGE CONTROL ================= */

function checkUsage(user) {
  if (user.plan === "paid") return true;

  if (user.usage >= 5) return false;

  user.usage++;
  return true;
}

/* ================= CHAT ================= */

app.post("/chat", authMiddleware, async (req, res) => {
  try {
    const user = users.find(u => u.email === req.user.email);

    if (!checkUsage(user)) {
      return res.json({ reply: "❌ Free limit reached. Upgrade plan." });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: req.body.message
    });

    res.json({ reply: response.output_text });

  } catch {
    res.status(500).json({ reply: "Server error" });
  }
});

/* ================= TEACHER TOOL ================= */

app.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const user = users.find(u => u.email === req.user.email);

    if (!checkUsage(user)) {
      return res.status(403).json({ error: "Limit reached" });
    }

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
              { type: "input_text", text: "Extract text clearly including math." },
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
    else if (type.includes("word")) {
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
    if (mode === "text") prompt = "Return clean text.";
    else if (mode === "answer") prompt = "Give short answers.";
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
    res.status(500).json({ error: "Processing failed" });
  }
});

/* ================= PDF ================= */

app.post("/download-pdf", authMiddleware, (req, res) => {
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

/* ================= DOCX ================= */

app.post("/download-docx", authMiddleware, async (req, res) => {
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

/* ================= START ================= */

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
