interface OtpEmail {
  subject: string
  text: string
  html: string
}

export function buildOtpEmail(otp: string): OtpEmail {
  return {
    subject: 'Your Abide Connect code',
    text: `Your Abide Connect code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Abide Connect code</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f7f8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">Your Abide Connect code is ${otp}. It expires in 10 minutes.</div>
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
              <h1 style="margin:0; font-size:22px; line-height:1.3; font-weight:700; color:#1a2b33;">Your sign-in code</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 32px 0 32px;">
              <p style="margin:0; font-size:15px; line-height:1.6; color:#6b7c85;">Use the code below to finish signing in to Abide Connect.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 0 32px;">
              <div style="display:inline-block; background-color:#eef4f6; border:1px solid #e4eaed; border-radius:10px; padding:18px 28px;">
                <span style="font-family:'SFMono-Regular',Consolas,Menlo,monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#1f7a8c;">${otp}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 0 32px;">
              <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7c85;">This code expires in <strong style="color:#1a2b33;">10 minutes</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;"><hr style="border:none; border-top:1px solid #e4eaed; margin:0;"></td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 32px 32px;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7c85;">If you didn't request this code, you can safely ignore this email. Please don't share this code with anyone.</p>
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
