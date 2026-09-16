import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

//oggetto che ci permette di connetterci al db
//create pool permette di creare oggetto che in qualunque momento può connettersi al db, molteplici connessioni
const connection = mysql.createPool({
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
})
export {connection};
