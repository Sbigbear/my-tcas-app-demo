import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

// เจ้าหน้าที่ (หรือผู้ดูแลระบบ) ที่ล็อกอินอยู่
// ระบบยังไม่มีปุ่มออกจากระบบที่ล้าง cookie จึงอาจมี cookie เก่าของบทบาทอื่นค้างอยู่
// -> ไล่ตรวจตามลำดับความน่าเชื่อถือ (userId ถูกเขียนทับทุกครั้งที่ล็อกอิน = ผู้ใช้ล่าสุด)
//    แล้วเลือกคนแรกที่เป็น OFFICER/ADMIN จริงในฐานข้อมูล
export async function getLoggedInOfficer() {
  try {
    const cookieStore = await cookies()

    let tokenId: string | undefined
    let tokenEmail: string | undefined
    const token = cookieStore.get('token')?.value
    if (token) {
      try {
        const decoded = jwt.decode(token) as any
        tokenId = decoded?.id || decoded?.userId || decoded?.sub
        tokenEmail = decoded?.email || decoded?.userEmail
      } catch {}
    }

    const candidates: ({ Usersid: string } | { email: string })[] = []
    for (const id of [cookieStore.get('userId')?.value, cookieStore.get('officer_id')?.value, tokenId]) {
      if (id) candidates.push({ Usersid: id })
    }
    for (const email of [tokenEmail, cookieStore.get('email')?.value, cookieStore.get('user_email')?.value]) {
      if (email) candidates.push({ email })
    }

    for (const where of candidates) {
      const user = await prisma.user.findFirst({ where, include: { university: true } })
      if (user && (user.role === 'OFFICER' || user.role === 'ADMIN')) return user
    }
    return null
  } catch {
    return null
  }
}
