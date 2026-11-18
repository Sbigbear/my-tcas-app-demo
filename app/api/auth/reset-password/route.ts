import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { findValidToken, passwordProblem, sendPasswordChangedEmail } from '@/lib/passwordReset'

const INVALID = 'ลิงก์นี้ใช้ไม่ได้แล้ว (หมดอายุ หรือถูกใช้ไปแล้ว) กรุณาขอลิงก์ใหม่'

// GET ?token=... -> เช็กว่าลิงก์ยังใช้ได้ไหม (ให้หน้าเว็บแสดงชื่อ/อีเมล)
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const row = await findValidToken(token)
  if (!row) return NextResponse.json({ success: false, message: INVALID }, { status: 400 })
  return NextResponse.json({ success: true, email: row.user.email, name: row.user.name, purpose: row.purpose })
}

// POST { token, password } -> ตั้งรหัสผ่านใหม่
export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}))
  if (typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'กรุณากรอกรหัสผ่านใหม่' }, { status: 400 })
  }
  const problem = passwordProblem(password)
  if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 })

  try {
    const row = await findValidToken(typeof token === 'string' ? token : '')
    if (!row) return NextResponse.json({ success: false, message: INVALID }, { status: 400 })

    const hashed = await bcrypt.hash(password, 10)
    await prisma.$transaction([
      prisma.user.update({ where: { Usersid: row.userId }, data: { password: hashed } }),
      // ลิงก์ใช้ได้ครั้งเดียว + ยกเลิกลิงก์อื่นที่ค้างอยู่ของผู้ใช้คนนี้
      prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          action: row.purpose === 'SETUP' ? 'PASSWORD_SET' : 'PASSWORD_RESET',
          details: `${row.purpose === 'SETUP' ? 'ตั้งรหัสผ่านครั้งแรก' : 'รีเซ็ตรหัสผ่าน'}ผ่านลิงก์อีเมล (${row.user.email})`,
          userId: row.userId,
        },
      }),
    ])

    await sendPasswordChangedEmail(row.user)
    return NextResponse.json({ success: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย' })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
