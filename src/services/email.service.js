const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// ── Transporter ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Vérification de la connexion ─────────────────────────────────────────────
async function verifyConnection() {
  try {
    await transporter.verify();
    logger.info('✅  Service email connecté (SMTP)');
  } catch (err) {
    logger.warn(`⚠️   Service email non disponible : ${err.message}`);
  }
}

// ── Template HTML de base ────────────────────────────────────────────────────
function baseTemplate(title, content) {
  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Segoe UI', sans-serif; background: #F4F4FB; margin:0; padding:0; }
      .container { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
      .header { background:linear-gradient(135deg,#6C63FF,#43C6AC); padding:32px 40px; }
      .header h1 { color:#fff; margin:0; font-size:24px; }
      .header p  { color:rgba(255,255,255,.8); margin:6px 0 0; font-size:13px; }
      .body { padding:32px 40px; color:#333; line-height:1.7; }
      .btn { display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#6C63FF,#43C6AC); color:#fff; text-decoration:none; border-radius:10px; font-weight:700; margin:20px 0; }
      .badge { display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; }
      .footer { background:#F7F7FC; padding:16px 40px; text-align:center; color:#aaa; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>PlanFlow</h1>
        <p>Gestion de planning professionnel</p>
      </div>
      <div class="body">
        <h2 style="color:#0F0F2D;margin-top:0">${title}</h2>
        ${content}
      </div>
      <div class="footer">© ${new Date().getFullYear()} PlanFlow · Tous droits réservés</div>
    </div>
  </body>
  </html>`;
}

// ── Emails spécifiques ───────────────────────────────────────────────────────

/**
 * Bienvenue après inscription
 */
async function sendWelcomeEmail(user) {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: '🎉 Bienvenue sur PlanFlow !',
      html: baseTemplate('Bienvenue sur PlanFlow !', `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Votre compte a été créé avec succès. Vous pouvez dès maintenant vous connecter et gérer vos projets.</p>
        <p><strong>Votre rôle :</strong> <span class="badge" style="background:#EDE7F6;color:#6C63FF">${user.role}</span></p>
        <p>Si vous avez des questions, n'hésitez pas à contacter votre administrateur.</p>
      `),
    });
    logger.info(`📧  Email de bienvenue envoyé à ${user.email}`);
  } catch (err) {
    logger.error(`❌  Erreur envoi email bienvenue : ${err.message}`);
  }
}

/**
 * Réinitialisation du mot de passe
 */
async function sendPasswordResetEmail(user, resetUrl) {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: '🔐 Réinitialisation de votre mot de passe PlanFlow',
      html: baseTemplate('Réinitialisation du mot de passe', `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
        <a href="${resetUrl}" class="btn">Réinitialiser mon mot de passe</a>
        <p style="color:#999;font-size:13px">Ce lien expire dans <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      `),
    });
    logger.info(`📧  Email reset mot de passe envoyé à ${user.email}`);
  } catch (err) {
    logger.error(`❌  Erreur envoi email reset : ${err.message}`);
  }
}

/**
 * Notification d'affectation à un projet
 */
async function sendProjectAssignmentEmail(user, project) {
  const statusColors = {
    "Demande d'affectation": { bg: '#FFF3E0', color: '#F7971E' },
    'En cours':              { bg: '#EDE7F6', color: '#6C63FF' },
    'Terminé':               { bg: '#E0F7F4', color: '#11998E' },
  };
  const sc = statusColors[project.status] || { bg: '#EEE', color: '#555' };

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: `📋 Vous avez été affecté au projet : ${project.name}`,
      html: baseTemplate(`Affectation au projet : ${project.name}`, `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Vous avez été affecté(e) à un nouveau projet :</p>
        <table style="width:100%;background:#F7F7FC;border-radius:12px;padding:16px;margin:16px 0;border-spacing:0">
          <tr><td style="padding:6px 12px;color:#888;font-size:13px">Projet</td>     <td style="padding:6px 12px;font-weight:700">${project.name}</td></tr>
          <tr><td style="padding:6px 12px;color:#888;font-size:13px">Référence</td>  <td style="padding:6px 12px;font-family:monospace;color:#6C63FF">${project.reference}</td></tr>
          <tr><td style="padding:6px 12px;color:#888;font-size:13px">Statut</td>     <td style="padding:6px 12px"><span class="badge" style="background:${sc.bg};color:${sc.color}">${project.status}</span></td></tr>
          <tr><td style="padding:6px 12px;color:#888;font-size:13px">Début</td>      <td style="padding:6px 12px">${new Date(project.start_date).toLocaleDateString('fr-FR')}</td></tr>
          <tr><td style="padding:6px 12px;color:#888;font-size:13px">Fin</td>        <td style="padding:6px 12px">${new Date(project.end_date).toLocaleDateString('fr-FR')}</td></tr>
        </table>
        <p>Connectez-vous à PlanFlow pour consulter les détails du projet.</p>
      `),
    });
    logger.info(`📧  Email affectation projet "${project.name}" envoyé à ${user.email}`);
  } catch (err) {
    logger.error(`❌  Erreur envoi email affectation : ${err.message}`);
  }
}

/**
 * Notification de changement de statut d'un projet
 */
async function sendStatusChangeEmail(users, project, oldStatus) {
  const emails = users.map((u) => u.email).join(',');
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      emails,
      subject: `🔄 Statut mis à jour : ${project.name}`,
      html: baseTemplate(`Mise à jour du projet : ${project.name}`, `
        <p>Le statut du projet <strong>${project.name}</strong> a été modifié :</p>
        <p style="font-size:16px">
          <span style="color:#aaa">${oldStatus}</span>
          &nbsp;→&nbsp;
          <strong style="color:#6C63FF">${project.status}</strong>
        </p>
        <p>Connectez-vous à PlanFlow pour voir les détails.</p>
      `),
    });
    logger.info(`📧  Email changement statut projet "${project.name}" envoyé`);
  } catch (err) {
    logger.error(`❌  Erreur envoi email statut : ${err.message}`);
  }
}

module.exports = {
  verifyConnection,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProjectAssignmentEmail,
  sendStatusChangeEmail,
};
