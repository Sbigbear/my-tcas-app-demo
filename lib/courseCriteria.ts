// นิยามเกณฑ์หลักสูตรที่ใช้ร่วมกันทั้งฟอร์ม (client) และ server action
// ไม่ import prisma ที่นี่ เพื่อให้ไฟล์นี้ใช้ในฝั่งเบราว์เซอร์ได้

export type CriteriaKey =
  | 'minGpax' | 'minMathGpa' | 'minSciGpa' | 'minEngGpa' | 'minThaiGpa'
  | 'minSocialGpa' | 'minHealthGpa' | 'minArtGpa' | 'minCareerGpa'
  | 'minTgat' | 'minTpat1' | 'minTpat2' | 'minTpat3' | 'minTpat4' | 'minTpat5'
  | 'minAlevelMath1' | 'minAlevelMath2' | 'minAlevelSci' | 'minAlevelPhy' | 'minAlevelChem'
  | 'minAlevelBio' | 'minAlevelSoc' | 'minAlevelThai' | 'minAlevelEng' | 'minAlevelForeign'

export type CriterionDef = { key: CriteriaKey; label: string; group: 'GPA' | 'TGAT / TPAT' | 'A-Level'; max: 4 | 100 }

export const CRITERIA: CriterionDef[] = [
  { key: 'minGpax', label: 'GPAX สะสม', group: 'GPA', max: 4 },
  { key: 'minMathGpa', label: 'GPA คณิตศาสตร์', group: 'GPA', max: 4 },
  { key: 'minSciGpa', label: 'GPA วิทยาศาสตร์และเทคโนโลยี', group: 'GPA', max: 4 },
  { key: 'minEngGpa', label: 'GPA ภาษาต่างประเทศ', group: 'GPA', max: 4 },
  { key: 'minThaiGpa', label: 'GPA ภาษาไทย', group: 'GPA', max: 4 },
  { key: 'minSocialGpa', label: 'GPA สังคมศึกษาฯ', group: 'GPA', max: 4 },
  { key: 'minHealthGpa', label: 'GPA สุขศึกษาและพลศึกษา', group: 'GPA', max: 4 },
  { key: 'minArtGpa', label: 'GPA ศิลปะ', group: 'GPA', max: 4 },
  { key: 'minCareerGpa', label: 'GPA การงานอาชีพ', group: 'GPA', max: 4 },
  { key: 'minTgat', label: 'TGAT', group: 'TGAT / TPAT', max: 100 },
  { key: 'minTpat1', label: 'TPAT1 วิชาเฉพาะ กสพท', group: 'TGAT / TPAT', max: 100 },
  { key: 'minTpat2', label: 'TPAT2 ศิลปกรรมศาสตร์', group: 'TGAT / TPAT', max: 100 },
  { key: 'minTpat3', label: 'TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์', group: 'TGAT / TPAT', max: 100 },
  { key: 'minTpat4', label: 'TPAT4 สถาปัตยกรรมศาสตร์', group: 'TGAT / TPAT', max: 100 },
  { key: 'minTpat5', label: 'TPAT5 ครุศาสตร์ / ศึกษาศาสตร์', group: 'TGAT / TPAT', max: 100 },
  { key: 'minAlevelMath1', label: 'A-Level คณิตศาสตร์ประยุกต์ 1', group: 'A-Level', max: 100 },
  { key: 'minAlevelMath2', label: 'A-Level คณิตศาสตร์ประยุกต์ 2', group: 'A-Level', max: 100 },
  { key: 'minAlevelSci', label: 'A-Level วิทยาศาสตร์ประยุกต์', group: 'A-Level', max: 100 },
  { key: 'minAlevelPhy', label: 'A-Level ฟิสิกส์', group: 'A-Level', max: 100 },
  { key: 'minAlevelChem', label: 'A-Level เคมี', group: 'A-Level', max: 100 },
  { key: 'minAlevelBio', label: 'A-Level ชีววิทยา', group: 'A-Level', max: 100 },
  { key: 'minAlevelSoc', label: 'A-Level สังคมศึกษา', group: 'A-Level', max: 100 },
  { key: 'minAlevelThai', label: 'A-Level ภาษาไทย', group: 'A-Level', max: 100 },
  { key: 'minAlevelEng', label: 'A-Level ภาษาอังกฤษ', group: 'A-Level', max: 100 },
  { key: 'minAlevelForeign', label: 'A-Level ภาษาต่างประเทศอื่น ๆ', group: 'A-Level', max: 100 },
]

export const CRITERIA_KEYS = CRITERIA.map((c) => c.key)
export const criterionLabel = (key: string) => CRITERIA.find((c) => c.key === key)?.label ?? key

// ประเภทหลักสูตร/โครงการ ให้เลือกแทนการพิมพ์
export const PROGRAM_TYPES = [
  'ภาคปกติ',
  'ภาคพิเศษ',
  'หลักสูตรนานาชาติ',
  'โครงการเรียนดี',
  'โครงการผู้มีความสามารถพิเศษ',
  'โครงการรับนักเรียนในพื้นที่',
  'โครงการความร่วมมือ (MOU)',
]

// ตัวเลือกคะแนนขั้นต่ำ: GPA 1.50–4.00 (ทีละ 0.25), คะแนนสอบ 10–100 (ทีละ 5)
const range = (from: number, to: number, step: number, digits: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => (from + i * step).toFixed(digits))
export const GPA_OPTIONS = range(1.5, 4, 0.25, 2)
export const SCORE_OPTIONS = range(10, 100, 5, 0)

// เทมเพลตเกณฑ์สำเร็จรูป (ค่าตัวอย่าง — เจ้าหน้าที่ปรับได้หลังเลือก)
export const TEMPLATES: { name: string; criteria: Partial<Record<CriteriaKey, number>> }[] = [
  { name: 'วิทย์-คอม', criteria: { minGpax: 3, minMathGpa: 3, minSciGpa: 3, minTgat: 55, minTpat3: 50, minAlevelMath1: 50 } },
  { name: 'วิศวะ', criteria: { minGpax: 2.75, minMathGpa: 3, minSciGpa: 3, minTgat: 50, minTpat3: 55, minAlevelMath1: 55, minAlevelPhy: 50 } },
  { name: 'แพทย์ / สุขภาพ', criteria: { minGpax: 3.5, minSciGpa: 3.5, minTgat: 60, minTpat1: 60, minAlevelBio: 60, minAlevelChem: 60 } },
  { name: 'มนุษย์ / สังคม', criteria: { minGpax: 2.75, minTgat: 50, minAlevelSoc: 50, minAlevelThai: 50 } },
  { name: 'ภาษา', criteria: { minGpax: 2.75, minEngGpa: 3, minTgat: 50, minAlevelEng: 60 } },
  { name: 'ครุศาสตร์', criteria: { minGpax: 3, minTgat: 55, minTpat5: 55 } },
]

// ข้อความเกณฑ์ทุกข้อที่หลักสูตรกำหนด สำหรับแสดงเป็นป้าย (ใช้ร่วมกันทุกหน้า จะได้แสดงครบเหมือนกัน)
export function criteriaBadges(course: Record<string, unknown> & { foreignLanguageSubject?: string | null }): string[] {
  return CRITERIA.filter((c) => course[c.key] !== null && course[c.key] !== undefined).map((c) => {
    const v = Number(course[c.key])
    const label = c.key === 'minAlevelForeign' && course.foreignLanguageSubject ? `${c.label} (${course.foreignLanguageSubject})` : c.label
    return `${label}: ${c.max === 4 ? v.toFixed(2) : v}`
  })
}

// ตรวจค่าเกณฑ์ (ใช้ทั้งฟอร์มและ server): GPA 0–4, คะแนนสอบ 0–100
export function criteriaProblem(payload: Record<string, unknown>): string | null {
  for (const c of CRITERIA) {
    const v = payload[c.key]
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > c.max) return `${c.label} = ${v} ไม่ถูกต้อง (ต้องอยู่ระหว่าง 0–${c.max})`
  }
  return null
}
