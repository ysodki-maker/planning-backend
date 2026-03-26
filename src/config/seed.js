require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./database');
const logger = require('../utils/logger');

async function seed() {
  const conn = await pool.getConnection();
  try {
    logger.info('🌱  Seeding de la base de données…');

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE project_assignments');
    await conn.query('TRUNCATE TABLE refresh_tokens');
    await conn.query('TRUNCATE TABLE projects');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const hash = (pwd) => bcrypt.hashSync(pwd, 12);
    await conn.query(`
      INSERT INTO users (name, email, password, role, avatar, color) VALUES
        ('Karim Bennani',  'karim@planflow.com',  '${hash("Admin@1234")}', 'admin', 'KB', '#6C63FF'),
        ('Sara Alaoui',    'sara@planflow.com',   '${hash("User@1234")}',  'user',  'SA', '#FF6584'),
        ('Youssef Tahir',  'youssef@planflow.com','${hash("User@1234")}',  'user',  'YT', '#43C6AC'),
        ('Nadia Chraibi',  'nadia@planflow.com',  '${hash("User@1234")}',  'user',  'NC', '#F7971E'),
        ('Omar Fassi',     'omar@planflow.com',   '${hash("User@1234")}',  'user',  'OF', '#11998E')
    `);

    await conn.query(`
      INSERT INTO projects (name, ville, status, type, start_date, end_date, heure_debut, heure_fin, description, created_by) VALUES
        ('Rénovation Siège Social',        'Casablanca', 'En cours',               'Relevé',       '2025-03-01','2025-06-30','08:00','12:00','Travaux de rénovation complète du siège.', 1),
        ('Aménagement Espace Coworking',   'Rabat',      'Demande d''affectation', 'Installation', '2025-04-15','2025-07-20','13:00','17:00','Création d''un espace de coworking moderne.', 1),
        ('Construction Entrepôt',          'Tanger',     'Terminé',                'Relevé',       '2024-11-01','2025-02-28','09:00','15:00','Entrepôt logistique 5000m².', 1),
        ('Installation Panneaux Solaires', 'Marrakech',  'En cours',               'Installation', '2025-05-01','2025-08-15','07:30','11:30','Installation photovoltaïque – 200kWc.', 1)
    `);

    await conn.query(`
      INSERT INTO project_assignments (project_id, user_id) VALUES
        (1,1),(1,3),
        (2,2),(2,4),(2,5),
        (3,1),(3,2),
        (4,3),(4,5)
    `);

    logger.info('✅  Seed terminé avec succès !');
    logger.info('─────────────────────────────────────────');
    logger.info('👤  Admin  → karim@planflow.com  / Admin@1234');
    logger.info('👤  User   → sara@planflow.com   / User@1234');
  } catch (err) {
    logger.error(`❌  Erreur seed : ${err.message}`);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();