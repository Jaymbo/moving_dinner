import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import prisma from '../db.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

/**
 * Send an email. Returns true on success, logs error on failure.
 * Supports both plain text and HTML content.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  try {
    const mailOptions: any = {
      from: config.smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.body,
    };
    
    // Add HTML version if provided
    if (options.html) {
      mailOptions.html = options.html;
    }
    
    const info = await getTransporter().sendMail(mailOptions);
    logger.info(`Email sent to ${options.to}`, { messageId: info.messageId });
    return true;
  } catch (err) {
    logger.error(`Failed to send email to ${options.to}`, { error: err });
    return false;
  }
}

/**
 * Notify all group members about a new meeting with their RSVP link.
 */
export async function notifyGroupNewMeeting(
  groupId: number,
  meetingId: number,
  meetingDate: Date,
  deadline: Date
): Promise<void> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const tokens = await prisma.rsvpToken.findMany({
    where: { meetingId },
    include: { user: true },
  });

  const tokenMap = new Map(tokens.map((t) => [t.userId, t.token]));
  const dateStr = meetingDate.toLocaleDateString('de-DE');
  const deadlineStr = deadline.toLocaleDateString('de-DE');

  for (const member of members) {
    if (!member.user.email) continue;
    const token = tokenMap.get(member.userId);
    const rsvpLink = token ? `${config.baseUrl}/rsvp/${token}` : '';

    const body = `Hallo ${member.user.name},

Ein neues Moving Dinner findet am ${dateStr} statt.
Anmeldeschluss: ${deadlineStr}

Bitte melde dich an:${rsvpLink ? '\n' + rsvpLink : ' Bitte melde dich in der App an.'}

Viele Grüße,
Moving Dinner`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      background-color: #4CAF50;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
      font-weight: bold;
    }
    .button:hover { background-color: #45a049; }
    .info-box {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
    }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🍽️ Moving Dinner Einladung</h2>
    
    <p>Hallo <strong>${member.user.name}</strong>,</p>
    
    <div class="info-box">
      <p>Ein neues Moving Dinner findet statt!</p>
      <p><strong>📅 Datum:</strong> ${dateStr}<br>
      <strong>⏰ Anmeldeschluss:</strong> ${deadlineStr}</p>
    </div>
    
    ${rsvpLink ? `
      <p>Bitte melde dich bis zum Anmeldeschluss an:</p>
      <a href="${rsvpLink}" class="button">✅ Jetzt anmelden</a>
      <p style="font-size: 14px; color: #666;">
        Oder kopiere diesen Link in deinen Browser:<br>
        <a href="${rsvpLink}">${rsvpLink}</a>
      </p>
    ` : '<p>Bitte melde dich in der App an.</p>'}
    
    <div class="footer">
      <p>Viele Grüße,<br>Dein Moving Dinner Team</p>
    </div>
  </div>
</body>
</html>`;

    await sendMail({
      to: member.user.email,
      subject: `Moving Dinner - Neues Treffen am ${dateStr}`,
      body,
      html,
    });
  }
}

/**
 * Send deadline reminder to unregistered members.
 */
export async function sendDeadlineReminder(
  meetingId: number,
  meetingDate: Date,
  deadline: Date
): Promise<void> {

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      responses: true,
      rsvpTokens: { where: { used: false } },
    },
  });
  if (!meeting) return;

  const respondedUserIds = new Set(meeting.responses.map((r) => r.userId));
  const tokenMap = new Map(meeting.rsvpTokens.map((t) => [t.userId, t.token]));

  // Get all group members
  const members = await prisma.groupMember.findMany({
    where: { groupId: meeting.groupId },
    include: { user: true },
  });

  const dateStr = meetingDate.toLocaleDateString('de-DE');
  const deadlineStr = deadline.toLocaleDateString('de-DE');

  for (const member of members) {
    if (respondedUserIds.has(member.userId)) continue; // already responded
    if (!member.user.email) continue;

    let rsvpLink = '';
    const existingToken = tokenMap.get(member.userId);
    if (existingToken) {
      rsvpLink = `${config.baseUrl}/rsvp/${existingToken}`;
    } else {
      // Generate new token
      const crypto = await import('crypto');
      const newToken = crypto.randomBytes(32).toString('hex');
      await prisma.rsvpToken.create({
        data: { token: newToken, meetingId, userId: member.userId },
      });
      rsvpLink = `${config.baseUrl}/rsvp/${newToken}`;
    }

    const body = `Hallo ${member.user.name},

Erinnerung: Das Moving Dinner am ${dateStr} hat Anmeldeschluss am ${deadlineStr}.
Du hast dich noch nicht angemeldet.

Bitte melde dich an:
${rsvpLink}

Viele Grüße,
Moving Dinner`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      background-color: #ff9800;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
      font-weight: bold;
    }
    .button:hover { background-color: #f57c00; }
    .warning-box {
      background-color: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 15px 0;
    }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>⏰ Erinnerung: Moving Dinner</h2>
    
    <p>Hallo <strong>${member.user.name}</strong>,</p>
    
    <div class="warning-box">
      <p><strong>Erinnerung:</strong> Du hast dich noch nicht angemeldet!</p>
      <p><strong>📅 Meeting-Datum:</strong> ${dateStr}<br>
      <strong>⏰ Anmeldeschluss:</strong> ${deadlineStr}</p>
    </div>
    
    <p>Bitte melde dich jetzt an:</p>
    <a href="${rsvpLink}" class="button">✅ Jetzt anmelden</a>
    <p style="font-size: 14px; color: #666;">
      Link: <a href="${rsvpLink}">${rsvpLink}</a>
    </p>
    
    <div class="footer">
      <p>Viele Grüße,<br>Dein Moving Dinner Team</p>
    </div>
  </div>
</body>
</html>`;

    await sendMail({
      to: member.user.email,
      subject: `Erinnerung: Moving Dinner am ${dateStr} - Bitte anmelden`,
      body,
      html,
    });
  }
}

/**
 * Send assignment notifications after freeze.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string
): Promise<boolean> {
  const body = `Hallo ${name},

Du hast einen Link zum Zurücksetzen deines Passworts angefordert.
Klicke auf den folgenden Link, um ein neues Passwort zu setzen:

${resetUrl}

Dieser Link ist 1 Stunde gültig.

Falls du kein Passwort-Reset angefordert hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Moving Dinner`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      background-color: #2196F3;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
      font-weight: bold;
    }
    .button:hover { background-color: #1976D2; }
    .info-box {
      background-color: #e3f2fd;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 15px 0;
    }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🔑 Passwort zurücksetzen</h2>
    
    <p>Hallo <strong>${name}</strong>,</p>
    
    <p>Du hast einen Link zum Zurücksetzen deines Passworts angefordert.</p>
    
    <a href="${resetUrl}" class="button">Passwort zurücksetzen</a>
    
    <div class="info-box">
      <p><strong>⏰ Gültigkeit:</strong> Dieser Link ist 1 Stunde gültig.</p>
      <p><strong>ℹ️ Hinweis:</strong> Falls du kein Passwort-Reset angefordert hast, kannst du diese E-Mail einfach ignorieren.</p>
    </div>
    
    <p style="font-size: 14px; color: #666;">
      Link: <a href="${resetUrl}">${resetUrl}</a>
    </p>
    
    <div class="footer">
      <p>Viele Grüße,<br>Dein Moving Dinner Team</p>
    </div>
  </div>
</body>
</html>`;

  return sendMail({
    to: email,
    subject: 'Moving Dinner - Passwort zurücksetzen',
    body,
    html,
  });
}

export async function sendAssignmentEmails(meetingId: number): Promise<void> {

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      responses: { include: { user: true, assignedHostUser: true } },
    },
  });
  if (!meeting) return;

  const dateStr = meeting.date.toLocaleDateString('de-DE');

  // Group by host
  const hostGroups = new Map<
    number,
    { host: (typeof meeting.responses)[0]['user']; guests: (typeof meeting.responses)[0][] }
  >();

  for (const response of meeting.responses) {
    if (response.assignedHost === null) continue;
    if (!hostGroups.has(response.assignedHost)) {
      const hostResponse = meeting.responses.find((r) => r.userId === response.assignedHost);
      hostGroups.set(response.assignedHost, {
        host: hostResponse!.user,
        guests: [],
      });
    }
    if (response.userId !== response.assignedHost) {
      hostGroups.get(response.assignedHost)!.guests.push(response);
    }
  }

  // Send to hosts
  for (const [_hostId, group] of hostGroups) {
    if (!group.host.email) continue;

    let guestList = '';
    let dietaryNotes = '';
    let guestListHtml = '';
    let dietaryNotesHtml = '';
    
    for (const gr of group.guests) {
      guestList += `- ${gr.user.name}\n`;
      guestListHtml += `<li>${gr.user.name}</li>`;
      if (gr.user.diet) {
        dietaryNotes += `- ${gr.user.name}: ${gr.user.diet}\n`;
        dietaryNotesHtml += `<li><strong>${gr.user.name}:</strong> ${gr.user.diet}</li>`;
      }
    }

    const body = `Hallo ${group.host.name},

Du hostest das Moving Dinner am ${dateStr}.

Deine Gäste:
${guestList || 'Keine Gäste zugewiesen'}
${dietaryNotes ? `\nErnährungsbesonderheiten:\n${dietaryNotes}` : ''}
Viele Grüße,
Moving Dinner`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .success-box {
      background-color: #e8f5e9;
      border-left: 4px solid #4CAF50;
      padding: 15px;
      margin: 15px 0;
    }
    ul { margin: 10px 0; }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🏠 Du hostest!</h2>
    
    <div class="success-box">
      <p><strong>Hallo ${group.host.name}</strong>,</p>
      <p>du hostest das Moving Dinner am <strong>${dateStr}</strong>.</p>
    </div>
    
    <h3>Deine Gäste:</h3>
    ${guestListHtml ? `<ul>${guestListHtml}</ul>` : '<p>Keine Gäste zugewiesen</p>'}
    
    ${dietaryNotesHtml ? `
      <h3>Ernährungsbesonderheiten:</h3>
      <ul>${dietaryNotesHtml}</ul>
    ` : ''}
    
    <div class="footer">
      <p>Viel Spaß beim Hosten!<br>Dein Moving Dinner Team</p>
    </div>
  </div>
</body>
</html>`;

    await sendMail({
      to: group.host.email,
      subject: `Moving Dinner am ${dateStr} - Du hostest!`,
      body,
      html,
    });

    // Send to each guest
    for (const gr of group.guests) {
      if (!gr.user.email) continue;

      const guestBody = `Hallo ${gr.user.name},

Das Moving Dinner am ${dateStr} findet statt bei:

${group.host.name}
${group.host.address || 'Adresse folgt'}

Viel Spaß!
Moving Dinner`;

      const guestHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .info-box {
      background-color: #f3e5f5;
      border-left: 4px solid #9C27B0;
      padding: 15px;
      margin: 15px 0;
    }
    .host-card {
      background-color: #fafafa;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      margin: 15px 0;
    }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🎉 Deine Host-Zuweisung</h2>
    
    <p>Hallo <strong>${gr.user.name}</strong>,</p>
    
    <div class="info-box">
      <p>Das Moving Dinner am <strong>${dateStr}</strong> findet statt bei:</p>
    </div>
    
    <div class="host-card">
      <h3 style="margin-top: 0;">${group.host.name}</h3>
      <p style="margin-bottom: 0; color: #666;">
        ${group.host.address || 'Adresse folgt'}
      </p>
    </div>
    
    <p>Wir wünschen dir viel Spaß beim Dinner!</p>
    
    <div class="footer">
      <p>Viele Grüße,<br>Dein Moving Dinner Team</p>
    </div>
  </div>
</body>
</html>`;

      await sendMail({
        to: gr.user.email,
        subject: `Moving Dinner am ${dateStr} - Dein Host`,
        body: guestBody,
        html: guestHtml,
      });
    }
  }
}
