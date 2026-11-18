import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
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

const SCORE_KEYS = [
  'tgat', 'tpat1', 'tpat2', 'tpat3', 'tpat4', 'tpat5',
  'alevelMath1', 'alevelMath2', 'alevelSci', 'alevelPhy', 'alevelChem', 'alevelBio',
  'alevelSoc', 'alevelThai', 'alevelEng', 'alevelForeign',
] as const

type ScoreKey = (typeof SCORE_KEYS)[number]
type ExternalScore = { nationalId: string } & Partial<Record<ScoreKey, number>>

const toScoreData = (sc: ExternalScore) =>
  Object.fromEntries(SCORE_KEYS.map((k) => [k, sc[k] === undefined || sc[k] === null ? null : Number(sc[k])])) as Record<
    ScoreKey,
    number | null
  >

// POST { mode: 'preview' }                 -> ดึงคะแนนมาให้ Admin ตรวจ (ยังไม่บันทึก)
// POST { mode: 'commit', previewHash }     -> Admin กดยืนยัน จึงบันทึกลงฐานข้อมูล
export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ (ADMIN)' }, { status: 401 })
  }

  try {
    const { mode, previewHash } = await readSyncMode(req)

    // 1. เรียก API ภายนอกผ่าน HTTP
    const payload = await fetchExternal<{ scores?: ExternalScore[] }>('TCAS_API_URL', 'TCAS_API_KEY')
    const scores = Array.isArray(payload.scores) ? payload.scores : []
    if (scores.length === 0) {
      throw new SyncBlockedError('NO_DATA', 'ไม่มีข้อมูลคะแนนจากระบบ TCAS (ต้นทางยังไม่มีข้อมูล)', 404)
    }
    const currentHash = hashData(scores)

    if (mode === 'commit' && previewHash !== currentHash) {
      throw sourceChangedError()
    }

    // 2. จับคู่กับนักเรียนในระบบด้วยเลขบัตร 13 หลัก + ดึงคะแนนเดิมมาเทียบ
    const ids = scores.map((s) => s.nationalId).filter(isValidNationalIdFormat)
    const students = await prisma.student.findMany({
      where: { nationalId: { in: ids } },
      select: { Studentsid: true, nationalId: true, name: true, tcasScores: true },
    })
    const studentMap = new Map(students.map((s) => [s.nationalId, s]))

    // คะแนนต้องผูกกับนักเรียน -> ถ้ายังไม่มีนักเรียนที่ตรงกันเลย ต้องซิงก์ข้อมูลโรงเรียนก่อน
    if (students.length === 0) {
      const totalStudents = await prisma.student.count()
      throw new SyncBlockedError(
        'NO_STUDENTS',
        totalStudents === 0
          ? 'ยังไม่มีข้อมูลนักเรียนในระบบ กรุณาซิงก์ "ข้อมูลโรงเรียน & นักเรียน" ก่อน แล้วค่อยซิงก์คะแนน TCAS'
          : 'คะแนนจากระบบ TCAS ไม่ตรงกับนักเรียนคนใดในระบบเลย กรุณาซิงก์ "ข้อมูลโรงเรียน & นักเรียน" ให้เป็นปัจจุบันก่อน',
        409
      )
    }

    const newItems: { nationalId: string; name: string }[] = []
    const changedItems: { nationalId: string; name: string; changes: FieldChange[] }[] = []
    const notFoundItems: { nationalId: string }[] = []
    const invalidItems: { nationalId: string; name: string; problems: string[] }[] = []
    const toWrite: { studentId: string; data: Record<ScoreKey, number | null> }[] = []
    let unchanged = 0

    for (const sc of scores) {
      const student = studentMap.get(sc.nationalId)
      if (!student) {
        notFoundItems.push({ nationalId: String(sc.nationalId ?? '') })
        continue
      }

      const problems = SCORE_KEYS.filter((k) => !inRange(sc[k], 0, 100)).map((k) => `${k} = ${sc[k]} ไม่อยู่ในช่วง 0-100`)
      if (problems.length) {
        invalidItems.push({ nationalId: sc.nationalId, name: student.name, problems })
        continue
      }

      const data = toScoreData(sc)
      const old = student.tcasScores
      if (!old) {
        newItems.push({ nationalId: sc.nationalId, name: student.name })
        toWrite.push({ studentId: student.Studentsid, data })
        continue
      }

      const changes: FieldChange[] = SCORE_KEYS.filter((k) => old[k] !== data[k]).map((k) => ({
        field: k,
        from: old[k],
        to: data[k],
      }))
      if (changes.length) {
        changedItems.push({ nationalId: sc.nationalId, name: student.name, changes })
        toWrite.push({ studentId: student.Studentsid, data })
      } else {
        unchanged++
      }
    }

    const summary = {
      total: scores.length,
      new: newItems.length,
      changed: changedItems.length,
      unchanged,
      notFound: notFoundItems.length,
      invalid: invalidItems.length,
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
        notFoundItems,
        invalidItems,
      })
    }

    // ===== โหมดยืนยัน: บันทึกเฉพาะรายการใหม่ + รายการที่เปลี่ยน =====
    await prisma.$transaction(
      toWrite.map(({ studentId, data }) =>
        prisma.tcasScore.upsert({
          where: { studentId },
          update: data,
          create: { studentId, ...data },
        })
      )
    )

    const message =
      `นำเข้าคะแนน TCAS สำเร็จ: เพิ่มใหม่ ${summary.new}, อัปเดต ${summary.changed}, ไม่เปลี่ยนแปลง ${summary.unchanged}` +
      (summary.notFound ? `, ไม่พบนักเรียนในระบบ ${summary.notFound}` : '') +
      (summary.invalid ? `, คะแนนผิดรูปแบบ (ไม่นำเข้า) ${summary.invalid}` : '')

    await prisma.auditLog.create({
      data: { action: 'SYNC_TCAS_API_CONFIRMED', details: message, userId: admin.Usersid },
    })

    return NextResponse.json({ success: true, mode, message, summary })
  } catch (error: any) {
    console.error('TCAS sync error:', error)
    const { body, status } = syncErrorBody(error)
    return NextResponse.json(body, { status })
  }
}
