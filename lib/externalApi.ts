// ตัวช่วยเรียก API ของระบบภายนอก (โรงเรียน / TCAS) ผ่าน HTTP จริง
// ค่า URL และ API key อยู่ใน .env — ไม่มีข้อมูลนักเรียนเก็บไว้ในโปรเจกต์นี้
import { createHash } from 'node:crypto'

// ลายนิ้วมือของชุดข้อมูล: ใช้เช็กว่าข้อมูลตอน "ยืนยัน" ยังเป็นชุดเดียวกับที่ Admin ดูตอน "ตรวจ"
export const hashData = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex')

// เงื่อนไขที่ทำให้ซิงก์ต่อไม่ได้ (ไม่ใช่ error ของระบบ) -> หน้าเว็บแสดงเป็นกล่องเตือนสีเหลือง
export type SyncBlockReason = 'NO_DATA' | 'NO_STUDENTS' | 'SOURCE_CHANGED' | 'BAD_REQUEST'

export class SyncBlockedError extends Error {
  constructor(public reason: SyncBlockReason, message: string, public status: number) {
    super(message)
  }
}

// แปลง error ทุกแบบเป็น JSON response เดียวกัน
export function syncErrorBody(error: any): { body: Record<string, unknown>; status: number } {
  if (error instanceof SyncBlockedError) {
    return { body: { success: false, reason: error.reason, message: error.message }, status: error.status }
  }
  const status = error instanceof ExternalApiError ? error.status : 500
  return { body: { success: false, message: error?.message ?? 'เกิดข้อผิดพลาด' }, status }
}

// อ่าน body ของคำขอ: { mode: 'preview' | 'commit', previewHash?: string }
export async function readSyncMode(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (body?.mode !== 'preview' && body?.mode !== 'commit') {
    // เช่น หน้าเว็บเวอร์ชันเก่าที่ยังไม่ได้รีเฟรช
    throw new SyncBlockedError('BAD_REQUEST', 'หน้าเว็บเป็นเวอร์ชันเก่า กรุณารีเฟรชหน้า (F5) แล้วลองใหม่', 400)
  }
  return {
    mode: body.mode as 'preview' | 'commit',
    previewHash: typeof body?.previewHash === 'string' ? body.previewHash : null,
  }
}

export const sourceChangedError = () =>
  new SyncBlockedError(
    'SOURCE_CHANGED',
    'ข้อมูลที่ต้นทางเปลี่ยนไปหลังจากที่คุณตรวจ กรุณากด "ดึงข้อมูลมาตรวจ" ใหม่อีกครั้ง',
    409
  )

export type FieldChange = { field: string; from: unknown; to: unknown }

export class ExternalApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function fetchExternal<T>(urlEnv: string, keyEnv: string): Promise<T> {
  const url = process.env[urlEnv]
  const apiKey = process.env[keyEnv]
  if (!url || !apiKey) {
    throw new ExternalApiError(`ยังไม่ได้ตั้งค่า ${urlEnv} / ${keyEnv} ในไฟล์ .env`, 500)
  }

  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err: any) {
    const reason = err?.name === 'TimeoutError' ? 'หมดเวลารอ (10 วินาที)' : 'เชื่อมต่อไม่ได้'
    throw new ExternalApiError(`เรียก API ภายนอกไม่สำเร็จ: ${reason} (${url})`, 502)
  }

  if (!res.ok) {
    const msg = res.status === 401 ? 'API key ไม่ถูกต้อง' : `HTTP ${res.status}`
    throw new ExternalApiError(`API ภายนอกตอบกลับผิดพลาด: ${msg}`, 502)
  }
  return (await res.json()) as T
}

// ตรวจเลขบัตรประชาชน 13 หลัก (เช็กเฉพาะรูปแบบตัวเลข)
export const isValidNationalIdFormat = (id: unknown) => typeof id === 'string' && /^\d{13}$/.test(id)

export const inRange = (v: unknown, min: number, max: number) =>
  v === undefined || v === null || (typeof v === 'number' && v >= min && v <= max)
