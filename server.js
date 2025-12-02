import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// In-memory session store
const sessions = {};

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  // Initialize session if not exists
  if (!sessions[sessionId]) {
    sessions[sessionId] = { mood: "annoyed", history: [], resolved: false };
  }

  const session = sessions[sessionId];
  session.history.push({ role: "user", content: message });

  // Detect if user is asking for rating
  const ratingAsked = /(rate|rating|score).*(service|today|chat)/i.test(message);

  // Prevent rating before resolution
  if (ratingAsked && !session.resolved) {
    return res.json({
      error: "NOT_RESOLVED",
      message: "Please provide a solution before asking for a rating.",
      mood: session.mood
    });
  }

  // Prepare system prompt
  let systemPrompt = "";
  if (ratingAsked) {
    systemPrompt = `
You are Alex, a customer who could not log in to their account. 
Rate the learner's service **only after the issue is resolved**.
Assess based on three skills:
1. Empathy
2. Asking clarifying questions
3. Resolving efficiently

Respond **strictly in JSON format only**:
{ "rating": number, "comment": "short feedback" }

Do not include any text outside the JSON.
Example: { "rating": 9, "comment": "Very helpful and patient." }
`;
  } else {
    systemPrompt = `
You are Alex, a mildly frustrated customer who cannot log in to their account.
Respond naturally in 2-3 sentences.

Rules:
- Only give info when asked.
- If learner provides a working solution (password reset link, temporary password, instructions to log in), include the word "RESOLVED" in your reply (do not include !).
- Continuously assess the learner on:
  1. Empathy
  2. Asking clarifying questions
  3. Resolving efficiently
- Track mood: "annoyed" → "neutral" → "calm" depending on helpfulness.
- If the user asks for rating before resolution, reply: "Please provide a solution before asking for a rating."
`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...session.history.slice(-6)
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages
      })
    });

    let aiReply = (await response.json()).choices[0].message.content.trim();

    // Detect resolution
    if (/RESOLVED/i.test(aiReply) || /(successfully reset|able to log in|issue resolved)/i.test(aiReply)) {
      session.resolved = true;
      aiReply = aiReply.replace(/RESOLVED/i, "").trim();
    }

    // Update mood
    if (session.resolved) {
      session.mood = "calm";
    } else if (/thank|appreciate|good|helpful|try/i.test(aiReply)) {
      session.mood = "neutral";
    } else {
      session.mood = "annoyed";
    }

    // Handle rating
    if (ratingAsked && session.resolved) {
      let ratingObj = { rating: 5, comment: "Average service." };
      try {
        // Match JSON anywhere in the AI reply
        const jsonMatch = aiReply.replace(/\n/g, "").match(/\{[^]*\}/);
        if (jsonMatch) ratingObj = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Failed to parse AI JSON:", err, "AI reply:", aiReply);
      }
      return res.json({ ...ratingObj, mood: session.mood });
    }

    // Save AI reply
    session.history.push({ role: "assistant", content: aiReply });

    res.json({
      reply: aiReply,
      mood: session.mood,
      resolved: session.resolved
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong", mood: session.mood });
  }
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000 ✅"));
