import { cookies } from 'next/headers'
import { ApplicationStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { notifySelectionComplete } from '@/lib/notifyOfficers'

// สถานะที่อาจารย์เปลี่ยนได้ (CONFIRMED เป็นของเจ้าหน้าที่คณะ, CANCELLED ไม่ใช่หน้าที่อาจารย์)
const TEACHER_STATUSES: Record<string, ApplicationStatus> = {
  PASSED: ApplicationStatus.PASSED,
  PENDING: ApplicationStatus.PENDING,
  ELIGIBLE: ApplicationStatus.ELIGIBLE,
  INELIGIBLE: ApplicationStatus.INELIGIBLE,
  REJECTED: ApplicationStatus.INELIGIBLE, // หน้าเว็บเก่าอาจส่ง REJECTED มา -> ไม่ผ่านเกณฑ์
}

type Result = { success: true; status: ApplicationStatus } | { success: false; message: string; httpStatus: number }

// อาจารย์ที่ล็อกอินอยู่ (อ่านจาก cookie แล้วยืนยันกับฐานข้อมูลว่าเป็น TEACHER จริง)
export async function getLoggedInTeacher() {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get('teacher_id')?.value
  if (!teacherId) return null
  const user = await prisma.user.findUnique({ where: { Usersid: teacherId } })
  return user?.role === 'TEACHER' ? user : null
}

// อาจารย์เปลี่ยนสถานะผู้สมัคร: ตรวจสิทธิ์ + ตรวจโควตา + ซิงก์สถานะเปิด/ปิดรับสมัคร
// ใช้ร่วมกันทั้ง server action (ปุ่มในหน้าอาจารย์) และ PUT /api/teacher/applications
export async function setApplicationStatusAsTeacher(
  applicationId: string,
  requestedStatus: string,
  remark?: string | null
): Promise<Result> {
  // 1. ต้องเป็นอาจารย์ที่ล็อกอินอยู่
  const teacher = await getLoggedInTeacher()
  if (!teacher) {
    return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีอาจารย์', httpStatus: 401 }
  }

  // 2. สถานะต้องเป็นค่าที่อาจารย์มีสิทธิ์ตั้ง
  const status = TEACHER_STATUSES[requestedStatus]
  if (!status) {
    return { success: false, message: `อาจารย์ไม่สามารถตั้งสถานะ "${requestedStatus}" ได้`, httpStatus: 400 }
  }

  // 3. ใบสมัครต้องอยู่ในหลักสูตรของสังกัดอาจารย์ (ขอบเขตเดียวกับหน้ารายชื่อผู้สมัคร)
  const app = await prisma.application.findUnique({
    where: { Applicationsid: applicationId },
    include: { criteria: { include: { university: true } } },
  })
  if (!app) return { success: false, message: 'ไม่พบใบสมัครนี้', httpStatus: 404 }
  if (!teacher.universityId || app.criteria.universityId !== teacher.universityId) {
    return { success: false, message: 'คุณไม่มีสิทธิ์พิจารณาผู้สมัครของหลักสูตรนี้', httpStatus: 403 }
  }
  if (app.status === ApplicationStatus.CONFIRMED) {
    return { success: false, message: 'ใบสมัครนี้เจ้าหน้าที่คณะยืนยันผลแล้ว แก้ไขไม่ได้', httpStatus: 409 }
  }

  // 4. ห้ามคัดเลือกเกินจำนวนที่รับ
  const countPassed = () =>
    prisma.application.count({
      where: { criteriaId: app.criteriaId, status: { in: [ApplicationStatus.PASSED, ApplicationStatus.CONFIRMED] } },
    })
  if (status === ApplicationStatus.PASSED && app.status !== ApplicationStatus.PASSED) {
    if ((await countPassed()) >= app.criteria.capacity) {
      return {
        success: false,
        message: `คัดเลือกครบ ${app.criteria.capacity} คนแล้ว ถ้าจะเลือกคนนี้ ให้ยกเลิกผลของคนอื่นก่อน`,
        httpStatus: 409,
      }
    }
  }

  // 5. บันทึกสถานะ
  //    (ไม่แตะ isOpen: เปิด/ปิดรับสมัครเป็นการตัดสินใจของเจ้าหน้าที่ ส่วน "เต็ม" คำนวณจากจำนวนที่คัดเลือก
  //     ทุกหน้าที่รับสมัครเช็กทั้งสองอย่างอยู่แล้ว)
  await prisma.application.update({
    where: { Applicationsid: applicationId },
    data: { status, evaluatedAt: new Date(), ...(remark !== undefined ? { remark: remark || null } : {}) },
  })
  const passedNow = await countPassed()

  // 6. เพิ่งคัดเลือกครบจำนวนรับ -> แจ้งเจ้าหน้าที่คณะทางอีเมล
  //    ส่งครั้งเดียวต่อหลักสูตรต่อจำนวนรับ: ถ้าอาจารย์ยกเลิกผลแล้วเลือกใหม่ ไม่ส่งซ้ำ
  //    ส่งอีเมลไม่สำเร็จไม่ทำให้การคัดเลือกล้มเหลว
  const notifyKey = `[${app.criteriaId}] ครบ ${app.criteria.capacity}/${app.criteria.capacity}`
  const alreadyNotified =
    status === ApplicationStatus.PASSED && passedNow === app.criteria.capacity
      ? await prisma.auditLog.findFirst({
          where: { action: 'NOTIFY_SELECTION_COMPLETE', details: { contains: notifyKey } },
          select: { AuditLogsid: true },
        })
      : null
  if (status === ApplicationStatus.PASSED && passedNow === app.criteria.capacity && !alreadyNotified) {
    try {
      const r = await notifySelectionComplete(app.criteria, teacher.name)
      await prisma.auditLog.create({
        data: {
          action: 'NOTIFY_SELECTION_COMPLETE',
          details: `แจ้งเจ้าหน้าที่คณะ${app.criteria.university.faculty}: ${app.criteria.programName} ${notifyKey} — ส่งอีเมล ${r.sent}/${r.total}${'error' in r && r.error ? ` (${r.error})` : ''}`,
          userId: teacher.Usersid,
        },
      })
    } catch (e) {
      console.error('Notify selection complete error:', e)
    }
  }

  await prisma.auditLog.create({
    data: {
      action: 'APPLICATION_STATUS_CHANGED',
      details: `อาจารย์ ${teacher.name} เปลี่ยนสถานะใบสมัคร ${applicationId} (${app.criteria.programName}) จาก ${app.status} เป็น ${status}`,
      userId: teacher.Usersid,
      studentId: app.studentId,
    },
  })

  return { success: true, status }
}
