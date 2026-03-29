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

/* =========================
   🔹 CHAT ROUTE
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
        input: userMessage
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
   🔹 TEACHER TOOL (MULTI FILE + ANSWER MODE)
========================= */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const mode = req.body.mode || "text";
    const file = req.file;

    let extractedText = "";

    // 🔥 FILE TYPE CHECK
    if (file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text;
    } else {
      // Image OCR via AI
      const base64Image = file.buffer.toString("base64");

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
                  text: "Extract all text exactly as it appears. Preserve formatting, line breaks, and numbering."
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
      extractedText = data.output?.[0]?.content?.[0]?.text || "";
    }

    // 🔥 ANSWER GENERATION MODE
    if (mode === "answer") {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: `
You are a professional teacher.

Convert the following content into a well-structured question-answer format.

Rules:
- Use format Q1, Q2, Q3
- Write "Ans:" below each question
- Keep answers clear and easy
- Use bullet points if needed
- Highlight important keywords
- Maintain clean spacing

Content:
${extractedText}
`
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

/* =========================
   🔹 TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

/* =========================
   🔹 START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
