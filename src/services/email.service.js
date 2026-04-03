const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const PLANNING_EMAIL = process.env.PLANNING_EMAIL || 'mgw@planning.cosinus.ma';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function verifyConnection() {
  try {
    await transporter.verify();
    logger.info('✅  Service email connecté (SMTP)');
  } catch (err) {
    logger.warn(`⚠️   Service email non disponible : ${err.message}`);
  }
}

function baseTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F4F4F8;margin:0;padding:0}
  .w{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09)}
  .h{background:#111;padding:28px 36px}
  .h-logo{font-size:20px;font-weight:800;color:#fff;letter-spacing:-.3px}
  .h-sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:3px;text-transform:uppercase;letter-spacing:1px}
  .b{padding:32px 36px;color:#222;line-height:1.7;font-size:14px}
  .b h2{margin:0 0 20px;font-size:18px;color:#111;font-weight:700}
  table.info{width:100%;border-collapse:collapse;margin:18px 0;border-radius:8px;overflow:hidden;border:1px solid #EEEEF2}
  table.info td{padding:10px 14px;font-size:13px;border-bottom:1px solid #EEEEF2}
  table.info td:first-child{color:#888;font-weight:600;white-space:nowrap;background:#FAFAFA;width:130px}
  table.info tr:last-child td{border-bottom:none}
  .badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700}
  .b-orange{background:#FFF3E0;color:#D4680A}
  .b-blue{background:#EBF2FB;color:#1B5C9E}
  .b-green{background:#EAF5EE;color:#1A7A4A}
  .alert{background:#FFF8EC;border-left:4px solid #D4680A;border-radius:0 8px 8px 0;padding:14px 18px;margin:20px 0;font-size:13px;color:#7A4500}
  .confirm-btn{display:inline-block;padding:13px 32px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px}
  .confirm-wrap{margin:28px 0 8px;text-align:center}
  .confirm-note{font-size:11px;color:#aaa;text-align:center;margin-top:6px}
  .f{background:#F7F7F9;padding:16px 36px;text-align:center;color:#aaa;font-size:11px;border-top:1px solid #EEEEF2}
</style></head><body>
<div class="w">
  <div class="h"><div class="h-logo">Magicwalls</div><div class="h-sub">Gestion de planning</div></div>
  <div class="b"><h2>${title}</h2>${content}</div>
  <div class="f">&copy; ${new Date().getFullYear()} Magicwalls &middot; Tous droits r&eacute;serv&eacute;s</div>
</div></body></html>`;
}

function fmtD(d) {
  if (!d) return '&mdash;';
  try { return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }); }
  catch { return d; }
}
function fmtT(a, b) {
  if (!a && !b) return null;
  if (a && b) return a.slice(0,5) + ' &ndash; ' + b.slice(0,5);
  return (a || b).slice(0,5);
}
function row(label, val) {
  if (!val) return '';
  return `<tr><td>${label}</td><td>${val}</td></tr>`;
}

// ── 1. Bienvenue ──────────────────────────────────────────────────────────────
async function sendWelcomeEmail(user) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: user.email,
      subject: 'Bienvenue sur Magicwalls Planning',
      html: baseTemplate('Bienvenue !', `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Votre compte a &eacute;t&eacute; cr&eacute;&eacute; avec succ&egrave;s.</p>
        <table class="info">${row('Email', user.email)}${row('R&ocirc;le', `<span class="badge b-blue">${user.role}</span>`)}</table>
      `),
    });
    logger.info(`📧  Bienvenue → ${user.email}`);
  } catch (err) { logger.error(`❌  Email bienvenue : ${err.message}`); }
}

// ── 2. Reset mot de passe ─────────────────────────────────────────────────────
async function sendPasswordResetEmail(user, resetUrl) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: user.email,
      subject: 'R&eacute;initialisation de votre mot de passe',
      html: baseTemplate('R&eacute;initialisation du mot de passe', `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Cliquez sur le bouton ci-dessous pour r&eacute;initialiser votre mot de passe :</p>
        <div class="confirm-wrap">
          <a href="${resetUrl}" class="confirm-btn">R&eacute;initialiser mon mot de passe</a>
        </div>
        <p class="confirm-note">Ce lien expire dans 1 heure.</p>
      `),
    });
    logger.info(`📧  Reset mdp → ${user.email}`);
  } catch (err) { logger.error(`❌  Email reset : ${err.message}`); }
}

// ── 3. Affectation utilisateur ────────────────────────────────────────────────
async function sendProjectAssignmentEmail(user, project) {
  try {
    const h = fmtT(project.heure_debut, project.heure_fin);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: user.email,
      subject: `Affectation : ${project.name}`,
      html: baseTemplate(`Vous avez &eacute;t&eacute; affect&eacute;(e) au projet`, `
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <table class="info">
          ${row('Projet',      `<strong>${project.name}</strong>`)}
          ${row('Ville',       project.ville)}
          ${row('Type',        project.type)}
          ${row('Statut',      `<span class="badge b-orange">${project.status}</span>`)}
          ${row('Date d&eacute;but', fmtD(project.start_date))}
          ${row('Date fin',    fmtD(project.end_date))}
          ${h ? row('Horaires', h) : ''}
          ${row('Localisation', project.localisation)}
        </table>
      `),
    });
    logger.info(`📧  Affectation "${project.name}" → ${user.email}`);
  } catch (err) { logger.error(`❌  Email affectation : ${err.message}`); }
}

// ── 4. Changement de statut (membres) ─────────────────────────────────────────
async function sendStatusChangeEmail(users, project, oldStatus) {
  const emails = users.map(u => u.email).join(',');
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: emails,
      subject: `Mise à jour statut : ${project.name}`,
      html: baseTemplate('Statut du projet modifi&eacute;', `
        <p>Le statut du projet <strong>${project.name}</strong> a &eacute;t&eacute; mis &agrave; jour :</p>
        <p style="font-size:15px;margin:16px 0">
          <span style="color:#aaa;text-decoration:line-through">${oldStatus}</span>
          &nbsp;&rarr;&nbsp;
          <strong>${project.status}</strong>
        </p>
        <table class="info">
          ${row('Projet', `<strong>${project.name}</strong>`)}
          ${row('Ville',  project.ville)}
        </table>
      `),
    });
    logger.info(`📧  Statut "${project.name}" → ${emails}`);
  } catch (err) { logger.error(`❌  Email statut : ${err.message}`); }
}

// ── 5. Demande d'affectation → planning (avec bouton confirmation) ────────────
async function sendDemandeAffectationEmail(project, createdBy, confirmUrl) {
  const h = fmtT(project.heure_debut, project.heure_fin);
  const assignedNames = (project.assigned_users || []).map(u => u.name).join(', ') || '&mdash;';
  const confirmBlock = confirmUrl
    ? `<div class="confirm-wrap">
         <a href="${confirmUrl}" class="confirm-btn">&#10003; Confirmer le projet &mdash; passer En cours</a>
       </div>
       <p class="confirm-note">Ce lien est &agrave; usage unique. Il ne n&eacute;cessite pas de connexion.</p>`
    : '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: PLANNING_EMAIL,
      subject: `[Demande d'affectation] ${project.name} — ${project.ville || ''}`,
      html: baseTemplate(`Nouvelle demande d&apos;affectation`, `
        <div class="alert">
          &#9888;&#65039; Un nouveau projet en <strong>Demande d&apos;affectation</strong> n&eacute;cessite une validation.
        </div>
        <table class="info">
          ${row('Projet',      `<strong>${project.name}</strong>`)}
          ${row('Ville',       project.ville)}
          ${row('Type',        project.type)}
          ${row('Statut',      `<span class="badge b-orange">Demande d'affectation</span>`)}
          ${row('Date d&eacute;but', fmtD(project.start_date))}
          ${row('Date fin',    fmtD(project.end_date))}
          ${h ? row('Horaires', h) : ''}
          ${row('Localisation', project.localisation)}
          ${row('&Eacute;quipe', assignedNames)}
          ${row('Cr&eacute;&eacute; par', createdBy ? createdBy.name : '')}
        </table>
        ${project.description ? `<p style="font-size:13px;color:#555;padding:12px 14px;background:#FAFAFA;border-radius:6px;border-left:3px solid #ddd">${project.description}</p>` : ''}
        ${confirmBlock}
      `),
    });
    logger.info(`📧  Demande affectation "${project.name}" → ${PLANNING_EMAIL}`);
  } catch (err) { logger.error(`❌  Email demande affectation : ${err.message}`); }
}

// ── 6. Statut → Demande d'affectation (depuis modification) ──────────────────
async function sendStatutDemandeEmail(project, changedBy, confirmUrl) {
  const h = fmtT(project.heure_debut, project.heure_fin);
  const confirmBlock = confirmUrl
    ? `<div class="confirm-wrap">
         <a href="${confirmUrl}" class="confirm-btn">&#10003; Confirmer le projet &mdash; passer En cours</a>
       </div>
       <p class="confirm-note">Ce lien est &agrave; usage unique.</p>`
    : '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: PLANNING_EMAIL,
      subject: `[Demande d'affectation] Projet mis à jour : ${project.name}`,
      html: baseTemplate(`Projet pass&eacute; en Demande d&apos;affectation`, `
        <div class="alert">
          &#9888;&#65039; Le projet <strong>${project.name}</strong> a &eacute;t&eacute; mis en <strong>Demande d&apos;affectation</strong>.
        </div>
        <table class="info">
          ${row('Projet',      `<strong>${project.name}</strong>`)}
          ${row('Ville',       project.ville)}
          ${row('Type',        project.type)}
          ${row('Date d&eacute;but', fmtD(project.start_date))}
          ${row('Date fin',    fmtD(project.end_date))}
          ${h ? row('Horaires', h) : ''}
          ${row('Localisation', project.localisation)}
          ${row('Modifi&eacute; par', changedBy ? changedBy.name : '')}
        </table>
        ${confirmBlock}
      `),
    });
    logger.info(`📧  Statut demande "${project.name}" → ${PLANNING_EMAIL}`);
  } catch (err) { logger.error(`❌  Email statut demande : ${err.message}`); }
}

// ── 7. Confirmation réussie → notifier l'équipe ───────────────────────────────
async function sendConfirmationSuccessEmail(project, assignedUsers) {
  if (!assignedUsers || !assignedUsers.length) return;
  const emails = assignedUsers.map(u => u.email).join(',');
  const h = fmtT(project.heure_debut, project.heure_fin);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, to: emails,
      subject: `Projet confirmé : ${project.name}`,
      html: baseTemplate('Projet confirm&eacute; &mdash; En cours', `
        <p>Le projet <strong>${project.name}</strong> a &eacute;t&eacute; <strong>confirm&eacute;</strong> et est maintenant
          <span class="badge b-blue">En cours</span>.
        </p>
        <table class="info">
          ${row('Projet',      `<strong>${project.name}</strong>`)}
          ${row('Ville',       project.ville)}
          ${row('Type',        project.type)}
          ${row('Date d&eacute;but', fmtD(project.start_date))}
          ${row('Date fin',    fmtD(project.end_date))}
          ${h ? row('Horaires', h) : ''}
          ${row('Localisation', project.localisation)}
        </table>
        <p>Connectez-vous au planning pour consulter les d&eacute;tails.</p>
      `),
    });
    logger.info(`📧  Confirmation "${project.name}" → équipe (${emails})`);
  } catch (err) { logger.error(`❌  Email confirmation succès : ${err.message}`); }
}

module.exports = {
  verifyConnection,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProjectAssignmentEmail,
  sendStatusChangeEmail,
  sendDemandeAffectationEmail,
  sendStatutDemandeEmail,
  sendConfirmationSuccessEmail,
};
