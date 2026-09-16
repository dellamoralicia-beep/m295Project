import express from "express";
import { connection } from "../database.js";
import { requireAuth } from "../utils/auth_utils.js";

const router = express.Router();

// GET /posts?filter=popular|recent  (pubblico, non serve login)
router.get("/", async (req, res) => {
    const filter = req.query.filter || "recent";

    try {
        let query;
        if (filter === "popular") {
            query = `
                SELECT p.idPost, p.Contenuto, p.Immagine, p.DataC, u.Username,
                       COUNT(l.idLike) AS numLike
                FROM Post p
                JOIN Utente u ON p.FK_Utente = u.idUtente
                LEFT JOIN Likes l ON l.FK_Post = p.idPost
                GROUP BY p.idPost
                ORDER BY numLike DESC
                LIMIT 50
            `;
        } else {
            query = `
                SELECT p.idPost, p.Contenuto, p.Immagine, p.DataC, u.Username
                FROM Post p
                JOIN Utente u ON p.FK_Utente = u.idUtente
                ORDER BY p.DataC DESC
                LIMIT 50
            `;
        }

        const [posts] = await connection.query(query);
        res.status(200).send(posts);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /posts/for-me  (richiede login: tag seguiti + utenti seguiti)
router.get("/for-me", requireAuth, async (req, res) => {
    const idUtente = req.user.idUtente;

    try {
        const [posts] = await connection.query(
            `
            SELECT DISTINCT p.idPost, p.Contenuto, p.Immagine, p.DataC, u.Username
            FROM Post p
            JOIN Utente u ON p.FK_Utente = u.idUtente
            LEFT JOIN Post_Tag pt ON pt.FK_Post = p.idPost
            LEFT JOIN SegueTag st ON st.FK_Tag = pt.FK_Tag AND st.FK_Utente = ?
            LEFT JOIN InterazioneUtenti iu
                ON iu.FK_USubisce = p.FK_Utente
                AND iu.FK_UAzione = ?
                AND iu.Interazione = 'segue'
            WHERE st.FK_Utente IS NOT NULL OR iu.FK_UAzione IS NOT NULL
            ORDER BY p.DataC DESC
            `,
            [idUtente, idUtente]
        );
        res.status(200).send(posts);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /posts/:id  (dettaglio singolo post, con tag e conteggio like)
router.get("/:id", async (req, res) => {
    const idPost = req.params.id;

    try {
        const [postRows] = await connection.query(
            `
            SELECT p.idPost, p.Contenuto, p.Immagine, p.DataC, u.Username, p.FK_Utente
            FROM Post p
            JOIN Utente u ON p.FK_Utente = u.idUtente
            WHERE p.idPost = ?
            `,
            [idPost]
        );

        if (postRows.length === 0) {
            return res.status(404).send("Post non trovato");
        }

        const [tags] = await connection.query(
            `SELECT t.idTag, t.NomeT FROM Tag t
             JOIN Post_Tag pt ON pt.FK_Tag = t.idTag
             WHERE pt.FK_Post = ?`,
            [idPost]
        );

        const [[{ numLike }]] = await connection.query(
            `SELECT COUNT(*) AS numLike FROM Likes WHERE FK_Post = ?`,
            [idPost]
        );

        res.status(200).send({ ...postRows[0], tags, numLike });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /posts  (crea post, richiede login)
router.post("/", requireAuth, async (req, res) => {
    const { contenuto, tags } = req.body;
    const idUtente = req.user.idUtente;

    if (!contenuto) {
        return res.status(400).send("Il contenuto del post è obbligatorio");
    }
    if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).send("Serve almeno un tag");
    }

    const dbConn = await connection.getConnection();
    try {
        await dbConn.beginTransaction();

        const [result] = await dbConn.query(
            `INSERT INTO Post (FK_Utente, Contenuto) VALUES (?, ?)`,
            [idUtente, contenuto]
        );
        const idPost = result.insertId;

        for (const nomeTag of tags) {
            let [tagRows] = await dbConn.query(
                `SELECT idTag FROM Tag WHERE NomeT = ?`,
                [nomeTag]
            );

            let idTag;
            if (tagRows.length === 0) {
                const [tagResult] = await dbConn.query(
                    `INSERT INTO Tag (NomeT) VALUES (?)`,
                    [nomeTag]
                );
                idTag = tagResult.insertId;
            } else {
                idTag = tagRows[0].idTag;
            }

            await dbConn.query(
                `INSERT INTO Post_Tag (FK_Post, FK_Tag) VALUES (?, ?)`,
                [idPost, idTag]
            );
        }

        await dbConn.commit();
        res.status(201).send({ idPost });
    } catch (error) {
        await dbConn.rollback();
        res.status(500).send({ message: error.message });
    } finally {
        dbConn.release();
    }
});

// DELETE /posts/:id  (solo chi lo ha creato)
router.delete("/:id", requireAuth, async (req, res) => {
    const idPost = req.params.id;
    const idUtente = req.user.idUtente;

    try {
        const [rows] = await connection.query(
            `SELECT FK_Utente FROM Post WHERE idPost = ?`,
            [idPost]
        );

        if (rows.length === 0) {
            return res.status(404).send("Post non trovato");
        }
        if (rows[0].FK_Utente !== idUtente) {
            return res.status(403).send("Non puoi eliminare un post che non è tuo");
        }

        await connection.query(`DELETE FROM Post WHERE idPost = ?`, [idPost]);
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /posts/:id/like  (richiede login)
router.post("/:id/like", requireAuth, async (req, res) => {
    const idPost = req.params.id;
    const idUtente = req.user.idUtente;

    try {
        await connection.query(
            `INSERT INTO Likes (FK_Utente, FK_Post) VALUES (?, ?)`,
            [idUtente, idPost]
        );
        res.status(201).send("Like aggiunto");
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).send("Hai già messo like a questo post");
        }
        res.status(500).send({ message: error.message });
    }
});

// DELETE /posts/:id/like  (rimuove il proprio like)
router.delete("/:id/like", requireAuth, async (req, res) => {
    const idPost = req.params.id;
    const idUtente = req.user.idUtente;

    try {
        await connection.query(
            `DELETE FROM Likes WHERE FK_Post = ? AND FK_Utente = ?`,
            [idPost, idUtente]
        );
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /posts/:id/comments
router.get("/:id/comments", async (req, res) => {
    const idPost = req.params.id;

    try {
        const [comments] = await connection.query(
            `SELECT c.idCommento, c.Contenuto, c.DataC, u.Username
             FROM Commento c
             JOIN Utente u ON c.FK_Utente = u.idUtente
             WHERE c.FK_Post = ?
             ORDER BY c.DataC ASC`,
            [idPost]
        );
        res.status(200).send(comments);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /posts/:id/comments  (richiede login)
router.post("/:id/comments", requireAuth, async (req, res) => {
    const idPost = req.params.id;
    const idUtente = req.user.idUtente;
    const { contenuto } = req.body;

    if (!contenuto) {
        return res.status(400).send("Il contenuto del commento è obbligatorio");
    }

    try {
        const [result] = await connection.query(
            `INSERT INTO Commento (FK_Utente, FK_Post, Contenuto) VALUES (?, ?, ?)`,
            [idUtente, idPost, contenuto]
        );
        res.status(201).send({ idCommento: result.insertId });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

export default router;