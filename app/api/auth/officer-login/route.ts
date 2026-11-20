import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/sessionCookies'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกบัญชีผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        email: username,
        role: {
          in: ['OFFICER', 'ADMIN'],
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์เจ้าหน้าที่คณะ' },
        { status: 401 }
      )
    }

    let isPasswordValid = false
    try {
      isPasswordValid = await bcrypt.compare(password, user.password)
    } catch (e) {
      isPasswordValid = false
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์เจ้าหน้าที่คณะ' },
        { status: 401 }
      )
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_SUCCESS',
          details: `เจ้าหน้าที่คณะ (${user.name}) เข้าสู่ระบบสำเร็จ`,
          userId: user.Usersid,
        },
      })
    } catch (logErr) {
      console.error('Officer Login AuditLog Error:', logErr)
    }

    const res = NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.Usersid,
        name: user.name,
        email: user.email,
        role: user.role,
        universityId: user.universityId,
      },
    })

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 วัน
    }

    // ล้าง cookie ของบทบาทอื่นที่อาจค้างอยู่ ก่อนตั้งของการล็อกอินครั้งนี้
    clearSessionCookies(res)
    res.cookies.set('officer_id', user.Usersid, cookieOptions)
    res.cookies.set('userId', user.Usersid, cookieOptions)
    res.cookies.set('role', user.role, cookieOptions)
    res.cookies.set('user_role', user.role, cookieOptions)
    res.cookies.set('user_email', user.email, cookieOptions)

    return res
  } catch (error) {
    console.error('Officer login error:', error)
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ' },
      { status: 500 }
    )
  }
}