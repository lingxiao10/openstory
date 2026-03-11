import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

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
