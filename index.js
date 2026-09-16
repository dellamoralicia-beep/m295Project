import express from "express";
import dotenv from "dotenv";
import settingsRouter from "./routes/settings_routes.js";

dotenv.config();

import {router as userRouter} from "./routes/user_routes.js";
import securityRouter from "./routes/security_routes.js";
import postRouter from "./routes/post_routes.js";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/posts", postRouter);
app.use("/user", userRouter);
app.use("/auth", securityRouter);
app.use("/settings", settingsRouter);

app.get("/", (req, res) => {
    res.send("Meow");
});

app.listen(PORT, () => {
    console.log(`App avviata all'indirizzo http://localhost:${PORT}`);
});