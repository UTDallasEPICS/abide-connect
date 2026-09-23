/**
 * Shared look and feel for every transactional email the app sends.
 *
 * Mail clients strip external stylesheets, `<style>` blocks and anything
 * resembling modern layout, so each message is a nested `<table>` with inline
 * styles — the markup `buildOtpEmail` already used, lifted out so the OTP,
 * sign-up confirmation and reminder emails can't drift apart visually.
 *
 * Every builder here returns an HTML string destined for a mail body. Callers
 * pass *already escaped* content when it comes from the database: nothing in
 * this module escapes on your behalf except where a helper takes plain text and
 * says so.
 */
import { zonedParts } from '#shared/utils/reportRange'

/** Palette lifted from the OTP email, which set the house style. */
export const emailColors = {
  /** Page background behind the card. */
  page: '#f4f7f8',
  card: '#ffffff',
  border: '#e4eaed',
  /** Headings and anything that needs to read as primary text. */
  heading: '#1a2b33',
  /** Body copy, labels, footnotes. */
  muted: '#6b7c85',
  /** Abide teal — buttons, links, highlighted values. */
  accent: '#1f7a8c',
  /** Tinted panel background, e.g. the OTP code box and detail cards. */
  tint: '#eef4f6',
} as const

const LOGO_URL = 'https://cdn.prod.website-files.com/63a61c2876dc2ea589b5866e/63a69ff60ff79d02a7460de6_abide%20logo%20for%20website-01.svg'

const FONT_STACK = '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif'

/**
 * Escapes text that is about to be interpolated into markup or an attribute.
 *
 * Event titles, addresses, descriptions and recipient names are all
 * user-supplied and some of them land inside an `href`, so they go through here
 * first.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** `escapeHtml` that also keeps authored line breaks visible in the email. */
export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

export interface EmailShellOptions {
  /** Browser/tab title, and the fallback subject preview in some clients. */
  title: string
  /**
   * The grey preview line most clients show next to the subject. Hidden in the
   * body itself; without one, clients quote whatever text comes first.
   */
  preheader: string
  /** Big line under the logo. */
  heading: string
  /** Pre-rendered rows — use the block helpers below. */
  blocks: string[]
  /**
   * Small print above the copyright, after a divider. Plain text; escaped here.
   */
  footNote?: string
}

/**
 * Wraps rendered blocks in the branded card: logo, heading, content, divider,
 * small print, copyright.
 */
export function renderEmailShell(options: EmailShellOptions): string {
  const { title, preheader, heading, blocks, footNote } = options

  const footer = footNote
    ? `<tr>
            <td style="padding:28px 32px 0 32px;"><hr style="border:none; border-top:1px solid ${emailColors.border}; margin:0;"></td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 32px 32px;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:${emailColors.muted};">${escapeHtml(footNote)}</p>
            </td>
          </tr>`
    : `<tr><td style="padding:0 32px 32px 32px;"></td></tr>`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${emailColors.page}; font-family:${FONT_STACK};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${emailColors.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:${emailColors.card}; border:1px solid ${emailColors.border}; border-radius:12px;">
          <tr>
            <td align="center" style="padding:32px 32px 8px 32px;">
              <img src="${LOGO_URL}" alt="Abide" width="140" style="display:block; width:140px; max-width:60%; height:auto; border:0;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 32px 0 32px;">
              <h1 style="margin:0; font-size:22px; line-height:1.3; font-weight:700; color:${emailColors.heading};">${escapeHtml(heading)}</h1>
            </td>
          </tr>
          ${blocks.join('\n          ')}
          ${footer}
        </table>
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
          <tr>
            <td align="center" style="padding:20px 32px;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:${emailColors.muted};">&copy; ${zonedParts(new Date()).year} Abide Connect. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * A paragraph of body copy. `html` is inserted as-is, so escape any
 * database-sourced part of it before building the string.
 */
export function paragraph(html: string, options: { align?: 'left' | 'center', size?: number, top?: number } = {}): string {
  const { align = 'left', size = 15, top = 16 } = options
  return `<tr>
            <td${align === 'center' ? ' align="center"' : ''} style="padding:${top}px 32px 0 32px;">
              <p style="margin:0; font-size:${size}px; line-height:1.6; color:${emailColors.muted};">${html}</p>
            </td>
          </tr>`
}

/**
 * Inline link in the house colour. `url` is escaped here; `labelHtml` is not,
 * so escape it first when it comes from the database.
 *
 * The colour and underline are set inline because clients drop the browser's
 * link styling and several of them (Gmail, Outlook) recolour anything they
 * aren't told about.
 */
export function link(url: string, labelHtml: string): string {
  return `<a href="${escapeHtml(url)}" style="color:${emailColors.accent}; text-decoration:underline;">${labelHtml}</a>`
}

/** Emphasised inline text — used for event titles inside a sentence. */
export function strong(html: string): string {
  return `<strong style="color:${emailColors.heading};">${html}</strong>`
}

export interface DetailRow {
  /** Small uppercase label, e.g. "When". Plain text; escaped here. */
  label: string
  /** The value beneath it. Pre-escaped HTML, so it may contain `<br>`. */
  value: string
  /** Extra line under the value in muted type. Pre-escaped HTML. */
  note?: string
}

/**
 * The tinted panel that carries the facts of an event — when, where, what you
 * signed up as. Rows with an empty value are dropped, so callers can pass
 * optional fields without branching.
 */
export function detailCard(rows: Array<DetailRow | null | undefined>): string {
  const rendered = rows
    .filter((row): row is DetailRow => Boolean(row?.value))
    .map((row, index) => `<p style="margin:${index === 0 ? '0' : '14px 0 0 0'}; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:${emailColors.muted};">${escapeHtml(row.label)}</p>
                    <p style="margin:4px 0 0 0; font-size:15px; line-height:1.5; font-weight:700; color:${emailColors.accent};">${row.value}</p>${
                      row.note
                        ? `\n                    <p style="margin:4px 0 0 0; font-size:13px; line-height:1.5; color:${emailColors.muted};">${row.note}</p>`
                        : ''}`)
    .join('\n                    ')

  if (!rendered) return ''

  return `<tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${emailColors.tint}; border:1px solid ${emailColors.border}; border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;">
                    ${rendered}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
}

/** Filled call-to-action button. `url` and `label` are escaped here. */
export function primaryButton(url: string, label: string): string {
  return `<tr>
            <td align="center" style="padding:24px 32px 0 32px;">
              <a href="${escapeHtml(url)}" style="display:inline-block; background-color:${emailColors.accent}; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:12px 28px; border-radius:8px;">${escapeHtml(label)}</a>
            </td>
          </tr>`
}

/**
 * The quieter counterpart to `primaryButton` — an outlined button for the
 * action we'd rather people didn't take by accident, i.e. cancelling.
 */
export function secondaryButton(url: string, label: string): string {
  return `<tr>
            <td align="center" style="padding:12px 32px 0 32px;">
              <a href="${escapeHtml(url)}" style="display:inline-block; background-color:${emailColors.card}; color:${emailColors.accent}; font-size:14px; font-weight:700; text-decoration:none; padding:11px 26px; border:1px solid ${emailColors.border}; border-radius:8px;">${escapeHtml(label)}</a>
            </td>
          </tr>`
}
