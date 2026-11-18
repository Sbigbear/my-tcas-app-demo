import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { VerificationStatus } from '@prisma/client'
import { getAdminUser } from '@/lib/adminAuth'
import {
  fetchExternal,
  SyncBlockedError,
  syncErrorBody,
  sourceChangedError,
  isValidNationalIdFormat,
  inRange,
  hashData,
  readSyncMode,
  type FieldChange,
} from '@/lib/externalApi'

type ExternalStudent = {
  studentCode?: string
  nationalId: string
  name: string
  schoolCode?: string
  schoolName?: string
  schoolProvince?: string
  gpax?: number
  mathGpa?: number
  sciGpa?: number
  engGpa?: number
  thaiGpa?: number
  socialGpa?: number
  healthGpa?: number
  artGpa?: number
  careerGpa?: number
}

const GPA_KEYS = ['gpax', 'mathGpa', 'sciGpa', 'engGpa', 'thaiGpa', 'socialGpa', 'healthGpa', 'artGpa', 'careerGpa'] as const

// ระบบเราเป็นคนตัดสินสถานะ Verified เอง (ไม่เชื่อค่าที่ส่งมา)
function verifyStudent(st: ExternalStudent): { status: VerificationStatus; problems: string[] } {
  const problems: string[] = []
  if (!st.name?.trim()) problems.push('ไม่มีชื่อ')
  if (!st.schoolCode) problems.push('ไม่มีรหัสโรงเรียน')
  if (st.gpax === undefined || st.gpax === null) problems.push('ไม่มี GPAX')
  for (const k of GPA_KEYS) {
    if (!inRange(st[k], 0, 4)) problems.push(`${k} = ${st[k]} ไม่อยู่ในช่วง 0-4`)
  }
  return { status: problems.length ? VerificationStatus.FLAGGED : VerificationStatus.VERIFIED, problems }
}

const num = (v: unknown) => (v === undefined || v === null ? null : Number(v))

// POST { mode: 'preview' }                 -> ดึงข้อมูลมาให้ Admin ตรวจ (ยังไม่บันทึก)
// POST { mode: 'commit', previewHash }     -> Admin กดยืนยัน จึงบันทึกลงฐานข้อมูล
export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ (ADMIN)' }, { status: 401 })
  }

  try {
    const { mode, previewHash } = await readSyncMode(req)

    // 1. เรียก API ภายนอกผ่าน HTTP
    const payload = await fetchExternal<{ students?: ExternalStudent[] }>('SCHOOL_API_URL', 'SCHOOL_API_KEY')
    const all = Array.isArray(payload.students) ? payload.students : []
    if (all.length === 0) {
      throw new SyncBlockedError('NO_DATA', 'ไม่มีข้อมูลนักเรียนจากระบบโรงเรียน (ต้นทางยังไม่มีข้อมูล)', 404)
    }
    const currentHash = hashData(all)

    // ตอนยืนยัน: ข้อมูลต้นทางต้องเป็นชุดเดียวกับที่ Admin ดูไปแล้ว
    if (mode === 'commit' && previewHash !== currentHash) {
      throw sourceChangedError()
    }

    // 2. แยกรายการที่เลขบัตรผิดรูปแบบ (ใช้เป็น key ไม่ได้)
    const students = all.filter((s) => isValidNationalIdFormat(s.nationalId))
    const rejectedItems = all
      .filter((s) => !isValidNationalIdFormat(s.nationalId))
      .map((s) => ({ nationalId: String(s.nationalId ?? ''), name: s.name ?? '' }))

    // 3. เทียบกับข้อมูลเดิมในฐานข้อมูล
    const existing = await prisma.student.findMany({
      where: { nationalId: { in: students.map((s) => s.nationalId) } },
      include: { school: { select: { code: true, name: true } } },
    })
    const existingMap = new Map(existing.map((s) => [s.nationalId, s]))

    const newItems: { nationalId: string; name: string; schoolName: string | null; status: VerificationStatus }[] = []
    const changedItems: { nationalId: string; name: string; changes: FieldChange[] }[] = []
    const flaggedItems: { nationalId: string; name: string; problems: string[] }[] = []
    const toWrite: { st: ExternalStudent; status: VerificationStatus }[] = []
    let unchanged = 0

    for (const st of students) {
      const { status, problems } = verifyStudent(st)
      if (status === VerificationStatus.FLAGGED) flaggedItems.push({ nationalId: st.nationalId, name: st.name, problems })

      const old = existingMap.get(st.nationalId)
      if (!old) {
        newItems.push({ nationalId: st.nationalId, name: st.name, schoolName: st.schoolName || st.schoolCode || null, status })
        toWrite.push({ st, status })
        continue
      }

      const changes: FieldChange[] = []
      if (old.name !== st.name) changes.push({ field: 'ชื่อ', from: old.name, to: st.name })
      if ((old.school?.code ?? null) !== (st.schoolCode ?? null))
        changes.push({
          field: 'โรงเรียน',
          from: old.school?.name ?? old.school?.code ?? null,
          to: st.schoolName || st.schoolCode || null,
        })
      for (const k of GPA_KEYS) {
        if (old[k] !== num(st[k])) changes.push({ field: k, from: old[k], to: num(st[k]) })
      }
      if (old.verificationStatus !== status) changes.push({ field: 'สถานะ', from: old.verificationStatus, to: status })

      if (changes.length) {
        changedItems.push({ nationalId: st.nationalId, name: st.name, changes })
        toWrite.push({ st, status })
      } else {
        unchanged++
      }
    }

    const summary = {
      total: all.length,
      new: newItems.length,
      changed: changedItems.length,
      unchanged,
      flagged: flaggedItems.length,
      rejected: rejectedItems.length,
    }

    // ===== โหมดตรวจ: ส่งรายงานกลับไป ยังไม่บันทึกอะไร =====
    if (mode === 'preview') {
      return NextResponse.json({
        success: true,
        mode,
        previewHash: currentHash,
        fetchedAt: new Date().toISOString(),
        summary,
        newItems,
        changedItems,
        flaggedItems,
        rejectedItems,
      })
    }

    // ===== โหมดยืนยัน: บันทึกเฉพาะรายการใหม่ + รายการที่เปลี่ยน =====
    const uniqueSchools = new Map<string, { code: string; name: string; province: string }>()
    for (const { st } of toWrite) {
      if (st.schoolCode && !uniqueSchools.has(st.schoolCode)) {
        uniqueSchools.set(st.schoolCode, {
          code: st.schoolCode,
          name: st.schoolName || st.schoolCode,
          province: st.schoolProvince || 'ไม่ระบุ',
        })
      }
    }
    const savedSchools = await prisma.$transaction(
      [...uniqueSchools.values()].map((sch) =>
        prisma.school.upsert({
          where: { code: sch.code },
          update: { name: sch.name, province: sch.province },
          create: sch,
        })
      )
    )
    const schoolIdMap = new Map(savedSchools.map((s) => [s.code, s.Schoolsid]))

    await prisma.$transaction(
      toWrite.map(({ st, status }) => {
        const data = {
          nationalId: st.nationalId,
          studentCode: st.studentCode || null,
          name: st.name,
          schoolId: st.schoolCode ? schoolIdMap.get(st.schoolCode) ?? null : null,
          gpax: num(st.gpax),
          mathGpa: num(st.mathGpa),
          sciGpa: num(st.sciGpa),
          engGpa: num(st.engGpa),
          thaiGpa: num(st.thaiGpa),
          socialGpa: num(st.socialGpa),
          healthGpa: num(st.healthGpa),
          artGpa: num(st.artGpa),
          careerGpa: num(st.careerGpa),
          verificationStatus: status,
        }
        return prisma.student.upsert({ where: { nationalId: st.nationalId }, update: data, create: data })
      })
    )

    const message =
      `นำเข้าข้อมูลนักเรียนสำเร็จ: เพิ่มใหม่ ${summary.new} คน, อัปเดต ${summary.changed} คน, ` +
      `ไม่เปลี่ยนแปลง ${summary.unchanged} คน (Flagged ${summary.flagged}` +
      `${summary.rejected ? `, ปฏิเสธเลขบัตรผิดรูปแบบ ${summary.rejected}` : ''})`

    await prisma.auditLog.create({
      data: { action: 'SYNC_SCHOOL_API_CONFIRMED', details: message, userId: admin.Usersid },
    })

    return NextResponse.json({ success: true, mode, message, summary })
  } catch (error: any) {
    console.error('School sync error:', error)
    const { body, status } = syncErrorBody(error)
    return NextResponse.json(body, { status })
  }
}
