🤖 AI Customer Chat Simulation

This project delivers an interactive AI-powered customer service training experience.
It simulates a realistic customer persona that reacts dynamically to the learner’s tone, empathy, and problem-solving skills—ideal for training, assessment, and capability development.

🚀 Features

AI-driven customer persona (“Alex”)

Begins slightly annoyed

Emotion changes dynamically (e.g., [calm], [annoyed], [neutral])

Responds naturally in short, conversational sentences

Two conversation modes

Normal mode — Alex chats with the learner and reacts to their behaviour

Rating mode — Alex provides a structured JSON performance score based on:

Empathy

Resolution speed

Professionalism

Simple and fast web interface (HTML, CSS, JS)

Node.js backend for managing persona logic and emotion state

Easy deployment (GitHub Pages + Render/Railway/Vercel)

📁 Project Structure
├── index.html      # Frontend chat interface
├── server.js       # Backend logic, persona rules, API endpoints
└── package.json    # Project dependencies and scripts

index.html

Provides the user interface for the learner.
Handles:

Chat layout

Sending messages to the server

Displaying AI responses

server.js

Contains the core intelligence of the simulation:

Persona rules

Emotional state transitions

Rating logic returning strict JSON

Communication with the AI model

package.json

Includes project configuration and all required dependencies for running the backend.

🛠️ Installation & Local Setup
1. Clone the repository
git clone https://github.com/yourusername/your-repo.git
cd your-repo

2. Install dependencies
npm install

3. Start the backend server
node server.js

4. Open the frontend

Simply open index.html in your browser
—or—
Use VSCode Live Server for auto-refresh.

🌐 Deployment Guide
Frontend Deployment (index.html)

You can deploy the frontend using:

GitHub Pages (recommended)

Netlify

Vercel (static mode)

Backend Deployment (server.js)

Host the Node.js backend on:

Render

Railway

Vercel serverless functions

AWS / Azure / GCP

After deployment, update the API endpoint inside index.html:

const API_URL = "https://your-live-backend-url.com/chat";

🔧 Environment Variables (Optional)

If your backend uses API keys, store them in a .env file:

OPENAI_API_KEY=your_api_key_here


Load them in server.js with:

require('dotenv').config();

📊 Use Case

This project is perfect for:

Customer service role-play training

Soft-skills assessment

Scenario-based eLearning

Showcasing AI integration skills in a portfolio

Demonstrating learning-design capability using technology
