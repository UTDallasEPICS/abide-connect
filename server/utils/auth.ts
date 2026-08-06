import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { createAuthMiddleware } from 'better-auth/api'
import { buildOtpEmail } from './otp-email'
import nodemailer from 'nodemailer'

console.log('[nodemailer] EMAIL_HOST:', process.env.EMAIL_HOST)
console.log('[nodemailer] EMAIL_USER:', process.env.EMAIL_USER)
console.log('[nodemailer] EMAIL_PASS length:', process.env.EMAIL_PASS?.length)

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