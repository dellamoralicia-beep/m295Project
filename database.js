import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

//oggetto che ci permette di connetterci al db
//create pool permette di creare oggetto che in qualunque momento può connettersi al db, molteplici connessioni
const connection = mysql.createPool({
    user: "root",
    password: "1234",
    host: "localhost",
    database: "progetto",
    waitForConnections: true,
})
export {connection};
