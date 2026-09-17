import express from "express";
import { connection } from "../database.js";
import { requireAuth } from "../utils/auth_utils.js";
import { getUserByUsername, getBlockStatus } from "../utils/user_utils.js";
import { getOrCreateConversation, isParticipant } from "../utils/message_utils.js";

const router = express.Router();

//lista delle proprie conversazioni
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

// /messages/conversations/:id - messaggi di una conversazione
router.get("/conversations/:id", requireAuth, async (req, res) => {
    const idConvo = req.params.id;
    const idUtente = req.user.idUtente;

    try {
        const partecipa = await isParticipant(idConvo, idUtente);
        if (!partecipa) {
            return res.status(403).send("Non fai parte di questa conversazione");
        }

        const [messaggi] = await connection.query(
            `SELECT m.idMess, m.Contenuto, m.Emissione, u.Username AS mittente
             FROM Messaggio m
             JOIN Utente u ON u.idUtente = m.FK_Mittente
             WHERE m.FK_Convo = ?
             ORDER BY m.Emissione ASC`,
            [idConvo]
        );
        res.status(200).send(messaggi);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// /messages/:username - manda un messaggio (crea la conversazione se non esiste)
router.post("/:username", requireAuth, async (req, res) => {
    const idMittente = req.user.idUtente;
    const { contenuto } = req.body;

    if (!contenuto) {
        return res.status(400).send("Il contenuto del messaggio è obbligatorio");
    }

    try {
        const target = await getUserByUsername(req.params.username);
        if (!target) return res.status(404).send("Utente non trovato");
        if (target.idUtente === idMittente) {
            return res.status(400).send("Non puoi mandare un messaggio a te stesso");
        }

        const { viewerHaBloccatoTarget, targetHaBloccatoViewer } =
            await getBlockStatus(idMittente, target.idUtente);
        if (viewerHaBloccatoTarget || targetHaBloccatoViewer) {
            return res.status(403).send("Impossibile mandare messaggi: relazione di blocco presente");
        }

        const idConvo = await getOrCreateConversation(idMittente, target.idUtente);

        const [result] = await connection.query(
            `INSERT INTO Messaggio (FK_Mittente, FK_Convo, Contenuto) VALUES (?, ?, ?)`,
            [idMittente, idConvo, contenuto]
        );

        res.status(201).send({ idMess: result.insertId, idConvo });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

export default router;