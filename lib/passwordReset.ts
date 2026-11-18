import { createHash, randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { appUrl, emailTemplate, escapeHtml, sendMail } from '@/lib/mail'

type Purpose = 'RESET' | 'SETUP'

const TTL_MINUTES: Record<Purpose, number> = { RESET: 60, SETUP: 60 * 24 }
const ROLE_LABEL: Record<string, string> = { ADMIN: 'ผู้ดูแลระบบ', OFFICER: 'เจ้าหน้าที่ประจำคณะ', TEACHER: 'อาจารย์' }

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// รูปแบบอีเมลพื้นฐาน
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)

// ความปลอดภัยรหัสผ่านขั้นต่ำ
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข'
  return null
}

// สร้าง token ใหม่ (ยกเลิกลิงก์เก่าที่ยังไม่ได้ใช้ของผู้ใช้คนนี้) แล้วคืนลิงก์
async function createLink(userId: string, purpose: Purpose) {
  const token = randomBytes(32).toString('hex')
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })
  await prisma.passwordResetToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60_000),
    },
  })
  return `${appUrl()}/reset-password?token=${token}`
}

// อีเมลลิงก์รีเซ็ตรหัสผ่าน (ผู้ใช้ขอเอง หรือ Admin/เจ้าหน้าที่ส่งให้)
export async function sendResetEmail(user: { Usersid: string; email: string; name: string }, requestedBy?: string) {
  const link = await createLink(user.Usersid, 'RESET')
  return sendMail(
    user.email,
    'ลิงก์ตั้งรหัสผ่านใหม่ — ระบบ TCAS',
    emailTemplate({
      greetingName: user.name,
      paragraphs: [
        requestedBy
          ? `${escapeHtml(requestedBy)} ได้ส่งคำขอรีเซ็ตรหัสผ่านให้บัญชี <b>${escapeHtml(user.email)}</b>`
          : `มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี <b>${escapeHtml(user.email)}</b>`,
        `กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์ใช้ได้ครั้งเดียว และหมดอายุใน ${TTL_MINUTES.RESET} นาที`,
      ],
      button: { label: 'ตั้งรหัสผ่านใหม่', url: link },
      footnote: 'ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
    })
  )
}

// อีเมลต้อนรับบัญชีใหม่ พร้อมลิงก์ให้ตั้งรหัสผ่านของตัวเอง (ไม่ส่งรหัสผ่านทางอีเมล)
export async function sendWelcomeEmail(user: { Usersid: string; email: string; name: string; role: string }, createdBy?: string) {
  const link = await createLink(user.Usersid, 'SETUP')
  return sendMail(
    user.email,
    'บัญชีผู้ใช้ระบบ TCAS ของคุณพร้อมใช้งานแล้ว',
    emailTemplate({
      greetingName: user.name,
      paragraphs: [
        `${createdBy ? `${escapeHtml(createdBy)} ได้` : 'ระบบได้'}สร้างบัญชีให้คุณในบทบาท <b>${ROLE_LABEL[user.role] ?? user.role}</b>`,
        `อีเมลสำหรับเข้าสู่ระบบ: <b>${escapeHtml(user.email)}</b>`,
        `เพื่อความปลอดภัย กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านของคุณเอง (ลิงก์หมดอายุใน 24 ชั่วโมง)`,
      ],
      button: { label: 'ตั้งรหัสผ่าน', url: link },
      footnote: `หน้าเข้าสู่ระบบ: ${appUrl()}/login`,
    })
  )
}

// อีเมลแจ้งเตือนหลังเปลี่ยนรหัสผ่านสำเร็จ
export function sendPasswordChangedEmail(user: { email: string; name: string }) {
  return sendMail(
    user.email,
    'รหัสผ่านของคุณถูกเปลี่ยนแล้ว — ระบบ TCAS',
    emailTemplate({
      greetingName: user.name,
      paragraphs: [
        `รหัสผ่านของบัญชี <b>${escapeHtml(user.email)}</b> ถูกเปลี่ยนเมื่อ ${new Date().toLocaleString('th-TH')}`,
        'ถ้าคุณไม่ได้เป็นคนเปลี่ยน กรุณาติดต่อผู้ดูแลระบบทันที',
      ],
      button: { label: 'เข้าสู่ระบบ', url: `${appUrl()}/login` },
    })
  )
}

// ตรวจ token จากลิงก์: คืนข้อมูลถ้ายังใช้ได้
export async function findValidToken(token: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { Usersid: true, email: true, name: true } } },
  })
  if (!row || row.usedAt || row.expiresAt < new Date()) return null
  return row
}
