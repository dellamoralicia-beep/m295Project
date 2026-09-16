import express from "express";
import bcrypt from "bcrypt";
import { connection } from "../database.js";
import { requireAuth } from "../utils/auth_utils.js";
import { isValidPassword } from "../utils/validation_utils.js";
import { updateUserFields, deleteUserAccount, getUserByUsername } from "../utils/user_utils.js";
import multer from "multer";

const router = express.Router();

// /settings/profile - dati completi del proprio profilo
router.get("/profile", requireAuth, async (req, res) => {
    const { Pass, ...utenteSenzaPassword } = req.user;
    res.status(200).send(utenteSenzaPassword);
});

// /settings/profile - modifica dati profilo (tranne DataN)
router.patch("/profile", requireAuth, async (req, res) => {
    const idUtente = req.user.idUtente;
    const { Username, Nome, Cognome, Email, Nazionalita } = req.body;

    const fields = {};
    if (Username) fields.Username = Username;
    if (Nome) fields.Nome = Nome;
    if (Cognome) fields.Cognome = Cognome;
    if (Email) fields.Email = Email;
    if (Nazionalita) fields.Nazionalita = Nazionalita;

    if (Object.keys(fields).length === 0) {
        return res.status(400).send("Nessun campo valido da aggiornare");
    }

    try {
        if (fields.Username) {
            const esistente = await getUserByUsername(fields.Username);
            if (esistente && esistente.idUtente !== idUtente) {
                return res.status(409).send("Username già in uso");
            }
        }

        await updateUserFields(idUtente, fields);
        res.status(200).send({ message: "Profilo aggiornato" });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// /settings/password - cambio password con controlli
router.patch("/password", requireAuth, async (req, res) => {
    const idUtente = req.user.idUtente;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).send("Vecchia e nuova password sono obbligatorie");
    }

    try {
        const match = await bcrypt.compare(oldPassword, req.user.Pass);
        if (!match) {
            return res.status(401).send("La vecchia password non è corretta");
        }

        const uguale = await bcrypt.compare(newPassword, req.user.Pass);
        if (uguale) {
            return res.status(400).send("La nuova password non può essere uguale alla precedente");
        }

        if (!isValidPassword(newPassword)) {
            return res.status(400).send(
                "La password deve avere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale"
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await updateUserFields(idUtente, { Pass: hashedPassword });
        res.status(200).send({ message: "Password aggiornata" });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// PATCH /settings/visibility - cambia visibilità profilo
router.patch("/visibility", requireAuth, async (req, res) => {
    const idUtente = req.user.idUtente;
    const { visibilita } = req.body;
    const valori = ["pubblico", "privato", "solo seguiti"];

    if (!valori.includes(visibilita)) {
        return res.status(400).send(`Valore non valido, usa uno tra: ${valori.join(", ")}`);
    }

    try {
        await updateUserFields(idUtente, { Visibilita: visibilita });
        res.status(200).send({ message: "Visibilità aggiornata" });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// DELETE /settings/account - elimina il proprio profilo
router.delete("/account", requireAuth, async (req, res) => {
    try {
        await deleteUserAccount(req.user.idUtente);
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /settings/following/users - utenti che seguiamo
router.get("/following/users", requireAuth, async (req, res) => {
    try {
        const [utenti] = await connection.query(
            `SELECT u.idUtente, u.Username, u.Nazionalita
             FROM InterazioneUtenti iu
             JOIN Utente u ON u.idUtente = iu.FK_USubisce
             WHERE iu.FK_UAzione = ? AND iu.Interazione = 'segue'`,
            [req.user.idUtente]
        );
        res.status(200).send(utenti);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// DELETE /settings/following/users/:username - smetti di seguire un utente
router.delete("/following/users/:username", requireAuth, async (req, res) => {
    try {
        const target = await getUserByUsername(req.params.username);
        if (!target) return res.status(404).send("Utente non trovato");

        await connection.query(
            `DELETE FROM InterazioneUtenti WHERE FK_UAzione = ? AND FK_USubisce = ? AND Interazione = 'segue'`,
            [req.user.idUtente, target.idUtente]
        );
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /settings/following/tags - tag che seguiamo
router.get("/following/tags", requireAuth, async (req, res) => {
    try {
        const [tags] = await connection.query(
            `SELECT t.idTag, t.NomeT
             FROM SegueTag st
             JOIN Tag t ON t.idTag = st.FK_Tag
             WHERE st.FK_Utente = ?`,
            [req.user.idUtente]
        );
        res.status(200).send(tags);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /settings/following/tags - segui un tag
router.post("/following/tags", requireAuth, async (req, res) => {
    const { idTag } = req.body;
    try {
        await connection.query(
            `INSERT INTO SegueTag (FK_Utente, FK_Tag) VALUES (?, ?)`,
            [req.user.idUtente, idTag]
        );
        res.status(201).send({ message: "Tag seguito" });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).send("Segui già questo tag");
        }
        res.status(500).send({ message: error.message });
    }
});

// DELETE /settings/following/tags/:idTag - smetti di seguire un tag
router.delete("/following/tags/:idTag", requireAuth, async (req, res) => {
    try {
        await connection.query(
            `DELETE FROM SegueTag WHERE FK_Utente = ? AND FK_Tag = ?`,
            [req.user.idUtente, req.params.idTag]
        );
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /settings/posts - i propri post creati
router.get("/posts", requireAuth, async (req, res) => {
    try {
        const [posts] = await connection.query(
            `SELECT idPost, Contenuto, DataC FROM Post WHERE FK_Utente = ? ORDER BY DataC DESC`,
            [req.user.idUtente]
        );
        res.status(200).send(posts);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /settings/interactions - post con cui abbiamo interagito (like + commenti)
router.get("/interactions", requireAuth, async (req, res) => {
    const idUtente = req.user.idUtente;
    try {
        const [posts] = await connection.query(
            `
            SELECT DISTINCT p.idPost, p.Contenuto, p.DataC, u.Username
            FROM Post p
            JOIN Utente u ON u.idUtente = p.FK_Utente
            WHERE p.idPost IN (SELECT FK_Post FROM Likes WHERE FK_Utente = ? AND FK_Post IS NOT NULL)
               OR p.idPost IN (SELECT FK_Post FROM Commento WHERE FK_Utente = ? AND FK_Post IS NOT NULL)
            ORDER BY p.DataC DESC
            `,
            [idUtente, idUtente]
        );
        res.status(200).send(posts);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /settings/conversations - le proprie conversazioni private
router.get("/conversations", requireAuth, async (req, res) => {
    const idUtente = req.user.idUtente;
    try {
        const [conversazioni] = await connection.query(
            `
            SELECT c.idConvo,
                   CASE WHEN c.FK_U1 = ? THEN u2.Username ELSE u1.Username END AS conInterlocutore
            FROM Conversazione c
            JOIN Utente u1 ON u1.idUtente = c.FK_U1
            JOIN Utente u2 ON u2.idUtente = c.FK_U2
            WHERE c.FK_U1 = ? OR c.FK_U2 = ?
            `,
            [idUtente, idUtente, idUtente]
        );
        res.status(200).send(conversazioni);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Il file deve essere un'immagine"));
        }
        cb(null, true);
    }
});
// cambia la foto profilo
router.patch("/profile-picture", requireAuth, upload.single("Pfp"), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("Nessuna immagine ricevuta");
    }

    try {
        await updateUserFields(req.user.idUtente, { Pfp: req.file.buffer });
        res.status(200).send({ message: "Foto profilo aggiornata" });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

export default router;