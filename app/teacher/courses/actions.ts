'use server'

import prisma from '@/lib/prisma'
import { getLoggedInTeacher } from '@/lib/applicationStatus'
import { notifyCourseChangeRequest } from '@/lib/notifyOfficers'

// อาจารย์เสนอแก้ไขเกณฑ์หลักสูตร -> ส่งอีเมลหาเจ้าหน้าที่คณะ (อาจารย์แก้เกณฑ์เองไม่ได้ เจ้าหน้าที่เป็นคนแก้)
export async function proposeCourseChange(courseId: string, message: string) {
  try {
    const teacher = await getLoggedInTeacher()
    if (!teacher) return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีอาจารย์' }

    const text = String(message ?? '').trim()
    if (text.length < 10) return { success: false, message: 'กรุณาอธิบายสิ่งที่อยากแก้อย่างน้อย 10 ตัวอักษร' }
    if (text.length > 1000) return { success: false, message: 'ข้อความยาวเกินไป (สูงสุด 1,000 ตัวอักษร)' }

    const [course, teacherUniv] = await Promise.all([
      prisma.programCriteria.findUnique({ where: { Program_Criteriaid: courseId }, include: { university: true } }),
      teacher.universityId ? prisma.university.findUnique({ where: { Universitiesid: teacher.universityId } }) : null,
    ])
    if (!course) return { success: false, message: 'ไม่พบหลักสูตรนี้' }
    if (!teacherUniv || teacherUniv.faculty !== course.university.faculty) {
      return { success: false, message: 'เสนอแก้ไขได้เฉพาะหลักสูตรในคณะของคุณ' }
    }

    const r = await notifyCourseChangeRequest(course, { name: teacher.name, email: teacher.email }, text)

    await prisma.auditLog.create({
      data: {
        action: 'COURSE_CHANGE_REQUESTED',
        details: `อาจารย์ ${teacher.name} เสนอแก้ไขเกณฑ์ ${course.programName} (${courseId}): "${text.slice(0, 200)}" — ส่งอีเมลถึงเจ้าหน้าที่ ${r.sent}/${r.total}`,
        userId: teacher.Usersid,
      },
    })

    if (r.total === 0) return { success: false, message: 'คณะนี้ยังไม่มีบัญชีเจ้าหน้าที่ จึงส่งข้อเสนอไม่ได้' }
    if (r.sent === 0) return { success: false, message: `ส่งอีเมลไม่สำเร็จ${'error' in r && r.error ? `: ${r.error}` : ''}` }
    return { success: true, message: `ส่งข้อเสนอถึงเจ้าหน้าที่คณะ${course.university.faculty} แล้ว (${r.sent} คน)` }
  } catch (err: any) {
    console.error('Propose course change error:', err)
    return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการส่งข้อเสนอ' }
  }
}
