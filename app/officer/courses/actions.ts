'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getLoggedInOfficer } from '@/lib/officerAuth'
import { CRITERIA, CRITERIA_KEYS, criteriaProblem, criterionLabel } from '@/lib/courseCriteria'

export type CoursePayload = {
  departmentName: string
  Program_Criteriaid: string
  programName: string
  capacity: number
  isOpen: boolean
  additionals: string | null
  foreignLanguageSubject: string | null
} & Record<string, unknown>

function refresh() {
  revalidatePath('/officer/courses')
  revalidatePath('/teacher/courses')
  revalidatePath('/student/search')
  revalidatePath('/student/sample-apply')
  revalidatePath('/admin/courses')
  revalidatePath('/admin/logs')
}

function basicProblem(p: CoursePayload): string | null {
  if (!String(p.departmentName ?? '').trim()) return 'กรุณาเลือกสาขาวิชา'
  if (!String(p.programName ?? '').trim()) return 'กรุณาเลือกประเภทหลักสูตร / โครงการ'
  const capacity = Number(p.capacity)
  if (!Number.isInteger(capacity) || capacity <= 0) return 'จำนวนที่รับสมัครต้องเป็นจำนวนเต็มมากกว่า 0'
  if (p.minAlevelForeign && !String(p.foreignLanguageSubject ?? '').trim()) return 'กรุณาระบุชื่อภาษาต่างประเทศ'
  return criteriaProblem(p)
}

// เกณฑ์ทั้ง 25 ช่อง: มีค่า = ตัวเลข, ไม่มี = null
const criteriaData = (p: CoursePayload) =>
  Object.fromEntries(CRITERIA_KEYS.map((k) => [k, p[k] === null || p[k] === undefined || p[k] === '' ? null : Number(p[k])]))

// หา (หรือสร้าง) แถวสาขาในตาราง University ภายใต้คณะที่กำหนด
// - เพิ่มหลักสูตร: คณะของเจ้าหน้าที่
// - แก้ไขหลักสูตร: คณะเดิมของหลักสูตร (กัน Admin แก้แล้วหลักสูตรย้ายไปคณะของ Admin)
// template = แถวมหาวิทยาลัยที่ใช้เป็นค่าเริ่มต้นของ name/code/campus ถ้าต้องสร้างสาขาใหม่
async function resolveDepartment(
  faculty: string | undefined,
  departmentName: string,
  template?: { name: string; code: string; campus: string } | null
) {
  if (!faculty) throw new Error('บัญชีนี้ยังไม่ได้ผูกกับคณะสังกัด')
  const dept = departmentName.trim()
  const existing = await prisma.university.findFirst({ where: { faculty, department: dept } })
  if (existing) return existing.Universitiesid
  const created = await prisma.university.create({
    data: {
      name: template?.name || 'มหาวิทยาลัยเกษตรศาสตร์',
      code: template?.code || `UNIV-${Date.now().toString().slice(-4)}`,
      campus: template?.campus || 'บางเขน',
      faculty,
      department: dept,
    },
  })
  return created.Universitiesid
}

export async function createCourseAction(payload: CoursePayload) {
  try {
    const officer = await getLoggedInOfficer()
    if (!officer) return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่คณะ' }

    const problem = basicProblem(payload)
    if (problem) return { success: false, message: problem }

    const id = String(payload.Program_Criteriaid ?? '').trim().toUpperCase()
    if (!id) return { success: false, message: 'กรุณากรอกรหัสหลักสูตร' }
    if (await prisma.programCriteria.findUnique({ where: { Program_Criteriaid: id } })) {
      return { success: false, message: `รหัสหลักสูตร ${id} มีอยู่แล้ว กรุณาใช้รหัสอื่น` }
    }

    const universityId = await resolveDepartment(officer.university?.faculty, payload.departmentName, officer.university)
    const course = await prisma.programCriteria.create({
      data: {
        Program_Criteriaid: id,
        programName: payload.programName,
        capacity: Number(payload.capacity),
        isOpen: payload.isOpen ?? true,
        additionals: payload.additionals?.trim() || null,
        foreignLanguageSubject: payload.minAlevelForeign ? payload.foreignLanguageSubject?.trim() || null : null,
        universityId,
        ...criteriaData(payload),
      },
      include: { university: true },
    })

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_COURSE',
        details: `เจ้าหน้าที่คณะ (${officer.name}) เพิ่มหลักสูตร ${course.programName} (${course.Program_Criteriaid}) สาขา ${course.university.department} รับ ${course.capacity} คน`,
        userId: officer.Usersid,
      },
    })

    refresh()
    return { success: true }
  } catch (err: any) {
    console.error('Create Course Error:', err)
    return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการสร้างหลักสูตร' }
  }
}

export async function deleteCourseAction(courseId: string) {
  try {
    const officer = await getLoggedInOfficer()
    if (!officer) return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่คณะ' }

    const course = await prisma.programCriteria.findUnique({
      where: { Program_Criteriaid: courseId },
      include: { university: true, _count: { select: { applications: true } } },
    })
    if (!course) return { success: false, message: 'ไม่พบหลักสูตรนี้ (อาจถูกลบไปแล้ว)' }
    if (officer.role === 'OFFICER' && course.university.faculty !== officer.university?.faculty) {
      return { success: false, message: 'ลบได้เฉพาะหลักสูตรในคณะของคุณ' }
    }
    if (course._count.applications > 0) {
      return {
        success: false,
        message: `หลักสูตรนี้มีผู้สมัครแล้ว ${course._count.applications} คน ลบไม่ได้ — ถ้าไม่ต้องการรับเพิ่ม ให้กด "แก้ไข" แล้วเอาติ๊ก "เปิดรับสมัคร" ออกแทน`,
      }
    }

    await prisma.programCriteria.delete({ where: { Program_Criteriaid: courseId } })
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_COURSE',
        details: `เจ้าหน้าที่คณะ (${officer.name}) ลบหลักสูตร ${course.programName} (${courseId}) สาขา ${course.university.department}`,
        userId: officer.Usersid,
      },
    })

    refresh()
    return { success: true }
  } catch (err: any) {
    console.error('Delete Course Error:', err)
    return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการลบหลักสูตร' }
  }
}

export async function updateCourseAction(courseId: string, payload: CoursePayload) {
  try {
    const officer = await getLoggedInOfficer()
    if (!officer) return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่คณะ' }

    const old = await prisma.programCriteria.findUnique({
      where: { Program_Criteriaid: courseId },
      include: { university: true },
    })
    if (!old) return { success: false, message: 'ไม่พบหลักสูตรนี้' }
    if (officer.role === 'OFFICER' && old.university.faculty !== officer.university?.faculty) {
      return { success: false, message: 'แก้ไขได้เฉพาะหลักสูตรในคณะของคุณ' }
    }

    const problem = basicProblem(payload)
    if (problem) return { success: false, message: problem }

    // จำนวนรับต้องไม่น้อยกว่าคนที่คัดเลือกไปแล้ว
    const passed = await prisma.application.count({
      where: { criteriaId: courseId, status: { in: ['PASSED', 'CONFIRMED'] } },
    })
    const capacity = Number(payload.capacity)
    if (capacity < passed) {
      return { success: false, message: `อาจารย์คัดเลือกผ่านไปแล้ว ${passed} คน จำนวนรับต้องไม่น้อยกว่า ${passed}` }
    }

    const universityId = await resolveDepartment(old.university.faculty, payload.departmentName, old.university)
    const newCriteria = criteriaData(payload)
    const updated = await prisma.programCriteria.update({
      where: { Program_Criteriaid: courseId },
      data: {
        programName: payload.programName,
        capacity,
        // เปิด/ปิดรับสมัครตามที่เจ้าหน้าที่เลือก (ถ้าเต็ม ระบบกันการสมัครเองจากจำนวนที่คัดเลือก)
        isOpen: Boolean(payload.isOpen),
        additionals: payload.additionals?.trim() || null,
        foreignLanguageSubject: payload.minAlevelForeign ? payload.foreignLanguageSubject?.trim() || null : null,
        universityId,
        ...newCriteria,
      },
      include: { university: true },
    })

    // บันทึกว่าเปลี่ยนอะไรบ้าง
    const changes: string[] = []
    if (old.programName !== updated.programName) changes.push(`ประเภท ${old.programName} → ${updated.programName}`)
    if (old.capacity !== updated.capacity) changes.push(`จำนวนรับ ${old.capacity} → ${updated.capacity}`)
    if (old.university.department !== updated.university.department)
      changes.push(`สาขา ${old.university.department} → ${updated.university.department}`)
    for (const c of CRITERIA) {
      const before = (old as any)[c.key] ?? null
      const after = (newCriteria as any)[c.key] ?? null
      if (before !== after) changes.push(`${criterionLabel(c.key)} ${before ?? '—'} → ${after ?? '—'}`)
    }
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_COURSE',
        details: `เจ้าหน้าที่คณะ (${officer.name}) แก้ไขหลักสูตร ${courseId}: ${changes.join(', ') || 'ไม่มีการเปลี่ยนแปลงเกณฑ์'}`,
        userId: officer.Usersid,
      },
    })

    refresh()
    return { success: true }
  } catch (err: any) {
    console.error('Update Course Error:', err)
    return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการแก้ไขหลักสูตร' }
  }
}
