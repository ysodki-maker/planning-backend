const { pool } = require('../config/database');

// ── Requête de base – compatible MySQL 5.6+ (sans JSON_ARRAYAGG) ─────────────
const PROJECT_BASE_SELECT = `
  SELECT
    p.id,
    p.name,
    p.ville,
    p.status,
    p.type,
    p.start_date,
    p.end_date,
    p.heure_debut,
    p.heure_fin,
    p.localisation,
    p.description,
    p.created_at,
    p.updated_at,
    p.created_by     AS created_by_id,
    creator.name     AS created_by_name,
    creator.avatar   AS created_by_avatar
  FROM projects p
  LEFT JOIN users creator ON creator.id = p.created_by
`;

// Formate une date MySQL (Date object ou string ISO) → "YYYY-MM-DD" ou null
function fmtDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // string : on garde seulement la partie date
  return String(val).split('T')[0];
}

// Formate une heure MySQL (string "HH:MM:SS" ou object) → "HH:MM" ou null
function fmtTime(val) {
  if (!val) return null;
  return String(val).slice(0, 5);
}

function mapRow(row) {
  if (!row) return null;
  const { created_by_id, created_by_name, created_by_avatar, ...rest } = row;
  return {
    ...rest,
    start_date:  fmtDate(rest.start_date),
    end_date:    fmtDate(rest.end_date),
    heure_debut: fmtTime(rest.heure_debut),
    heure_fin:   fmtTime(rest.heure_fin),
    created_by:     { id: created_by_id, name: created_by_name, avatar: created_by_avatar },
    assigned_users: [],
  };
}

// Enrichit N projets avec leurs utilisateurs en 1 seule requête
async function enrichProjects(projects) {
  if (!projects.length) return projects;
  const ids          = projects.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');

  const [rows] = await pool.query(
    `SELECT pa.project_id, u.id, u.name, u.email, u.avatar, u.color
     FROM project_assignments pa
     JOIN users u ON u.id = pa.user_id
     WHERE pa.project_id IN (${placeholders})
     ORDER BY pa.assigned_at ASC`,
    ids
  );

  const byProject = {};
  for (const row of rows) {
    if (!byProject[row.project_id]) byProject[row.project_id] = [];
    byProject[row.project_id].push({
      id: row.id, name: row.name,
      email: row.email, avatar: row.avatar, color: row.color,
    });
  }
  return projects.map((p) => ({ ...p, assigned_users: byProject[p.id] || [] }));
}

async function enrichOne(project) {
  if (!project) return null;
  const [enriched] = await enrichProjects([project]);
  return enriched;
}

// ─────────────────────────────────────────────────────────────────────────────
const ProjectModel = {

  async findAll({ page = 1, limit = 20, search = '', status = '', type = '' } = {}) {
    const offset     = (page - 1) * limit;
    const like       = `%${search}%`;
    const conditions = ['1=1'];
    const params     = [];

    if (search) {
      conditions.push('(p.name LIKE ? OR p.ville LIKE ? OR p.localisation LIKE ?)');
      params.push(like, like, like);
    }
    if (status) { conditions.push('p.status = ?'); params.push(status); }
    if (type)   { conditions.push('p.type = ?');   params.push(type);   }

    const where = conditions.join(' AND ');
    const [rows] = await pool.query(
      `${PROJECT_BASE_SELECT} WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM projects p WHERE ${where}`, params
    );
    return { rows: await enrichProjects(rows.map(mapRow)), total };
  },

  async findById(id) {
    const [rows] = await pool.query(`${PROJECT_BASE_SELECT} WHERE p.id = ?`, [id]);
    return enrichOne(mapRow(rows[0]));
  },

  async findByVille(ville) {
    const [rows] = await pool.query(`${PROJECT_BASE_SELECT} WHERE p.ville = ?`, [ville]);
    return enrichOne(mapRow(rows[0]));
  },

  async findByDateRange(startDate, endDate) {
    // Inclut aussi les projets sans dates (start_date / end_date NULL)
    const [rows] = await pool.query(
      `${PROJECT_BASE_SELECT}
       WHERE (
         (p.start_date IS NULL AND p.end_date IS NULL)
         OR (p.start_date IS NULL AND p.end_date >= ?)
         OR (p.end_date   IS NULL AND p.start_date <= ?)
         OR (p.start_date <= ? AND p.end_date >= ?)
       )
       ORDER BY COALESCE(p.start_date, '9999-12-31') ASC`,
      [startDate, endDate, endDate, startDate]
    );
    return enrichProjects(rows.map(mapRow));
  },

  async create({ name, ville, status, type, start_date, end_date, heure_debut, heure_fin, localisation, description, created_by }) {
    const [result] = await pool.query(
      `INSERT INTO projects (name, ville, status, type, start_date, end_date, heure_debut, heure_fin, localisation, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, ville, status, type, start_date || null, end_date || null, heure_debut || null, heure_fin || null, localisation || null, description || null, created_by]
    );
    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowed = ['name', 'ville', 'status', 'type', 'start_date', 'end_date', 'heure_debut', 'heure_fin', 'localisation', 'description'];
    const sets = [], values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) { sets.push(`${key} = ?`); values.push(fields[key]); }
    }
    if (!sets.length) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  },

  async getAssignedUsers(projectId) {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar, u.color
       FROM project_assignments pa
       JOIN users u ON u.id = pa.user_id
       WHERE pa.project_id = ?`,
      [projectId]
    );
    return rows;
  },

  async assignUsers(projectId, userIds) {
    if (!userIds.length) return;
    const values = userIds.map((uid) => [projectId, uid]);
    await pool.query('INSERT IGNORE INTO project_assignments (project_id, user_id) VALUES ?', [values]);
  },

  async removeUser(projectId, userId) {
    await pool.query('DELETE FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userId]);
  },

  async syncAssignments(projectId, userIds) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM project_assignments WHERE project_id = ?', [projectId]);
      if (userIds.length) {
        const values = userIds.map((uid) => [projectId, uid]);
        await conn.query('INSERT INTO project_assignments (project_id, user_id) VALUES ?', [values]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = ProjectModel;
