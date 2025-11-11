import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// store conversation states (in memory for demo)
const sessions = {};

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  // Create a new session if doesn't exist
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      mood: "angry", // starting mood
      history: []
    };
  }

  const session = sessions[sessionId];

  // Add user message to history
  session.history.push({ role: "user", content: message });

  // Construct system prompt
  const systemPrompt = `
You are an AI acting as a customer named Alex.
Current emotional state: ${session.mood}.
Scenario: You ordered a laptop that arrived 3 days late.

Rules:
- If the learner apologizes sincerely, shows empathy, or takes responsibility → calm down one level.
- If the learner offers a clear solution → calm down one level.
- If the learner ignores your frustration or gives robotic replies → get angrier one level.
- Respond naturally, realistically, without profanity.
- Keep your message short (under 3 sentences).
- At the end of your response, include your new emotion in brackets, e.g. [calm], [angry], [very_angry].
  `;

  const messages = [
    { role: "system", content: systemPrompt },
    ...session.history.slice(-6) // keep last few exchanges
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages
    })
  });

  const data = await response.json();
  const aiReply = data.choices[0].message.content.trim();

  // Extract new mood (e.g. from "[calm]")
  const moodMatch = aiReply.match(/\[(.*?)\]$/);
  const newMood = moodMatch ? moodMatch[1] : session.mood;

  // Update stored mood & add assistant message
  session.mood = newMood;
  session.history.push({ role: "assistant", content: aiReply });

  res.json({
    reply: aiReply.replace(/\[(.*?)\]$/, "").trim(),
    mood: newMood
  });
});

app.get("/", (req, res) => res.send("AI Customer Chat API is running ✅"));

app.listen(3000, () => console.log("Server running on port 3000"));
