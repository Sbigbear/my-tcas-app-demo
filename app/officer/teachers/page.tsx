import prisma from '@/lib/prisma'
import { getLoggedInOfficer } from '@/lib/officerAuth'
import { redirect } from 'next/navigation'
import TeacherClient from './TeacherClient'

// ใช้ helper กลาง (เลือกผู้ใช้ที่ล็อกอินล่าสุด ไม่สับสนกับ cookie ค้างของบทบาทอื่น)
const getOfficerInfo = getLoggedInOfficer

export default async function OfficerTeachersPage() {
  const officer = await getOfficerInfo()

  if (!officer || officer.role !== 'OFFICER') {
    redirect('/login')
  }

  let officerFaculty = officer.university?.faculty || ''

  if (!officerFaculty) {
    const latestUniv = await prisma.university.findFirst({
      where: { faculty: { not: '' } },
      orderBy: { createdAt: 'desc' },
    })

    if (latestUniv) {
      officerFaculty = latestUniv.faculty

      if (!officer.universityId) {
        try {
          await prisma.user.update({
            where: { Usersid: officer.Usersid },
            data: { universityId: latestUniv.Universitiesid },
          })
        } catch (e) {
          console.error('Auto-link officer university error:', e)
        }
      }
    }
  }

  const teachers = officerFaculty
    ? await prisma.user.findMany({
        where: {
          role: 'TEACHER',
          university: {
            faculty: officerFaculty,
          },
        },
        include: {
          university: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const facultyDepartments = officerFaculty
    ? await prisma.university.findMany({
        where: { faculty: officerFaculty },
        select: { department: true },
        distinct: ['department'],
      })
    : []

  const departmentsList = facultyDepartments
    .map((d) => d.department)
    .filter((d) => d && d !== '-' && d !== 'ประจำคณะ')

  const formattedTeachers = teachers.map((t) => ({
    id: t.Usersid,
    name: t.name || 'ไม่ระบุชื่อ',
    email: t.email,
    teacherId: t.teacherId || '-',
    department: t.university?.department || '-',
  }))

  return (
    <TeacherClient
      initialTeachers={formattedTeachers}
      facultyName={officerFaculty}
      existingDepartments={departmentsList}
      officerUserId={officer.Usersid}
    />
  )
}