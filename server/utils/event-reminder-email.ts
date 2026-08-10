interface ReminderEmail {
  subject: string
  text: string
  html: string
}

export interface ReminderEmailInput {
  /** Recipient's display name, if we have one. */
  name: string | null
  eventTitle: string
  /** Already formatted for display, e.g. "Tuesday, March 4 at 9:00 AM". */
  when: string
  location: string | null
  /** Absolute link back to the event page. */
  eventUrl: string
  /** True when they signed up to volunteer rather than to attend. */
  isVolunteer: boolean
  /**
   * Which kind of recipient this is, which only changes the footer — an
   * account holder can turn these off in /settings, a guest can't, so the
   * guest wording explains why they got it and points at cancelling instead.
   */
  audience: 'user' | 'guest'
}

/**
 * Renders the 24-hour event reminder email sent by the `eventReminders` cron
 * job to users who opted in (`User.emailRemindersEnabled`).
 *
 * Markup conventions match `buildOtpEmail` — nested `<table>` layout, inline
 * styles, a hidden preheader `<div>`, and a plain-text twin — for the same
 * reason: mail clients strip external stylesheets and modern layout, and having
 * a text alternative improves spam scoring. Keep the two variants in sync.
 */
export function buildEventReminderEmail(input: ReminderEmailInput): ReminderEmail {
  const { name, eventTitle, when, location, eventUrl, isVolunteer, audience } = input

  const greeting = name ? `Hi ${name},` : 'Hi,'
  const role = isVolunteer ? 'volunteering at' : 'attending'
  const preheader = `${eventTitle} — ${when}`

  const footer = audience === 'guest'
    ? 'You\'re receiving this because you signed up for this event with this email address. It\'s a one-off reminder — you won\'t be added to any mailing list. To cancel your place, open the event page above.'
    : 'You\'re receiving this because email reminders are switched on in your Abide Connect settings. You can turn them off there at any time.'

  const textLines = [
    greeting,
    '',
    `This is a reminder that you're ${role} ${eventTitle} tomorrow.`,
    '',
    `When: ${when}`,
    ...(location ? [`Where: ${location}`] : []),
    '',
    `Details: ${eventUrl}`,
    '',
    'If your plans have changed, please cancel your sign-up so we can plan accordingly.',
    '',
    footer,
  ]

  return {
    subject: `Reminder: ${eventTitle} is tomorrow`,
    text: textLines.join('\n'),
    html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(eventTitle)} is tomorrow</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f7f8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border:1px solid #e4eaed; border-radius:12px;">
          <tr>
            <td align="center" style="padding:32px 32px 8px 32px;">
              <img src="https://cdn.prod.website-files.com/63a61c2876dc2ea589b5866e/63a69ff60ff79d02a7460de6_abide%20logo%20for%20website-01.svg" alt="Abide" width="140" style="display:block; width:140px; max-width:60%; height:auto; border:0;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 32px 0 32px;">
              <h1 style="margin:0; font-size:22px; line-height:1.3; font-weight:700; color:#1a2b33;">See you tomorrow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0; font-size:15px; line-height:1.6; color:#6b7c85;">${escapeHtml(greeting)} this is a reminder that you're ${role} <strong style="color:#1a2b33;">${escapeHtml(eventTitle)}</strong> tomorrow.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4f6; border:1px solid #e4eaed; border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#6b7c85;">When</p>
                    <p style="margin:4px 0 0 0; font-size:15px; line-height:1.5; font-weight:700; color:#1f7a8c;">${escapeHtml(when)}</p>
                    ${location
                      ? `<p style="margin:14px 0 0 0; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#6b7c85;">Where</p>
                    <p style="margin:4px 0 0 0; font-size:15px; line-height:1.5; font-weight:700; color:#1f7a8c;">${escapeHtml(location)}</p>`
                      : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 0 32px;">
              <a href="${escapeHtml(eventUrl)}" style="display:inline-block; background-color:#1f7a8c; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:12px 28px; border-radius:8px;">View event details</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 0 32px;">
              <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7c85;">If your plans have changed, please cancel your sign-up so we can plan accordingly.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;"><hr style="border:none; border-top:1px solid #e4eaed; margin:0;"></td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 32px 32px;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7c85;">${escapeHtml(footer)}</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
          <tr>
            <td align="center" style="padding:20px 32px;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7c85;">&copy; ${new Date().getFullYear()} Abide Connect. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}

/**
 * Event titles, locations and names are user-supplied and land inside the HTML
 * body — and one of them lands in an `href` — so they're escaped rather than
 * interpolated raw.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
