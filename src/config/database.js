import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool(
    process.env.MYSQL_URL
);

export default pool;