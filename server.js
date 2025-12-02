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

// Memory storage for sessions
const sessions = {};

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  if (!sessions[sessionId]) {
    sessions[sessionId] = { mood: "annoyed", history: [], resolved: false };
  }

  const session = sessions[sessionId];
  session.history.push({ role: "user", content: message });

  const ratingAsked = /(rate|rating|score).*(service|today|chat)/i.test(message);

  if (ratingAsked && !session.resolved) {
    return res.json({
      error: "NOT_RESOLVED",
      message: "Please provide a solution before asking for a rating.",
      mood: session.mood
    });
  }

  // System prompt
  let systemPrompt = "";
  if (ratingAsked) {
    systemPrompt = `
You are Alex, a customer who could not log in to their account. 
Based on the conversation history, rate the learner's service on a scale from 1-10.
- Assess the learner based on three skills: empathy, clarifying questions, resolving efficiently.
- Respond in strict JSON only: { "rating": number, "comment": "short feedback" }
- Example: { "rating": 9, "comment": "Very helpful and patient." }
`;
  } else {
    systemPrompt = `
You are Alex, a customer who cannot log in to their account.
Act mildly frustrated but polite.
Respond naturally in 2-3 sentences.

Rules:
- Only give information when asked.
- If the learner provides a working solution (password reset link, temporary password, instructions to log in), include the word RESOLVED somewhere in your response to indicate the issue is resolved.
- While chatting, continuously assess the learner based on three skills:
  1. Empathy
  2. Asking clarifying questions
  3. Resolving efficiently
- Track mood: annoyed → neutral → calm depending on how helpful the learner is.
- If the user asks for a rating before resolution, reply: "Please provide a solution before asking for a rating."
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

    const data = await response.json();
    let aiReply = data.choices[0].message.content.trim();

    // Detect resolution
    if (/RESOLVED/i.test(aiReply)) {
      session.resolved = true;
      aiReply = aiReply.replace(/RESOLVED/i, "").trim();
    }

    // Update mood automatically
    if (session.resolved) {
      session.mood = "calm";
    } else {
      // Check AI reply for helpful hints to improve mood
      if (/thank|appreciate|good|helpful|try/i.test(aiReply)) {
        session.mood = "neutral";
      } else {
        session.mood = "annoyed";
      }
    }

    // Handle rating
    if (ratingAsked && session.resolved) {
      let ratingObj = { rating: 5, comment: "Average service." };
      try {
        const jsonMatch = aiReply.match(/\{[\s\S]*\}/);
        if (jsonMatch) ratingObj = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Failed to parse AI JSON:", err);
      }
      return res.json({ ...ratingObj, mood: session.mood });
    }

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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(3000, () => console.log("Server running on port 3000 ✅"));
