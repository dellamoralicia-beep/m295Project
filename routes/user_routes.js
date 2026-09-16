import express from "express"
import { getAllUtenti, getUserById } from "../utils/user_utils.js"

const router = express.Router()

router.get("/utenti", async (request, response) =>{
    const utenti = await getAllUtenti()
    response.send(utenti)
})



export {router}