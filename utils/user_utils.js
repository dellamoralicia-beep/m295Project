import { connection } from "../database.js";

export async function getAllUtenti() {
    const [utenti] = await connection.query(
        "SELECT idUtente, Username, Nome, Cognome, Nazionalita, Visibilita FROM Utente"
    );
    return utenti;
}

export async function getUserById(id) {
    const [rows] = await connection.query(
        "SELECT * FROM Utente WHERE idUtente = ?",
        [id]
    );
    return rows[0];
}

export async function getUserByUsername(username) {
    const [rows] = await connection.query(
        "SELECT * FROM Utente WHERE Username = ?",
        [username]
    );
    return rows[0];
}
export async function updateUserFields(idUtente, fields) {
    const columns = Object.keys(fields);
    if (columns.length === 0) return;

    const setClause = columns.map((col) => `${col} = ?`).join(", ");
    const values = columns.map((col) => fields[col]);

    await connection.query(
        `UPDATE Utente SET ${setClause} WHERE idUtente = ?`,
        [...values, idUtente]
    );
}
//connection è un insieme di connessioni pronte all'uso, quando si fa connection.query... il pool prende connessione qualsiasi disponibile
//per una transazione(begin/commit/rollback) bisogna avere tutte le query sulla stessa connessione
//non c'è on delete cascade
export async function deleteUserAccount(idUtente) {
    const dbConn = await connection.getConnection();
    try {
        await dbConn.beginTransaction();

        // ordine importante: rispettare le foreign key
        await dbConn.query(`DELETE FROM Likes WHERE FK_Utente = ?`, [idUtente]);
        await dbConn.query(`DELETE FROM Commento WHERE FK_Utente = ?`, [idUtente]);
        await dbConn.query(`DELETE FROM Post WHERE FK_Utente = ?`, [idUtente]);
        await dbConn.query(
            `DELETE FROM InterazioneUtenti WHERE FK_UAzione = ? OR FK_USubisce = ?`,
            [idUtente, idUtente]
        );
        await dbConn.query(`DELETE FROM SegueTag WHERE FK_Utente = ?`, [idUtente]);
        await dbConn.query(`DELETE FROM Messaggio WHERE FK_Mittente = ?`, [idUtente]);
        await dbConn.query(
            `DELETE FROM Conversazione WHERE FK_U1 = ? OR FK_U2 = ?`,
            [idUtente, idUtente]
        );
        await dbConn.query(`DELETE FROM Utente WHERE idUtente = ?`, [idUtente]);

        await dbConn.commit();
    } catch (error) {
        await dbConn.rollback();
        throw error;
    } finally {
        dbConn.release();
    }
}

export async function isFollowing(idViewer, idTarget) {
    const [rows] = await connection.query(
        `SELECT 1 FROM InterazioneUtenti WHERE FK_UAzione = ? AND FK_USubisce = ? AND Interazione = 'segue'`,
        [idViewer, idTarget]
    );
    return rows.length > 0;
}

export async function getBlockStatus(idA, idB) {
    // Utente1(idA) ha bloccato Utente2(idB)?
    const [aBloccaB] = await connection.query(
        `SELECT 1 FROM InterazioneUtenti WHERE FK_UAzione = ? AND FK_USubisce = ? AND Interazione = 'bloccato'`,
        [idA, idB]
    );
    // idB ha bloccato idA?
    const [bBloccaA] = await connection.query(
        `SELECT 1 FROM InterazioneUtenti WHERE FK_UAzione = ? AND FK_USubisce = ? AND Interazione = 'bloccato'`,
        [idB, idA]
    );
    return {
        viewerHaBloccatoTarget: aBloccaB.length > 0,
        targetHaBloccatoViewer: bBloccaA.length > 0
    };
}