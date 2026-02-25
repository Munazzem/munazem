import { ConflictException } from "../../common/utils/response/error.responce.js";
import { UserModel } from "../../database/models/user.model.js";



export const signup = async(data: any)=>{
    const {name, email , password , phone} = data;

    const exsistUser = await UserModel.findOne({email})
    if (exsistUser) {
        throw ConflictException({ message: "User already exists with this email" })
    }
    const userData = await UserModel.create({name,email,password,phone})
    return userData
}