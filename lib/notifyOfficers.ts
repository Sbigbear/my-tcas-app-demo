import prisma from '@/lib/prisma'
import { appUrl, emailTemplate, escapeHtml, sendMail } from '@/lib/mail'

type CourseInfo = {
  Program_Criteriaid: string
  programName: string
  capacity: number
  university: { faculty: string; department: string }
}

// เจ้าหน้าที่ทุกคนในคณะเดียวกับหลักสูตร
async function facultyOfficers(faculty: string) {
  return prisma.user.findMany({
    where: { role: 'OFFICER', university: { faculty } },
    select: { Usersid: true, name: true, email: true },
  })
}

async function sendToAll(
  officers: { name: string; email: string }[],
  subject: string,
  build: (name: string) => string,
  replyTo?: string
) {
  const results = await Promise.all(officers.map((o) => sendMail(o.email, subject, build(o.name), { replyTo })))
  return { total: officers.length, sent: results.filter((r) => r.sent).length, error: results.find((r) => !r.sent)?.error }
}

export async function notifySelectionComplete(course: CourseInfo, teacherName: string) {
  const officers = await facultyOfficers(course.university.faculty)
  if (officers.length === 0) return { total: 0, sent: 0 }
  return sendToAll(officers, `คัดเลือกครบแล้ว รอยืนยันผล: ${course.programName} (${course.Program_Criteriaid})`, (name) =>
    emailTemplate({
      greetingName: name,
      paragraphs: [
        `อาจารย์ <b>${escapeHtml(teacherName)}</b> คัดเลือกผู้สมัครหลักสูตร <b>${escapeHtml(course.programName)}</b> (${course.Program_Criteriaid}) สาขา${escapeHtml(course.university.department)} <b>ครบ ${course.capacity}/${course.capacity} คนแล้ว</b>`,
        'หลักสูตรนี้ปิดรับสมัครอัตโนมัติ กรุณาตรวจสอบและยืนยันผลการคัดเลือกเพื่อส่งต่อระดับมหาวิทยาลัย',
      ],
      button: { label: 'ไปหน้ายืนยันผล', url: `${appUrl()}/officer/confirmations` },
    })
  )
}

export async function notifyCourseChangeRequest(course: CourseInfo, teacher: { name: string; email: string }, message: string) {
  const officers = await facultyOfficers(course.university.faculty)
  if (officers.length === 0) return { total: 0, sent: 0 }
  const body = escapeHtml(message).replace(/\n/g, '<br>')
  return sendToAll(
    officers,
    `อาจารย์เสนอแก้ไขเกณฑ์: ${course.programName} (${course.Program_Criteriaid})`,
    (name) =>
      emailTemplate({
        greetingName: name,
        paragraphs: [
          `อาจารย์ <b>${escapeHtml(teacher.name)}</b> (${escapeHtml(teacher.email)}) เสนอแก้ไขเกณฑ์หลักสูตร <b>${escapeHtml(course.programName)}</b> (${course.Program_Criteriaid}) สาขา${escapeHtml(course.university.department)}`,
          `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">${body}</div>`,
          'ถ้าเห็นด้วย กดปุ่ม "แก้ไข" ที่การ์ดหลักสูตรในหน้าจัดการหลักสูตร หรือตอบกลับอีเมลนี้เพื่อคุยกับอาจารย์โดยตรง',
        ],
        button: { label: 'ไปหน้าจัดการหลักสูตร', url: `${appUrl()}/officer/courses` },
      }),
    teacher.email
  )
}
