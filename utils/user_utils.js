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