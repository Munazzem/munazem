import dotenv from 'dotenv'
dotenv.config()


const mongo_url        = process.env.MONGO_URL
const port             = process.env.PORT
const mood             = process.env.MOOD
const salt             = process.env.SALT
const jwtSecret        = process.env.JWT_SECRET
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET
const geminiApiKey     = process.env.GEMINI_API_KEY   // Google AI Studio — free tier (unused)
const groqApiKey       = process.env.GROQ_API_KEY     // console.groq.com — free tier

export const envVars = { mongo_url, port, mood, salt, jwtSecret, jwtRefreshSecret, geminiApiKey, groqApiKey }
