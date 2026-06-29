import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { createAuthMiddleware } from 'better-auth/api'
import nodemailer from 'nodemailer'

console.log('[nodemailer] EMAIL_HOST:', process.env.EMAIL_HOST)
console.log('[nodemailer] EMAIL_USER:', process.env.EMAIL_USER)
console.log('[nodemailer] EMAIL_PASS length:', process.env.EMAIL_PASS?.length)

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


export const auth = betterAuth({
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
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  user: {
    modelName: 'Volunteer',
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60 * 1000, // 10 minutes in milliseconds
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: 'OTP for Abide Connect',
          html: `Your OTP is: ${otp}`,
        })
      },
    }),
  ],
})