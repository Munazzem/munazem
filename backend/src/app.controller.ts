import express from 'express'
import { DBConnection } from './database/connection.js';
import { globalErrorHandler } from './common/utils/response/error.responce.js';
import { envVars } from '../config/env.service.js';
import authRouter from './modules/authentication/auth.controller.js';
import userRouter from './modules/users/users.routes.js';

export const bootstrap = ()=>{
const app = express();
app.use(express.json());

DBConnection() // Connect to MongoDB

app.use('/auth', authRouter) // Authentication routes
app.use('/users', userRouter) // Users routes

app.get('/', (req, res) => {
    res.send('Hello World!');
});

    app.use('{*dummy}', (req, res) => {
    res.status(404).json('Page not found')}) //check if the route is valid or not

app.use(globalErrorHandler) // Global error handling middleware
app.listen(envVars.port, () => {
    console.log(`Server running on http://localhost:${envVars.port}`);
});

}