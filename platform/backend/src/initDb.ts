import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { secret } from './secretConfig';

const DB_HOST = secret.db?.host || 'localhost';
const DB_PORT = secret.db?.port || 3306;
const DB_USER = secret.db?.user || 'root';
const DB_PASSWORD = secret.db?.password || '123456';

async function initDb() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  console.log('Connected to MySQL');

  const sqlFile = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  await connection.query(sql);
  console.log('Database initialized successfully');

  await connection.end();
}

initDb().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
