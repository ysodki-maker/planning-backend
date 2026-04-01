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
      INSERT INTO projects (name, ville, status, type, start_date, end_date, heure_debut, heure_fin, localisation, description, created_by) VALUES
        ('Relevé Villa Californie',          'Casablanca', 'Terminé',                'Relevé',       '2025-03-02','2025-03-03','09:00','12:00','Villa Californie, Bd de la Corniche, Casablanca',  'Relevé dimensions salon et chambres.', 1),
        ('Installation Showroom BMW',        'Casablanca', 'En cours',               'Installation', '2025-04-07','2025-04-18','08:00','17:00','Showroom BMW, Route de Nouaceur, Sidi Maarouf',    'Revêtement mural haut de gamme.', 1),
        ('Relevé Appartement Hay Riad',      'Rabat',      'Terminé',                'Relevé',       '2025-03-10',NULL,        '10:00','12:30','Résidence Hay Riad, Bloc B Appt 14, Rabat',        'Relevé pré-installation papier peint.', 1),
        ('Installation Hôtel Sofitel',       'Marrakech',  'En cours',               'Installation', '2025-04-14','2025-04-25','07:00','13:00','Hôtel Sofitel Marrakech, Rue Harroun Errachid',    'Papier peint panoramique lobby et suites.', 1),
        ('Relevé Bureau Technopark',         'Casablanca', 'Demande d''affectation', 'Relevé',       NULL,        NULL,        '14:00','16:00','Technopark Casablanca, Bât C Open Space',          'Relevé open space 400m².', 1)
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
