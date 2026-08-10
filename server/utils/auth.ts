import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { createAuthMiddleware } from 'better-auth/api'
import { buildOtpEmail } from './otp-email'
import nodemailer from 'nodemailer'

/**
 * Central better-auth configuration. Everything under `/api/auth/*` is served
 * by the handler this exports (mounted in `server/api/auth/[...all].ts`).
 *
 * Two things about the identity model are easy to get wrong:
 *
 * 1. The authenticated principal is `User`, not `Volunteer`. `session.user.id`
 *    is a `User.id`; a volunteer record hangs off it and is reached with
 *    `prisma.volunteer.findUnique({ where: { userId: session.user.id } })`.
 *    Some people signing in never have a `Volunteer` row at all.
 * 2. Sign-in and sign-up are separate. `disableSignUp: true` on the OTP plugin
 *    means requesting a code for an unknown address does *not* create an
 *    account — registration goes through the app's own sign-up flow. Google
 *    OAuth, by contrast, does create a user on first sign-in.
 */

// Startup diagnostics for SMTP config, which is the most common thing to be
// missing in a fresh environment. Only the password's *length* is logged, never
// the value — but these still run in production and name the mail account, so
// they're candidates for removal once deploys are settled.
console.log('[nodemailer] EMAIL_HOST:', process.env.EMAIL_HOST)
console.log('[nodemailer] EMAIL_USER:', process.env.EMAIL_USER)
console.log('[nodemailer] EMAIL_PASS length:', process.env.EMAIL_PASS?.length)

/**
 * SMTP transport for outbound mail (currently only OTP codes).
 *
 * NOTE: the port is hardcoded to 587 even though `.env.example` documents an
 * `EMAIL_PORT` var — setting that variable has no effect today. If a provider
 * needs implicit TLS on 465, both `port` and `secure` have to change together.
 */
export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.OAUTH_CLIENT_ID as string,
      clientSecret: process.env.OAUTH_CLIENT_SECRET as string,
      // Request calendar write access so events can be pushed to the shared
      // Abide Google Calendar. `accessType: 'offline'` + `prompt: 'consent'`
      // ensure Google returns a refresh token, which better-auth stores on the
      // Account and uses to mint fresh access tokens via getAccessToken().
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      accessType: 'offline',
      prompt: 'consent',
    },
  },
  hooks: {
    // Normalises `/get-session` so an anonymous request returns a 200 with
    // `{ session: null, user: null }` rather than an empty body. Callers —
    // notably `app/middleware/auth.ts` — can then read `.session` off the
    // response unconditionally instead of branching on the status code.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/get-session') {
        if (!ctx.context.session) {
          return ctx.json({ session: null, user: null })
        }
        return ctx.json(ctx.context.session)
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Fires only when Better Auth creates a brand-new user, i.e. the
        // first time someone signs in through OAuth. OTP sign-ups create
        // their own USER role in the sign-up flow, so this won't double up.
        //
        // NOTE: this grants ADMIN to *every* new Google sign-in, so anyone who
        // can complete the OAuth flow lands with full admin rights. That is
        // only safe while the Google client is locked to an internal workspace.
        // Before opening sign-in up, narrow this to USER and promote admins
        // explicitly (see `server/api/role/add.post.ts`).
        after: async (user) => {
          await prisma.user_Role.createMany({
            data: [
              { userId: user.id, role: 'USER', active: true },
              { userId: user.id, role: 'ADMIN', active: true },
            ],
          })
        },
      },
    },
  },
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  user: {
    modelName: 'User',
    fields: {
      // better-auth's user schema uses `image`; our User column is `imageURL`
      image: 'imageURL',
    },
    deleteUser: {
      enabled: true,
    }
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60, // 10 minutes in seconds
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        try {
          const { subject, text, html } = buildOtpEmail(otp)
          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject,
            text,
            html,
          })
        } catch (err) {
          console.error('[sendVerificationOTP] Failed to send email to', email, err)
          throw err
        }
      },
    }),
  ],
})