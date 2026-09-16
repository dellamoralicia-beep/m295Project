import express from "express";
import { connection } from "../database.js";
import { requireAuth, optionalAuth } from "../utils/auth_utils.js";
import {
    getAllUtenti,
    getUserByUsername,
    isFollowing,
    getBlockStatus
} from "../utils/user_utils.js";

const router = express.Router();

router.get("/utenti", async (req, res) => {
    const utenti = await getAllUtenti();
    res.status(200).send(utenti);
});

// GET /user/:username - pagina profilo pubblica
router.get("/:username", optionalAuth, async (req, res) => {
    const target = await getUserByUsername(req.params.username);
    if (!target) {
        return res.status(404).send("Utente non trovato");
    }

    const viewer = req.user; // null se non loggato
    const isOwnProfile = viewer && viewer.idUtente === target.idUtente;

    if (!isOwnProfile && viewer) {
        const { viewerHaBloccatoTarget, targetHaBloccatoViewer } =
            await getBlockStatus(viewer.idUtente, target.idUtente);

        if (viewerHaBloccatoTarget) {
            return res.status(200).send({
                stato: "bloccato",
                message: "Utente bloccato",
                puoiSbloccare: true
            });
        }
        if (targetHaBloccatoViewer) {
            return res.status(403).send({
                message: "Questa persona non permette di vedere il proprio profilo"
            });
        }
    }

    if (!isOwnProfile) {
        let visibile = false;

        if (target.Visibilita === "pubblico") {
            visibile = true;
        } else if (target.Visibilita === "privato") {
            visibile = !!viewer;
        } else if (target.Visibilita === "solo seguiti") {
            visibile = viewer ? await isFollowing(viewer.idUtente, target.idUtente) : false;
        }

        if (!visibile) {
            return res.status(403).send({
                message: "Questa persona non permette di vedere il proprio profilo"
            });
        }
    }

    const [posts] = await connection.query(
        `SELECT idPost, Contenuto, DataC FROM Post WHERE FK_Utente = ? ORDER BY DataC DESC`,
        [target.idUtente]
    );

    res.status(200).send({
        Username: target.Username,
        Nazionalita: target.Nazionalita,
        Pfp: target.Pfp,
        posts
    });
});

// POST /user/:username/follow
router.post("/:username/follow", requireAuth, async (req, res) => {
    const target = await getUserByUsername(req.params.username);
    if (!target) return res.status(404).send("Utente non trovato");
    if (target.idUtente === req.user.idUtente) {
        return res.status(400).send("Non puoi seguire te stesso");
    }

    const { viewerHaBloccatoTarget, targetHaBloccatoViewer } =
        await getBlockStatus(req.user.idUtente, target.idUtente);
    if (viewerHaBloccatoTarget || targetHaBloccatoViewer) {
        return res.status(403).send("Impossibile seguire: relazione di blocco presente");
    }

    try {
        await connection.query(
            `INSERT INTO InterazioneUtenti (FK_UAzione, FK_USubisce, Interazione) VALUES (?, ?, 'segue')`,
            [req.user.idUtente, target.idUtente]
        );
        res.status(201).send({ message: "Utente seguito" });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).send("Segui già questo utente");
        }
        res.status(500).send({ message: error.message });
    }
});

// DELETE /user/:username/follow
router.delete("/:username/follow", requireAuth, async (req, res) => {
    const target = await getUserByUsername(req.params.username);
    if (!target) return res.status(404).send("Utente non trovato");

    await connection.query(
        `DELETE FROM InterazioneUtenti WHERE FK_UAzione = ? AND FK_USubisce = ? AND Interazione = 'segue'`,
        [req.user.idUtente, target.idUtente]
    );
    res.status(204).send();
});

// POST /user/:username/block
router.post("/:username/block", requireAuth, async (req, res) => {
    const target = await getUserByUsername(req.params.username);
    if (!target) return res.status(404).send("Utente non trovato");
    if (target.idUtente === req.user.idUtente) {
        return res.status(400).send("Non puoi bloccare te stesso");
    }

    const dbConn = await connection.getConnection();
    try {
        await dbConn.beginTransaction();

        // bloccare qualcuno annulla anche i "segue" reciproci
        await dbConn.query(
            `DELETE FROM InterazioneUtenti WHERE Interazione = 'segue'
             AND ((FK_UAzione = ? AND FK_USubisce = ?) OR (FK_UAzione = ? AND FK_USubisce = ?))`,
            [req.user.idUtente, target.idUtente, target.idUtente, req.user.idUtente]
        );

        await dbConn.query(
            `INSERT INTO InterazioneUtenti (FK_UAzione, FK_USubisce, Interazione) VALUES (?, ?, 'bloccato')`,
            [req.user.idUtente, target.idUtente]
        );

        await dbConn.commit();
        res.status(201).send({ message: "Utente bloccato" });
    } catch (error) {
        await dbConn.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).send("Hai già bloccato questo utente");
        }
        res.status(500).send({ message: error.message });
    } finally {
        dbConn.release();
    }
});

// DELETE /user/:username/block
router.delete("/:username/block", requireAuth, async (req, res) => {
    const target = await getUserByUsername(req.params.username);
    if (!target) return res.status(404).send("Utente non trovato");

    await connection.query(
        `DELETE FROM InterazioneUtenti WHERE FK_UAzione = ? AND FK_USubisce = ? AND Interazione = 'bloccato'`,
        [req.user.idUtente, target.idUtente]
    );
    res.status(204).send();
});

export default router;