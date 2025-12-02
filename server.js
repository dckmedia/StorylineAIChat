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
  const ratingAsked = /(rate|rating|score).*(service|today|chat)/i.test(message);

  // Prevent rating if issue is not resolved
  if (ratingAsked && !session.resolved) {
    return res.json({
      error: "NOT_RESOLVED",
      message: "Please provide a solution before asking for a rating."
    });
  }

  // Prepare system prompt
let systemPrompt;

if (ratingAsked) {
  // Rating prompt: simple and strict
  systemPrompt = `
You are Alex, a customer who received support in a chat. 
Based on the conversation history, rate the learner's service on a scale from 1 to 10.
- Consider empathy, professionalism, and issue resolution.
- Provide a short comment explaining the rating.
- Respond in JSON only: { "rating": number, "comment": "short feedback" }.
- No extra text outside the JSON.
`;
} else {
  // Normal conversation prompt: simpler, easier to follow
  systemPrompt = `
You are Alex, a customer who cannot log in to your online account. 
Act as a mildly frustrated but polite customer.
Respond naturally in 2-3 sentences.
- Give information only when asked.
- React to the learner’s empathy, clarity, and helpfulness.
- Your mood changes based on how helpful they are.
- If the user asks for a rating before the issue is resolved, reply: "I need a solution first before I can give a rating."
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

    // Mark session as resolved if AI indicates the issue was fixed
    if (/should now be able to log in|issue resolved|try logging in now/i.test(aiReply)) {
      session.resolved = true;
    }

    // Handle rating response only if resolved
    if (ratingAsked && session.resolved) {
      let ratingObj = { rating: 5, comment: "Average service." }; // fallback

      try {
        // Extract JSON from AI response
        const jsonMatch = aiReply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          ratingObj = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.warn("Failed to parse AI JSON:", err);
      }

      return res.json(ratingObj);
    }

    // Extract AI mood (optional, e.g., [calm])
    const moodMatch = aiReply.match(/\[(.*?)\]$/);
    const newMood = moodMatch ? moodMatch[1].toLowerCase() : session.mood;

    // Update session
    session.mood = newMood;
    session.history.push({ role: "assistant", content: aiReply });

    // Respond to learner
    res.json({
      reply: aiReply.replace(/\[(.*?)\]$/, "").trim(),
      mood: newMood,
      resolved: session.resolved
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
