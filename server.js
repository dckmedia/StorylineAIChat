import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// Parse JSON bodies
app.use(express.json());

// Serve static files from the same folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Memory storage for sessions (demo only)
const sessions = {};

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  // Initialise session
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      mood: "frustrated",
      history: [],
      resolved: false
    };
  }

  const session = sessions[sessionId];

  // Add learner message to history
  session.history.push({ role: "user", content: message });

  // Detect if learner is asking for a rating
  const ratingAsked = /rate.*service|how.*did.*i.*do/i.test(message);

  let systemPrompt;

  if (ratingAsked) {
    // ---------- RATING PERSONA ----------
    systemPrompt = `
You are Alex, a customer who recently completed a support chat about being unable to log in to your online account.

Rate the learner's performance based on the three communication skills taught in the module:
1. Empathy
2. Asking clarifying questions
3. Resolving the issue efficiently and professionally

Consider:
- Tone and empathy
- Relevance and clarity of questions
- How effectively the issue was resolved
- Professionalism and communication quality

Respond ONLY in valid JSON:
{ "rating": number, "comment": "short feedback" }
`;
  } else {
    // ---------- NORMAL CONVERSATION PERSONA ----------
    systemPrompt = `
You are Alex, a customer who cannot log in to your online account.
Current emotional state: ${session.mood}.
Scenario: You are unsure why the login is failing and need help.

Behaviour guidelines:
- Start mildly frustrated but remain polite.
- If the learner shows empathy, asks clear questions, or provides helpful steps, your mood improves.
- If the learner is vague, dismissive, or robotic, your frustration increases.
- Provide information gradually depending on their questions.
- Keep responses natural and brief (2–3 sentences).
- End each message with your updated emotion in square brackets, e.g. [calm], [neutral], [frustrated].
`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...session.history.slice(-6) // last few exchanges
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages
      })
    });

    const data = await response.json();
    const aiReply = data.choices[0].message.content.trim();

    // ---------- Handle rating ----------
    if (ratingAsked) {
      let ratingObj;
      try {
        ratingObj = JSON.parse(aiReply);
      } catch {
        ratingObj = { rating: 7, comment: "Decent support, but could be clearer." };
      }
      return res.json(ratingObj);
    }

    // ---------- Extract mood ----------
    const moodMatch = aiReply.match(/\[(.*?)\]$/);
    const newMood = moodMatch ? moodMatch[1].toLowerCase() : session.mood;

    // Update session memory
    session.mood = newMood;
    session.history.push({ role: "assistant", content: aiReply });

    // Send final reply (removing the mood tag)
    res.json({
      reply: aiReply.replace(/\[(.*?)\]$/, "").trim(),
      mood: newMood
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000 ✅"));
