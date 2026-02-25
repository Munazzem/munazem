import dotenv from 'dotenv'
dotenv.config()


const mongo_url = process.env.MONGO_URL
const port = process.env.PORT
const mood = process.env.MOOD
const salt = process.env.SALT
const jwtSecret = process.env.JWT_SECRET

export const envVars = { mongo_url, port, mood, salt, jwtSecret }

