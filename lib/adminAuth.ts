import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

// คืนค่า user ถ้าเป็น ADMIN จริงในฐานข้อมูล ไม่ใช่แค่เชื่อค่า cookie
export async function getAdminUser() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value || cookieStore.get('admin_id')?.value
  if (!userId) return null

  const user = await prisma.user.findUnique({ where: { Usersid: userId } })
  return user?.role === 'ADMIN' ? user : null
}
