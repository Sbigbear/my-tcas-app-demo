'use client'

import { useState } from 'react'
import {
  School,
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

type Source = 'school' | 'tcas'
type FieldChange = { field: string; from: unknown; to: unknown }

type Preview = {
  source: Source
  previewHash: string
  fetchedAt: string
  summary: Record<string, number>
  newItems: { nationalId: string; name: string; schoolName?: string | null; status?: string }[]
  changedItems: { nationalId: string; name: string; changes: FieldChange[] }[]
  problemItems: { nationalId: string; name: string; problems: string[] }[]
  skippedItems: { nationalId: string; name?: string }[]
}

type Log = { type: 'success' | 'error' | 'warning'; title: string; message: string; time: string }

// หัวข้อกล่องเตือน ตามเหตุผลที่ server ส่งมา
const BLOCK_TITLE: Record<string, string> = {
  NO_DATA: 'ไม่มีข้อมูล',
  NO_STUDENTS: 'ยังซิงก์คะแนนไม่ได้',
  SOURCE_CHANGED: 'ข้อมูลต้นทางเปลี่ยนแปลง',
  BAD_REQUEST: 'กรุณารีเฟรชหน้า',
}

const LOG_STYLE = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-rose-50 border-rose-200 text-rose-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
} as const

// แปลงคำตอบที่ไม่สำเร็จเป็นกล่องข้อความ: มี reason = เตือน (เหลือง), ไม่มี = error (แดง)
const failLog = (data: any, fallbackTitle: string): Log =>
  data?.reason
    ? { type: 'warning', title: BLOCK_TITLE[data.reason] ?? fallbackTitle, message: data.message, time: now() }
    : { type: 'error', title: fallbackTitle, message: data?.message ?? 'เกิดข้อผิดพลาด', time: now() }

const SOURCE_LABEL: Record<Source, string> = {
  school: 'ข้อมูลโรงเรียน & นักเรียน',
  tcas: 'คะแนนสอบ TCAS',
}

const now = () => new Date().toLocaleTimeString('th-TH')
const show = (v: unknown) => (v === null || v === undefined ? '—' : String(v))

export default function AdminSyncPage() {
  const [loading, setLoading] = useState<null | { source: Source; step: 'preview' | 'commit' }>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [log, setLog] = useState<Log | null>(null)

  // ขั้นที่ 1: ดึงข้อมูลมาให้ตรวจ (ยังไม่บันทึก)
  const handlePreview = async (source: Source) => {
    setLoading({ source, step: 'preview' })
    setLog(null)
    setPreview(null)
    try {
      const res = await fetch(`/api/sync/${source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview' }),
      })
      const data = await res.json()
      if (!data.success) {
        setLog(failLog(data, `ดึงข้อมูล${SOURCE_LABEL[source]}ไม่สำเร็จ`))
        return
      }
      setPreview({
        source,
        previewHash: data.previewHash,
        fetchedAt: data.fetchedAt,
        summary: data.summary,
        newItems: data.newItems ?? [],
        changedItems: data.changedItems ?? [],
        problemItems: source === 'school' ? data.flaggedItems ?? [] : data.invalidItems ?? [],
        skippedItems: source === 'school' ? data.rejectedItems ?? [] : data.notFoundItems ?? [],
      })
    } catch {
      setLog({ type: 'error', title: 'ข้อผิดพลาดเครือข่าย', message: `ไม่สามารถเชื่อมต่อ /api/sync/${source} ได้`, time: now() })
    } finally {
      setLoading(null)
    }
  }

  // ขั้นที่ 2: Admin กดยืนยัน -> บันทึกจริง
  const handleConfirm = async () => {
    if (!preview) return
    const { source, previewHash } = preview
    setLoading({ source, step: 'commit' })
    try {
      const res = await fetch(`/api/sync/${source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'commit', previewHash }),
      })
      const data = await res.json()
      if (data.success) {
        setLog({ type: 'success', title: `นำเข้า${SOURCE_LABEL[source]}สำเร็จ`, message: data.message, time: now() })
        setPreview(null)
      } else {
        setLog(failLog(data, `นำเข้า${SOURCE_LABEL[source]}ไม่สำเร็จ`))
        if (data?.reason) setPreview(null)
      }
    } catch {
      setLog({ type: 'error', title: 'ข้อผิดพลาดเครือข่าย', message: `ไม่สามารถเชื่อมต่อ /api/sync/${source} ได้`, time: now() })
    } finally {
      setLoading(null)
    }
  }

  const handleCancel = () => {
    if (!preview) return
    setLog({
      type: 'error',
      title: 'ยกเลิกการนำเข้า',
      message: `ไม่ได้บันทึก${SOURCE_LABEL[preview.source]}ลงฐานข้อมูล`,
      time: now(),
    })
    setPreview(null)
  }

  const busy = loading !== null
  const isSchool = preview?.source === 'school'
  const toImport = preview ? preview.summary.new + preview.summary.changed : 0

  const renderPreviewButton = (source: Source, className: string) => {
    const spinning = loading?.source === source && loading.step === 'preview'
    return (
      <button
        onClick={() => handlePreview(source)}
        disabled={busy}
        className={`mt-6 w-full py-3 px-4 text-white font-medium rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {spinning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {spinning ? 'กำลังดึงข้อมูลมาตรวจ...' : 'ดึงข้อมูลมาตรวจ'}
      </button>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* ส่วนหัวข้อหน้า */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Database className="w-7 h-7 text-[#063b2c]" />
          ดึงข้อมูลจากระบบภายนอกผ่าน API (External API Sync)
        </h1>
      </div>

      {/* การ์ดตัวเลือกซิงก์ข้อมูล */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#063b2c] flex items-center justify-center">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">1. ข้อมูลโรงเรียน & นักเรียน (ปพ.1)</h2>
              <p className="text-xs text-gray-500 mt-1">
                ดึงข้อมูลผ่าน API ระบบโรงเรียน (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-emerald-800 font-mono">GET /api/school/students</code>)
              </p>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>ตรวจความถูกต้อง (Verified / Flagged) ก่อนนำเข้า</li>
              <li>เทียบกับข้อมูลเดิม: แสดงรายการใหม่ / ที่เปลี่ยนแปลง</li>
            </ul>
          </div>
          {renderPreviewButton('school', 'bg-[#063b2c] hover:bg-[#04281e]')}
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">2. คะแนนสอบ TCAS</h2>
              <p className="text-xs text-gray-500 mt-1">
                ดึงข้อมูลผ่าน API ระบบ TCAS (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-800 font-mono">GET /api/tcas/scores</code>)
              </p>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>แมปเลข 13 หลัก (<code className="font-semibold">nationalId</code>) กับนักเรียนในระบบ</li>
              <li>ตรวจคะแนนต้องอยู่ในช่วง 0–100 ก่อนนำเข้า</li>
            </ul>
          </div>
          {renderPreviewButton('tcas', 'bg-emerald-600 hover:bg-emerald-700')}
        </div>
      </div>

      {/* ===== กล่องตรวจข้อมูลก่อนยืนยัน ===== */}
      {preview && (
        <div className="bg-white border-2 border-amber-300 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-amber-900 flex items-center gap-2">
                ตรวจข้อมูลก่อนนำเข้า: {SOURCE_LABEL[preview.source]}
              </h2>
              <p className="text-xs text-amber-800 mt-1">
                ดึงจาก API เมื่อ {new Date(preview.fetchedAt).toLocaleTimeString('th-TH')} — <b>ยังไม่ได้บันทึกลงฐานข้อมูล</b>
              </p>
            </div>
            <button onClick={handleCancel} disabled={busy} className="text-amber-700 hover:text-amber-900 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* ตัวเลขสรุป */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <Stat label="ทั้งหมดจาก API" value={preview.summary.total} tone="slate" />
              <Stat label="เพิ่มใหม่" value={preview.summary.new} tone="emerald" />
              <Stat label="เปลี่ยนแปลง" value={preview.summary.changed} tone="blue" />
              <Stat label="ไม่เปลี่ยนแปลง" value={preview.summary.unchanged} tone="slate" />
              <Stat
                label={isSchool ? 'Flagged' : 'คะแนนผิดรูปแบบ'}
                value={isSchool ? preview.summary.flagged : preview.summary.invalid}
                tone="rose"
              />
            </div>

            {/* รายการที่มีปัญหา */}
            {preview.problemItems.length > 0 && (
              <Section
                title={isSchool ? `ข้อมูลผิดปกติ (จะนำเข้าด้วยสถานะ Flagged) — ${preview.problemItems.length} คน` : `คะแนนผิดรูปแบบ (จะไม่นำเข้า) — ${preview.problemItems.length} คน`}
                tone="rose"
                defaultOpen
              >
                {preview.problemItems.map((it) => (
                  <Row key={it.nationalId} id={it.nationalId} name={it.name}>
                    <span className="text-rose-700">{it.problems.join(', ')}</span>
                  </Row>
                ))}
              </Section>
            )}

            {/* รายการที่เปลี่ยนแปลง */}
            {preview.changedItems.length > 0 && (
              <Section title={`ข้อมูลที่จะถูกอัปเดต — ${preview.changedItems.length} คน`} tone="blue" defaultOpen>
                {preview.changedItems.map((it) => (
                  <Row key={it.nationalId} id={it.nationalId} name={it.name}>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {it.changes.map((c) => (
                        <span key={c.field} className="inline-flex items-center gap-1">
                          <b className="text-slate-700">{c.field}:</b>
                          <span className="line-through text-slate-400">{show(c.from)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-blue-700">{show(c.to)}</span>
                        </span>
                      ))}
                    </div>
                  </Row>
                ))}
              </Section>
            )}

            {/* รายการใหม่ */}
            {preview.newItems.length > 0 && (
              <Section title={`รายการใหม่ที่จะเพิ่ม — ${preview.newItems.length} คน`} tone="emerald">
                {preview.newItems.map((it) => (
                  <Row key={it.nationalId} id={it.nationalId} name={it.name}>
                    {it.schoolName && <span className="text-slate-500">{it.schoolName}</span>}
                  </Row>
                ))}
              </Section>
            )}

            {/* รายการที่ข้าม */}
            {preview.skippedItems.length > 0 && (
              <Section
                title={isSchool ? `เลขบัตรผิดรูปแบบ (ไม่นำเข้า) — ${preview.skippedItems.length}` : `ไม่พบนักเรียนในระบบ (ไม่นำเข้า) — ${preview.skippedItems.length}`}
                tone="slate"
              >
                {preview.skippedItems.map((it, i) => (
                  <Row key={`${it.nationalId}-${i}`} id={it.nationalId} name={it.name ?? ''} />
                ))}
              </Section>
            )}

            {toImport === 0 && preview.problemItems.length === 0 && (
              <p className="text-sm text-slate-600 bg-slate-50 border rounded-xl p-3">
                ข้อมูลจาก API ตรงกับในระบบทั้งหมดแล้ว ไม่มีอะไรต้องนำเข้า
              </p>
            )}

            {/* ปุ่มยืนยัน / ยกเลิก */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
              <button
                onClick={handleConfirm}
                disabled={busy || toImport === 0}
                className="flex-1 py-3 px-4 bg-[#063b2c] hover:bg-[#04281e] text-white font-medium rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading?.step === 'commit' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {loading?.step === 'commit' ? 'กำลังบันทึก...' : `ยืนยันนำเข้า ${toImport} รายการ`}
              </button>
              <button
                onClick={handleCancel}
                disabled={busy}
                className="sm:w-40 py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* กล่องแสดง Log ผลการทำงาน */}
      {log && (
        <div
          className={`p-5 rounded-2xl border flex items-start gap-3 transition-all ${LOG_STYLE[log.type]}`}
        >
          {log.type === 'success' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : log.type === 'warning' ? (
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">{log.title}</h3>
              <span className="text-xs opacity-75 font-mono">{log.time}</span>
            </div>
            <p className="text-xs font-mono bg-white/60 p-2.5 rounded-lg border border-black/5 mt-2">{log.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

const TONES = {
  slate: 'bg-slate-50 border-slate-200 text-slate-800',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  rose: 'bg-rose-50 border-rose-200 text-rose-800',
} as const

function Stat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <div className={`border rounded-xl p-3 ${TONES[tone]}`}>
      <div className="text-2xl font-bold">{value ?? 0}</div>
      <div className="text-[11px] mt-0.5">{label}</div>
    </div>
  )
}

function Section({
  title,
  tone,
  defaultOpen,
  children,
}: {
  title: string
  tone: keyof typeof TONES
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className={`border rounded-xl ${TONES[tone]}`}>
      <summary className="px-4 py-2.5 text-sm font-semibold cursor-pointer select-none">{title}</summary>
      <div className="bg-white rounded-b-xl max-h-64 overflow-y-auto divide-y text-xs">{children}</div>
    </details>
  )
}

function Row({ id, name, children }: { id: string; name: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <span className="font-mono text-slate-500 sm:w-32 shrink-0">{id}</span>
      <span className="font-medium text-slate-800 sm:w-44 shrink-0">{name}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
