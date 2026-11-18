import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

// อีเมล Admin ตั้งต้น: ใส่อีเมลจริงของคุณใน .env (SEED_ADMIN_EMAIL) เพื่อให้รับอีเมลรีเซ็ตรหัสผ่านได้จริง
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@ku.ac.th').trim().toLowerCase()

const prisma = new PrismaClient()

async function main() {
  console.log(' Start seeding initial database...')

 
  const university = await prisma.university.upsert({
    where: { Universitiesid: 'uni-001' },
    update: {},
    create: {
      Universitiesid: 'uni-001',
      code: 'KMUTT',
      name: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี',
      campus: 'บางมด',
      faculty: 'เทคโนโลยีสารสนเทศ',
      department: 'วิทยาการคอมพิวเตอร์',
    },
  })


  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      Usersid: 'usr-admin-01',
      email: ADMIN_EMAIL,
      password: await bcrypt.hash('password123', 10),
      name: 'ผู้ดูแลระบบสารสนเทศ',
      role: Role.ADMIN,
      universityId: university.Universitiesid,
    },
  })

  const school = await prisma.school.upsert({
    where: { code: 'SCH-001' },
    update: {},
    create: {
      Schoolsid: 'sch-001',
      code: 'SCH-001',
      name: 'โรงเรียนสาธิตทดสอบ',
      province: 'กรุงเทพมหานคร',
    },
  })

  console.log('✅ Seeding completed!')
  console.log(`- Created Admin: ${admin.email}`)
  console.log(`- Created University: ${university.name}`)
  console.log(`- Created School: ${school.name}`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })