import type { NextResponse } from 'next/server'

// cookie ทุกตัวที่ระบบใช้เก็บสถานะล็อกอิน (ทุกบทบาท)
export const SESSION_COOKIES = [
  'userId',
  'admin_id',
  'officer_id',
  'teacher_id',
  'student_id',
  'role',
  'user_role',
  'email',
  'user_email',
  'studentCode',
  'nationalId',
  'token',
  'user_id',
]

// ล้าง cookie ของทุกบทบาท — เรียกก่อนตั้ง cookie ของการล็อกอินใหม่ และตอนออกจากระบบ
// (กันกรณีล็อกอินบทบาทหนึ่งแล้ว cookie ของบทบาทก่อนหน้าค้าง ทำให้ระบบสับสนว่าเป็นใคร)
export function clearSessionCookies(res: NextResponse) {
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 })
  }
}
