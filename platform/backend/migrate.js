const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost', port: 3306,
    user: 'root', password: '',
    database: 'storygame',
    charset: 'utf8mb4',
  });

  const sqls = [
    "ALTER TABLE stories ADD COLUMN IF NOT EXISTS background_zh VARCHAR(200) DEFAULT ''",
    "ALTER TABLE stories ADD COLUMN IF NOT EXISTS background_en VARCHAR(200) DEFAULT ''",
    "ALTER TABLE chapters ADD COLUMN IF NOT EXISTS published TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE chapters ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL DEFAULT NULL",
    `CREATE TABLE IF NOT EXISTS user_progress (
      user_id VARCHAR(36) NOT NULL,
      chapter_id VARCHAR(36) NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, chapter_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )`,
  ];

  for (const sql of sqls) {
    await pool.execute(sql);
    console.log('OK:', sql.slice(0, 70));
  }
  await pool.end();
  console.log('Done');
}
run().catch(e => { console.error(e.message); process.exit(1); });
