import express from "express";
import dotenv from "dotenv";
import settingsRouter from "./routes/settings_routes.js";
import messagesRouter from "./routes/messages_routes.js";

dotenv.config();

import userRouter from "./routes/user_routes.js";
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
app.use("/messages", messagesRouter);

app.get("/", (req, res) => {
    res.send("Homepage");
});

app.listen(PORT, () => {
    console.log(`App avviata all'indirizzo http://localhost:${PORT}`);
});