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

// Memory storage for sessions (for demo purposes)
const sessions = {};

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  // Initialize session if it doesn't exist
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      mood: "annoyed", // starting mood
      history: [],
      resolved: false
    };
  }

  const session = sessions[sessionId];

  // Add learner message to history
  session.history.push({ role: "user", content: message });

  // Detect if learner is asking for rating
  const ratingAsked = /rate.*service.*\?/i.test(message);

  let systemPrompt;

  if (ratingAsked) {
    // Rating system prompt
    systemPrompt = `
You are Alex, a customer who could not log in to their online account. 
Based on the conversation history, rate the learner's service on a scale from 1-10.
- Consider empathy, resolution speed, professionalism.
- Provide a short comment explaining the rating.
- Respond in strict JSON format: { "rating": number, "comment": "short feedback" }
- Example: { "rating": 9, "comment": "Very helpful and patient." }
`;
  } else {
    // Normal conversation prompt
    systemPrompt = `
You are Alex, a customer who recently completed a support chat about being unable to log in to your online account.
Scenario: You are unsure why the login is failing and need help.
Rate the learner's performance based on the three communication skills taught in the module:
1. Empathy
2. Asking clarifying questions
3. Resolving the issue efficiently and professionally

Consider:
- Tone and empathy
- Relevance and clarity of questions
- How effectively the issue was resolved
- Professionalism and communication quality

Behaviour guidelines:
- Start mildly frustrated but remain polite.
- If the learner shows empathy, asks clear questions, or provides helpful steps, your mood improves.
- If the learner is vague, dismissive, or robotic, your frustration increases.
- Provide information gradually depending on their questions.
- Keep responses natural and brief (2–3 sentences).
- if the user ask On a scale of 1-10 how would you rate my service today?, before providing you a satisfied solution please say yo need to provde a solution before asking for rating.'
;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...session.history.slice(-6) // last few exchanges for context
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
      // Return rating as JSON
      let ratingObj;
      try {
        ratingObj = JSON.parse(aiReply);
      } catch {
        ratingObj = { rating: 5, comment: "Average service." };
      }
      return res.json(ratingObj);
    }

    // Extract AI mood (e.g., [calm])
    const moodMatch = aiReply.match(/\[(.*?)\]$/);
    const newMood = moodMatch ? moodMatch[1].toLowerCase() : session.mood;

    // Update session
    session.mood = newMood;
    session.history.push({ role: "assistant", content: aiReply });

    // Respond to learner
    res.json({
      reply: aiReply.replace(/\[(.*?)\]$/, "").trim(),
      mood: newMood
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Serve frontend HTML at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000 ✅"));
