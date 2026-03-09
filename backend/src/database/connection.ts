import mongoose from "mongoose";
import { envVars } from "../../config/env.service.js";
export const DBConnection  = async ()=> {
    try{
        await mongoose.connect(envVars.mongo_url as string);
        console.log('Connected to MongoDB');
    }
    catch(error){
        console.log(error);
    }
    }
