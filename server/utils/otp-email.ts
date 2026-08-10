import { emailColors, escapeHtml, paragraph, renderEmailShell } from './email-theme'

interface OtpEmail {
  subject: string
  text: string
  html: string
}

export function buildOtpEmail(otp: string): OtpEmail {
  // The code itself is the one bespoke block in this email, so it's built here
  // rather than added to the shared kit — nothing else needs a monospace slab.
  const codeBlock = `<tr>
            <td align="center" style="padding:24px 32px 0 32px;">
              <div style="display:inline-block; background-color:${emailColors.tint}; border:1px solid ${emailColors.border}; border-radius:10px; padding:18px 28px;">
                <span style="font-family:'SFMono-Regular',Consolas,Menlo,monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:${emailColors.accent};">${escapeHtml(otp)}</span>
              </div>
            </td>
          </tr>`

  return {
    subject: 'Your Abide Connect code',
    text: `Your Abide Connect code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: renderEmailShell({
      title: 'Your Abide Connect code',
      preheader: `Your Abide Connect code is ${otp}. It expires in 10 minutes.`,
      heading: 'Your sign-in code',
      blocks: [
        paragraph('Use the code below to finish signing in to Abide Connect.', { align: 'center', top: 12 }),
        codeBlock,
        paragraph(`This code expires in <strong style="color:${emailColors.heading};">10 minutes</strong>.`, { align: 'center', size: 13, top: 20 }),
      ],
      footNote: 'If you didn\'t request this code, you can safely ignore this email. Please don\'t share this code with anyone.',
    }),
  }
}
