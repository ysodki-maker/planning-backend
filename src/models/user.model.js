const { pool } = require('../config/database');

const UserModel = {
  /**
   * Trouver un utilisateur par ID
   */
  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, avatar, color, is_active, last_login, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Trouver un utilisateur par email (avec mot de passe)
   */
  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Lister tous les utilisateurs
   */
  async findAll({ page = 1, limit = 20, search = '' } = {}) {
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const [rows] = await pool.query(
      `SELECT id, name, email, role, avatar, color, is_active, last_login, created_at
       FROM users
       WHERE (name LIKE ? OR email LIKE ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [like, like, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE name LIKE ? OR email LIKE ?`,
      [like, like]
    );

    return { rows, total };
  },

  /**
   * Créer un utilisateur
   */
  async create({ name, email, password, role = 'user', avatar, color }) {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, avatar, color) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, password, role, avatar || name.slice(0, 2).toUpperCase(), color || '#6C63FF']
    );
    return this.findById(result.insertId);
  },

  /**
   * Mettre à jour un utilisateur
   */
  async update(id, fields) {
    const allowed = ['name', 'email', 'role', 'avatar', 'color', 'is_active', 'last_login'];
    const sets    = [];
    const values  = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (!sets.length) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  /**
   * Changer le mot de passe
   */
  async updatePassword(id, hashedPassword) {
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  },

  /**
   * Token de réinitialisation
   */
  async setResetToken(id, token, expires) {
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, id]
    );
  },

  async findByResetToken(token) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    return rows[0] || null;
  },

  async clearResetToken(id) {
    await pool.query(
      'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [id]
    );
  },

  /**
   * Supprimer un utilisateur
   */
  async delete(id) {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  },
};

module.exports = UserModel;