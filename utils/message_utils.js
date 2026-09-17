import { connection } from "../database.js";

// garantisce che la coppia (FK_U1, FK_U2) sia sempre nello stesso ordine,
export async function getOrCreateConversation(idA, idB) {
    const [u1, u2] = idA < idB ? [idA, idB] : [idB, idA];

    const [existing] = await connection.query(
        `SELECT idConvo FROM Conversazione WHERE FK_U1 = ? AND FK_U2 = ?`,
        [u1, u2]
    );

    if (existing.length > 0) {
        return existing[0].idConvo;
    }

    const [result] = await connection.query(
        `INSERT INTO Conversazione (FK_U1, FK_U2) VALUES (?, ?)`,
        [u1, u2]
    );
    return result.insertId;
}

export async function isParticipant(idConvo, idUtente) {
    const [rows] = await connection.query(
        `SELECT 1 FROM Conversazione WHERE idConvo = ? AND (FK_U1 = ? OR FK_U2 = ?)`,
        [idConvo, idUtente, idUtente]
    );
    return rows.length > 0;
}