const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// ── Adresse de notification planning ─────────────────────────────────────────
const PLANNING_NOTIFICATION_EMAIL = process.env.PLANNING_EMAIL || 'mgw@planning.cosinus.ma';

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
  return `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #F4F4F8; margin:0; padding:0; }
      .container { max-width:580px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.09); }
      .header { background:#111111; padding:28px 36px; }
      .header-logo { font-size:20px; font-weight:800; color:#fff; letter-spacing:-.3px; }
      .header-sub { font-size:12px; color:rgba(255,255,255,.5); margin-top:3px; text-transform:uppercase; letter-spacing:1px; }
      .body { padding:32px 36px; color:#222; line-height:1.7; font-size:14px; }
      .body h2 { margin:0 0 20px; font-size:18px; color:#111; font-weight:700; }
      .info-table { width:100%; border-collapse:collapse; margin:20px 0; border-radius:8px; overflow:hidden; border:1px solid #EEEEF2; }
      .info-table td { padding:10px 14px; font-size:13px; border-bottom:1px solid #EEEEF2; }
      .info-table td:first-child { color:#888; font-weight:600; white-space:nowrap; background:#FAFAFA; width:130px; }
      .info-table tr:last-child td { border-bottom:none; }
      .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; }
      .badge-orange { background:#FFF3E0; color:#D4680A; }
      .badge-blue   { background:#EBF2FB; color:#1B5C9E; }
      .badge-green  { background:#EAF5EE; color:#1A7A4A; }
      .alert-box { background:#FFF8EC; border-left:4px solid #D4680A; border-radius:0 8px 8px 0; padding:14px 18px; margin:20px 0; font-size:13px; color:#7A4500; }
      .footer { background:#F7F7F9; padding:16px 36px; text-align:center; color:#aaa; font-size:11px; border-top:1px solid #EEEEF2; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="header-logo">Magicwalls</div>
        <div class="header-sub">Gestion de planning</div>
      </div>
      <div class="body">
        <h2>${title}</h2>
        ${content}
      </div>
      <div class="footer">© ${new Date().getFullYear()} Magicwalls · Tous droits réservés</div>
    </div>
  </body>
  </html>`;
}

// ── Helper format date ────────────────────────────────────────────────────────
function fmtDateFr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
}

function fmtTimeFr(debut, fin) {
  if (!debut && !fin) return null;
  if (debut && fin) return `${debut.slice(0,5)} – ${fin.slice(0,5)}`;
  return (debut || fin).slice(0,5);
}

// ── 1. Bienvenue ─────────────────────────────────────────────────────────────
async function sendWelcomeEmail(user) {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: 'Bienvenue sur Magicwalls Planning',
      html: baseTemplate('Bienvenue !', `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Votre compte a été créé avec succès. Vous pouvez dès maintenant vous connecter et accéder au planning.</p>
        <table class="info-table">
          <tr><td>Email</td><td>${user.email}</td></tr>
          <tr><td>Rôle</td><td><span class="badge badge-blue">${user.role}</span></td></tr>
        </table>
      `),
    });
    logger.info(`📧  Bienvenue → ${user.email}`);
  } catch (err) {
    logger.error(`❌  Email bienvenue : ${err.message}`);
  }
}

// ── 2. Reset mot de passe ─────────────────────────────────────────────────────
async function sendPasswordResetEmail(user, resetUrl) {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: 'Réinitialisation de votre mot de passe',
      html: baseTemplate('Réinitialisation du mot de passe', `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="display:inline-block;padding:11px 24px;background:#111;color:#fff;text-decoration:none;border-radius:7px;font-weight:600;font-size:13px;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="color:#999;font-size:12px">Ce lien expire dans <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      `),
    });
    logger.info(`📧  Reset mdp → ${user.email}`);
  } catch (err) {
    logger.error(`❌  Email reset : ${err.message}`);
  }
}

// ── 3. Affectation utilisateur à un projet ───────────────────────────────────
async function sendProjectAssignmentEmail(user, project) {
  const horaires = fmtTimeFr(project.heure_debut, project.heure_fin);
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: `Affectation : ${project.name}`,
      html: baseTemplate(`Vous avez été affecté(e) au projet`, `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Vous avez été affecté(e) au projet suivant :</p>
        <table class="info-table">
          <tr><td>Projet</td>     <td><strong>${project.name}</strong></td></tr>
          <tr><td>Ville</td>      <td>${project.ville || '—'}</td></tr>
          <tr><td>Type</td>       <td>${project.type || '—'}</td></tr>
          <tr><td>Statut</td>     <td><span class="badge badge-orange">${project.status}</span></td></tr>
          <tr><td>Date début</td> <td>${fmtDateFr(project.start_date)}</td></tr>
          <tr><td>Date fin</td>   <td>${fmtDateFr(project.end_date)}</td></tr>
          ${horaires ? `<tr><td>Horaires</td><td>${horaires}</td></tr>` : ''}
          ${project.localisation ? `<tr><td>Localisation</td><td>${project.localisation}</td></tr>` : ''}
        </table>
        <p>Connectez-vous au planning pour consulter les détails.</p>
      `),
    });
    logger.info(`📧  Affectation projet "${project.name}" → ${user.email}`);
  } catch (err) {
    logger.error(`❌  Email affectation : ${err.message}`);
  }
}

// ── 4. Changement de statut ───────────────────────────────────────────────────
async function sendStatusChangeEmail(users, project, oldStatus) {
  const emails = users.map(u => u.email).join(',');
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      emails,
      subject: `Mise à jour statut : ${project.name}`,
      html: baseTemplate(`Statut du projet modifié`, `
        <p>Le statut du projet <strong>${project.name}</strong> a été mis à jour :</p>
        <p style="font-size:15px;margin:16px 0">
          <span style="color:#aaa;text-decoration:line-through">${oldStatus}</span>
          &nbsp;→&nbsp;
          <strong style="color:#111">${project.status}</strong>
        </p>
        <table class="info-table">
          <tr><td>Projet</td><td><strong>${project.name}</strong></td></tr>
          <tr><td>Ville</td><td>${project.ville || '—'}</td></tr>
        </table>
      `),
    });
    logger.info(`📧  Changement statut "${project.name}" → ${emails}`);
  } catch (err) {
    logger.error(`❌  Email statut : ${err.message}`);
  }
}

// ── 5. Nouvelle demande d'affectation → email planning ───────────────────────
async function sendDemandeAffectationEmail(project, createdBy) {
  const horaires = fmtTimeFr(project.heure_debut, project.heure_fin);

  // Membres assignés
  const assignedNames = (project.assigned_users || []).map(u => u.name).join(', ') || '—';

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      PLANNING_NOTIFICATION_EMAIL,
      subject: `[Demande d'affectation] ${project.name} — ${project.ville || ''}`,
      html: baseTemplate(`Nouvelle demande d'affectation`, `
        <div class="alert-box">
          ⚠️ Un nouveau projet en <strong>Demande d'affectation</strong> vient d'être créé et nécessite une validation.
        </div>

        <table class="info-table">
          <tr><td>Projet</td>      <td><strong>${project.name}</strong></td></tr>
          <tr><td>Ville</td>       <td>${project.ville || '—'}</td></tr>
          <tr><td>Type</td>        <td>${project.type || '—'}</td></tr>
          <tr><td>Statut</td>      <td><span class="badge badge-orange">Demande d'affectation</span></td></tr>
          <tr><td>Date début</td>  <td>${fmtDateFr(project.start_date)}</td></tr>
          <tr><td>Date fin</td>    <td>${fmtDateFr(project.end_date)}</td></tr>
          ${horaires ? `<tr><td>Horaires</td><td>${horaires}</td></tr>` : ''}
          ${project.localisation ? `<tr><td>Localisation</td><td>${project.localisation}</td></tr>` : ''}
          <tr><td>Équipe</td>      <td>${assignedNames}</td></tr>
          <tr><td>Créé par</td>    <td>${createdBy ? createdBy.name : '—'}</td></tr>
        </table>

        ${project.description ? `<p style="font-size:13px;color:#555;margin-top:16px;padding:12px 14px;background:#FAFAFA;border-radius:6px;border-left:3px solid #ddd">${project.description}</p>` : ''}

        <p style="font-size:12px;color:#999;margin-top:20px">
          Connectez-vous au planning Magicwalls pour traiter cette demande.
        </p>
      `),
    });
    logger.info(`📧  Demande d'affectation "${project.name}" → ${PLANNING_NOTIFICATION_EMAIL}`);
  } catch (err) {
    logger.error(`❌  Email demande affectation : ${err.message}`);
  }
}

// ── 6. Changement de statut vers "Demande d'affectation" ─────────────────────
async function sendStatutDemandeEmail(project, changedBy) {
  const horaires = fmtTimeFr(project.heure_debut, project.heure_fin);
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      PLANNING_NOTIFICATION_EMAIL,
      subject: `[Demande d'affectation] Projet mis à jour : ${project.name}`,
      html: baseTemplate(`Projet passé en Demande d'affectation`, `
        <div class="alert-box">
          ⚠️ Le projet <strong>${project.name}</strong> a été mis en <strong>Demande d'affectation</strong>.
        </div>

        <table class="info-table">
          <tr><td>Projet</td>     <td><strong>${project.name}</strong></td></tr>
          <tr><td>Ville</td>      <td>${project.ville || '—'}</td></tr>
          <tr><td>Type</td>       <td>${project.type || '—'}</td></tr>
          <tr><td>Date début</td> <td>${fmtDateFr(project.start_date)}</td></tr>
          <tr><td>Date fin</td>   <td>${fmtDateFr(project.end_date)}</td></tr>
          ${horaires ? `<tr><td>Horaires</td><td>${horaires}</td></tr>` : ''}
          ${project.localisation ? `<tr><td>Localisation</td><td>${project.localisation}</td></tr>` : ''}
          <tr><td>Modifié par</td><td>${changedBy ? changedBy.name : '—'}</td></tr>
        </table>
      `),
    });
    logger.info(`📧  Statut demande d'affectation "${project.name}" → ${PLANNING_NOTIFICATION_EMAIL}`);
  } catch (err) {
    logger.error(`❌  Email statut demande : ${err.message}`);
  }
}

module.exports = {
  verifyConnection,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProjectAssignmentEmail,
  sendStatusChangeEmail,
  sendDemandeAffectationEmail,
  sendStatutDemandeEmail,
};
