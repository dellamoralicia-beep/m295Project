import bcrypt from "bcrypt";
import { getUserByUsername } from "./user_utils.js";

//con HTTP Basic Auth ogni richiesta si autentica da sola con username e password
//header authorization fatto/codificato con base64 nn x ragioni di sicurezza ma per caratteri forse in
//password o username non-HTTP-compatible
//requireAuth legge header authorization, lo decodifica e verifica le credenziali con il DB


//middleware per autenticazione
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return res.status(401).set("WWW-Authenticate", "Basic").send("Autenticazione richiesta");
    }

    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [Username, Password] = credentials.split(":");

    if (!Username || !Password) {
        return res.status(401).send("Credenziali mancanti");
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


        req.user = utente;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).send("Errore durante l'autenticazione");
    }
}
//middleware per mostrare cose da anche non loggato
export async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
        req.user = null;
        return next();
    }

    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [Username, Password] = credentials.split(":");

    try {
        const utente = await getUserByUsername(Username);
        if (!utente) {
            req.user = null;
            return next();
        }
        const match = await bcrypt.compare(Password, utente.Pass);
        req.user = match ? utente : null;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
}