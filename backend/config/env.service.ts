import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// replicate __dirname in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// explicitly load env from this config folder; dotenv defaults to
// process.cwd() so it might miss a config subdir.
dotenv.config({ path: path.resolve(__dirname, ".env") });

const mongo_url = process.env.MONGO_URL;
const port = process.env.PORT;
const mood = process.env.MOOD;
const salt = process.env.SALT;
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
const geminiApiKey = process.env.GEMINI_API_KEY; // Google AI Studio — free tier (unused)
const groqApiKey = process.env.GROQ_API_KEY; // console.groq.com — free tier
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
// Feature flags
const enableAIExams = process.env.ENABLE_AI_EXAMS === "true";

export const envVars = {
  mongo_url,
  port,
  mood,
  salt,
  jwtSecret,
  jwtRefreshSecret,
  geminiApiKey,
  groqApiKey,
  frontendUrl,
  enableAIExams,
};
