import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";


dotenv.config();
const app = express();



// Parse JSON bodies
app.use(express.json());

// Store session data in memory (for demo purposes)
const sessions = {};

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  // Create new session if not exists
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      mood: "annoyed",
      history: [],
      resolved: false
    };
  }

  const session = sessions[sessionId];
  session.history.push({ role: "user", content: message });

  // Check if learner is asking for rating
  const ratingAsked = /rate.*service.*\?/i.test(message);

  let systemPrompt;

  if (ratingAsked) {
    systemPrompt = `
You are Alex, a customer who could not log in to their online account. 
Based on the conversation history, rate the learner's service on a scale from 1-10.
- Consider empathy, resolution speed, professionalism.
- Provide a short comment explaining the rating.
- Respond in strict JSON format: { "rating": number, "comment": "short feedback" }
- Example: { "rating": 9, "comment": "Very helpful and patient." }
`;
  } else {
    systemPrompt = `
You are a customer named Alex who cannot log in to their account.
Current emotional state: ${session.mood}.
Scenario: Customer has login trouble and is slightly annoyed.

Behavior rules:
- Start slightly annoyed but polite.
- Calm down if learner is empathetic, professional, or resolves the issue.
- Get mildly annoyed if learner is dismissive or robotic.
- Keep replies natural, short (2-3 sentences), and conversational.
- End message with new emotion in square brackets, e.g. [calm], [annoyed], [neutral].
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

    if (ratingAsked) {
      let ratingObj;
      try {
        ratingObj = JSON.parse(aiReply);
      } catch {
        ratingObj = { rating: 5, comment: "Average service." };
      }
      return res.json(ratingObj);
    }

    const moodMatch = aiReply.match(/\[(.*?)\]$/);
    const newMood = moodMatch ? moodMatch[1].toLowerCase() : session.mood;

    session.mood = newMood;
    session.history.push({ role: "assistant", content: aiReply });

    res.json({
      reply: aiReply.replace(/\[(.*?)\]$/, "").trim(),
      mood: newMood
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/", (req, res) => res.send("AI Customer Chat API (Login Issue Scenario) ✅"));

app.listen(3000, () => console.log("Server running on port 3000"));
