import express from "express";
import bcrypt from "bcrypt";
import { connection } from "../database.js";
import { getUserByUsername } from "../utils/user_utils.js";

const router = express.Router();
const saltRounds = 10;

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

function isValidPassword(password) {
    // almeno 8 caratteri, 1 maiuscola, 1 minuscola, 1 numero, 1 carattere speciale
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return regex.test(password);
}

router.post("/signup", async (req, res) => {
    const { Username, Nome, Cognome, Email, Password, DataN, Nazionalita } = req.body;

    if (!Username || !Nome || !Cognome || !Email || !Password || !DataN || !Nazionalita) {
        return res.status(400).send("Tutti i campi sono obbligatori");
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
            `INSERT INTO Utente (Username, Nome, Cognome, Email, DataN, Nazionalita, Pass, Visibilita)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [Username, Nome, Cognome, Email, DataN, Nazionalita, hashedPassword, "pubblico"]
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

export default router;