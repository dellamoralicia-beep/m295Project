import express from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import { connection } from "../database.js";
import { getUserByUsername } from "../utils/user_utils.js";
import { isValidPassword } from "../utils/validation_utils.js";
import {requireAuth} from "../utils/auth_utils.js";

const router = express.Router();
const saltRounds = 10;

// memoria invece che su disco: il file arriva come Buffer, pronto per il blob nel DB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB massimo
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Il file deve essere un'immagine"));
        }
        cb(null, true);
    }
});

function hasValidAge(dataNascita) {
    const oggi = new Date();
    const nascita = new Date(dataNascita);
    let eta = oggi.getFullYear() - nascita.getFullYear();
    const m = oggi.getMonth() - nascita.getMonth();
    if (m < 0 || (m === 0 && oggi.getDate() < nascita.getDate())) {
        eta--;
    }
    return eta >= 16;
}

router.post("/signup", upload.single("Pfp"), async (req, res) => {
    const { Username, Nome, Cognome, Email, Password, DataN, Nazionalita } = req.body;

    if (!Username || !Nome || !Cognome || !Email || !Password || !DataN || !Nazionalita) {
        return res.status(400).send("Tutti i campi sono obbligatori");
    }
    if (!req.file) {
        return res.status(400).send("L'immagine profilo è obbligatoria");
    }
    if (!hasValidAge(DataN)) {
        return res.status(400).send("Devi avere almeno 16 anni per registrarti");
    }
    if (!isValidPassword(Password)) {
        return res.status(400).send(
            "La password deve avere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale"
        );
    }

    try {
        const esistente = await getUserByUsername(Username);
        if (esistente) {
            return res.status(409).send("Username già in uso");
        }

        const hashedPassword = await bcrypt.hash(Password, saltRounds);

        await connection.query(
            `INSERT INTO Utente (Username, Nome, Cognome, Email, DataN, Nazionalita, Pass, Pfp, Visibilita)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [Username, Nome, Cognome, Email, DataN, Nazionalita, hashedPassword, req.file.buffer, "pubblico"]
        );

        res.status(201).send({ Username });
    } catch (err) {
        console.error(err);
        res.status(500).send("Errore durante la registrazione");
    }
});
router.post("/login", async (req, res) => {
    const { Username, Password } = req.body;

    if (!Username || !Password) {
        return res.status(400).send("Username e password sono obbligatori");
    }

    try {
        const utente = await getUserByUsername(Username);
        if (!utente) {
            return res.status(401).send("Credenziali non valide");
        }

        const match = await bcrypt.compare(Password, utente.Pass);
        if (!match) {
            return res.status(401).send("Credenziali non valide");
        }

        res.send({ Username: utente.Username, idUtente: utente.idUtente });
    } catch (err) {
        console.error(err);
        res.status(500).send("Errore durante il login");
    }
});
router.post("/logout", requireAuth, (req, res) => {
    // Con HTTP Basic Auth non c'è uno stato lato server da invalidare:
    // ogni richiesta si autentica da sola tramite l'header Authorization.
    // Il logout "vero" avviene lato client, scartando le credenziali salvate.
    res.status(200).send("Logout effettuato. Elimina le credenziali salvate lato client.");
});

export default router;