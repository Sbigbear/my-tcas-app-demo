import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isValidEmail, sendResetEmail } from '@/lib/passwordReset'

// POST { email } -> ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล (สำหรับอาจารย์ / เจ้าหน้าที่ / ผู้ดูแลระบบ)
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}))
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : ''

  if (!isValidEmail(clean)) {
    return NextResponse.json({ success: false, message: 'กรุณากรอกอีเมลให้ถูกต้อง' }, { status: 400 })
  }

  // ตอบข้อความเดียวกันเสมอ ไม่ว่าจะมีอีเมลในระบบหรือไม่ (กันคนสุ่มเช็กว่าอีเมลไหนมีบัญชี)
  const okMessage = `ถ้า ${clean} มีบัญชีในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์สแปม)`

  try {
    const user = await prisma.user.findFirst({ where: { email: clean } })
    if (user) {
      const result = await sendResetEmail(user)
      await prisma.auditLog.create({
        data: {
          action: 'PASSWORD_RESET_REQUESTED',
          details: `ขอรีเซ็ตรหัสผ่าน (${user.email}) — ${result.sent ? 'ส่งอีเมลแล้ว' : `ส่งอีเมลไม่สำเร็จ: ${result.error}`}`,
          userId: user.Usersid,
        },
      })
    }
    return NextResponse.json({ success: true, message: okMessage })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
