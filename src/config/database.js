const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            parseInt(process.env.DB_PORT) || 3306,
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'planning',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
});

// Test de la connexion au démarrage
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    logger.info(`✅  MySQL connecté → ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    conn.release();
  } catch (err) {
    logger.error(`❌  Connexion MySQL échouée : ${err.message}`);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };