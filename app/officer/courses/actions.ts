'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const GPA_KEYS = [
  'minGpax', 'minMathGpa', 'minSciGpa', 'minEngGpa', 'minThaiGpa',
  'minSocialGpa', 'minHealthGpa', 'minArtGpa', 'minCareerGpa',
]
const SCORE_KEYS = [
  'minTgat', 'minTpat1', 'minTpat2', 'minTpat3', 'minTpat4', 'minTpat5',
  'minAlevelMath1', 'minAlevelMath2', 'minAlevelSci', 'minAlevelPhy', 'minAlevelChem',
  'minAlevelBio', 'minAlevelSoc', 'minAlevelThai', 'minAlevelEng', 'minAlevelForeign',
]

function validateCriteria(payload: any): string | null {
  if (!String(payload.programName ?? '').trim()) return 'กรุณาเลือกประเภทหลักสูตร / โครงการ'
  const capacity = Number(payload.capacity)
  if (!Number.isInteger(capacity) || capacity <= 0) return 'จำนวนที่รับสมัครต้องเป็นจำนวนเต็มมากกว่า 0'

  const check = (keys: string[], max: number) => {
    for (const k of keys) {
      const v = payload[k]
      if (v === null || v === undefined || v === '') continue
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0 || n > max) return `ค่าเกณฑ์ ${k} = ${v} ไม่ถูกต้อง (ต้องอยู่ระหว่าง 0–${max})`
    }
    return null
  }
  return check(GPA_KEYS, 4) ?? check(SCORE_KEYS, 100)
}

export async function createCourseAction(payload: any, userId: string) {
  try {
    // 1. ค้นหาข้อมูลผู้ใช้งาน
    const user = await prisma.user.findUnique({
      where: { Usersid: userId },
      include: { university: true },
    })

    if (!user) {
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' }
    }

    // 🔒 ตรวจค่าเกณฑ์ฝั่งเซิร์ฟเวอร์ (กันการส่งค่าข้ามฟอร์ม): GPA 0–4, คะแนนสอบ 0–100
    const problem = validateCriteria(payload)
    if (problem) return { success: false, message: problem }

    // 2. ค้นหาหรือระบุ universityId
    let universityId = payload.universityId || user.universityId

    if (payload.facultyName && payload.departmentName) {
      const univ = await prisma.university.findFirst({
        where: {
          faculty: payload.facultyName,
          department: payload.departmentName,
        },
      })

      if (univ) {
        universityId = univ.Universitiesid
      } else {
        // กรณีพิมพ์เพิ่มสาขาใหม่ (ใส่ name และ code ป้องกัน error จาก Required Field)
        const newUniv = await prisma.university.create({
          data: {
            name: user?.university?.name || 'มหาวิทยาลัย',
            code: user?.university?.code || `UNIV-${Date.now().toString().slice(-4)}`,
            faculty: payload.facultyName,
            department: payload.departmentName,
            campus: user?.university?.campus || 'หลัก',
          },
        })
        universityId = newUniv.Universitiesid
      }
    }

    // 3. บันทึกข้อมูลหลักสูตรและเกณฑ์ TCAS ทั้งหมดลงตาราง ProgramCriteria
    const newCourse = await prisma.programCriteria.create({
      data: {
        Program_Criteriaid: payload.Program_Criteriaid || payload.criteriaId,
        programName: payload.programName,
        capacity: Number(payload.capacity),
        isOpen: payload.isOpen ?? true,
        additionals: payload.additionals || null,
        foreignLanguageSubject: payload.foreignLanguageSubject || null,
        universityId: universityId,

        // GPAX & GPA รายกลุ่มสาระ
        minGpax: payload.minGpax ? Number(payload.minGpax) : null,
        minMathGpa: payload.minMathGpa ? Number(payload.minMathGpa) : null,
        minSciGpa: payload.minSciGpa ? Number(payload.minSciGpa) : null,
        minEngGpa: payload.minEngGpa ? Number(payload.minEngGpa) : null,
        minThaiGpa: payload.minThaiGpa ? Number(payload.minThaiGpa) : null,
        minSocialGpa: payload.minSocialGpa ? Number(payload.minSocialGpa) : null,
        minHealthGpa: payload.minHealthGpa ? Number(payload.minHealthGpa) : null,
        minArtGpa: payload.minArtGpa ? Number(payload.minArtGpa) : null,
        minCareerGpa: payload.minCareerGpa ? Number(payload.minCareerGpa) : null,

        // TGAT / TPAT
        minTgat: payload.minTgat ? Number(payload.minTgat) : null,
        minTpat1: payload.minTpat1 ? Number(payload.minTpat1) : null,
        minTpat2: payload.minTpat2 ? Number(payload.minTpat2) : null,
        minTpat3: payload.minTpat3 ? Number(payload.minTpat3) : null,
        minTpat4: payload.minTpat4 ? Number(payload.minTpat4) : null,
        minTpat5: payload.minTpat5 ? Number(payload.minTpat5) : null,

        // A-Level
        minAlevelMath1: payload.minAlevelMath1 ? Number(payload.minAlevelMath1) : null,
        minAlevelMath2: payload.minAlevelMath2 ? Number(payload.minAlevelMath2) : null,
        minAlevelSci: payload.minAlevelSci ? Number(payload.minAlevelSci) : null,
        minAlevelPhy: payload.minAlevelPhy ? Number(payload.minAlevelPhy) : null,
        minAlevelChem: payload.minAlevelChem ? Number(payload.minAlevelChem) : null,
        minAlevelBio: payload.minAlevelBio ? Number(payload.minAlevelBio) : null,
        minAlevelSoc: payload.minAlevelSoc ? Number(payload.minAlevelSoc) : null,
        minAlevelThai: payload.minAlevelThai ? Number(payload.minAlevelThai) : null,
        minAlevelEng: payload.minAlevelEng ? Number(payload.minAlevelEng) : null,
        minAlevelForeign: payload.minAlevelForeign ? Number(payload.minAlevelForeign) : null,
      },
      include: {
        university: true,
      },
    })

    // 4. บันทึกประวัติการสร้างหลักสูตรลงตาราง AuditLog
    try {
      const performerName = user.name || 'ผู้ใช้งาน'
      const userRole = user.role || 'OFFICER'
      const faculty = newCourse.university?.faculty || ''
      const dept = newCourse.university?.department || ''

      await prisma.auditLog.create({
        data: {
          action: 'CREATE_COURSE',
          details: `${userRole === 'OFFICER' ? 'เจ้าหน้าที่คณะ' : 'อาจารย์'} (${performerName}) เพิ่มหลักสูตรใหม่: ${newCourse.programName} (${newCourse.Program_Criteriaid}) สังกัด ${faculty} (${dept}) รับจำนวน ${newCourse.capacity} คน`,
          userId: userId,
        },
      })
    } catch (logErr) {
      console.error('AuditLog Error:', logErr)
    }

    revalidatePath('/officer/courses')
    revalidatePath('/teacher/courses')
    revalidatePath('/student/search')
    revalidatePath('/admin/logs')

    return { success: true, course: newCourse }
  } catch (err: any) {
    console.error('Create Course Error:', err)
    return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการสร้างหลักสูตร' }
  }
}