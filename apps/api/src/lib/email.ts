import { config } from '../config.js'

interface EmailPayload {
  to: string
  subject: string
  html: string
}

/** Resend integration placeholder — logs in development. */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (config.isDev) {
    console.log('[email]', payload.subject, '→', payload.to)
    console.log(payload.html)
    return
  }
  // Production: integrate Resend API with process.env.RESEND_API_KEY
  console.log('[email:prod-stub]', payload.to, payload.subject)
}

export function passwordResetEmail(name: string, link: string): string {
  return `<p>Hi ${name},</p><p>Reset your Vuekumi password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`
}

export function verifyEmail(name: string, link: string): string {
  return `<p>Hi ${name},</p><p>Verify your Vuekumi email:</p><p><a href="${link}">${link}</a></p>`
}

export function adminPasswordResetEmail(name: string, link: string): string {
  return `<p>Hi ${name},</p><p>A Vuekumi administrator has requested a password reset for your account.</p><p><a href="${link}">${link}</a></p>`
}
