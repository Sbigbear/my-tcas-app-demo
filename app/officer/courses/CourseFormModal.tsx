'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Pencil, Copy, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft, Building } from 'lucide-react'
import { createCourseAction, updateCourseAction } from './actions'
import {
  CRITERIA,
  type CriteriaKey,
  criterionLabel,
  GPA_OPTIONS,
  PROGRAM_TYPES,
  SCORE_OPTIONS,
  TEMPLATES,
} from '@/lib/courseCriteria'

export type CourseSnapshot = {
  id: string
  programName: string
  capacity: number
  isOpen: boolean
  additionals: string | null
  foreignLanguageSubject: string | null
  department: string
  criteria: Partial<Record<CriteriaKey, number | null>>
  totalApplicants?: number
  passedApplicants?: number
}

type Row = { key: CriteriaKey; value: string }

const GROUPS = ['GPA', 'TGAT / TPAT', 'A-Level'] as const
const fmt = (key: CriteriaKey, v: number) => (CRITERIA.find((c) => c.key === key)?.max === 4 ? v.toFixed(2) : String(v))
const rowsFrom = (criteria: CourseSnapshot['criteria']): Row[] =>
  CRITERIA.filter((c) => criteria[c.key] !== null && criteria[c.key] !== undefined).map((c) => ({
    key: c.key,
    value: fmt(c.key, Number(criteria[c.key])),
  }))
const newCourseId = () => `KU-${new Date().getFullYear() + 543}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

const inputCls =
  'w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6B50] text-slate-800 bg-white'
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1'

export default function CourseFormModal({
  mode,
  facultyName,
  departments,
  existingCourses = [],
  initial,
}: {
  mode: 'create' | 'edit'
  facultyName: string
  departments: string[]
  existingCourses?: CourseSnapshot[]
  initial?: CourseSnapshot
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [department, setDepartment] = useState('')
  const [newDeptMode, setNewDeptMode] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [programName, setProgramName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [additionals, setAdditionals] = useState('')
  const [foreign, setForeign] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  // เปิดฟอร์ม: โหมดแก้ไขโหลดค่าเดิม, โหมดเพิ่มเริ่มใหม่ (สาขาเดียว = เลือกให้เลย)
  const openForm = () => {
    setStep('form')
    setError(null)
    setActiveTemplate(null)
    setNewDeptMode(false)
    if (mode === 'edit' && initial) {
      setDepartment(initial.department)
      setCourseId(initial.id)
      setProgramName(initial.programName)
      setCapacity(String(initial.capacity))
      setIsOpen(initial.isOpen)
      setAdditionals(initial.additionals ?? '')
      setForeign(initial.foreignLanguageSubject ?? '')
      setRows(rowsFrom(initial.criteria))
    } else {
      setDepartment(departments.length === 1 ? departments[0] : '')
      setNewDeptMode(departments.length === 0)
      setCourseId(newCourseId())
      setProgramName('')
      setCapacity('')
      setIsOpen(true)
      setAdditionals('')
      setForeign('')
      setRows([])
    }
    setOpen(true)
  }

  const touch = () => setError(null)
  const usedKeys = useMemo(() => new Set(rows.map((r) => r.key)), [rows])
  const hasForeign = usedKeys.has('minAlevelForeign')

  const applyTemplate = (name: string) => {
    const t = TEMPLATES.find((x) => x.name === name)
    if (!t) return
    touch()
    setActiveTemplate(name)
    setRows(rowsFrom(t.criteria))
  }

  const copyFrom = (id: string) => {
    const c = existingCourses.find((x) => x.id === id)
    if (!c) return
    touch()
    setActiveTemplate(null)
    setProgramName(c.programName)
    setCapacity(String(c.capacity))
    setAdditionals(c.additionals ?? '')
    setForeign(c.foreignLanguageSubject ?? '')
    setRows(rowsFrom(c.criteria))
    if (departments.includes(c.department)) {
      setNewDeptMode(false)
      setDepartment(c.department)
    }
  }

  const addRow = (key: string) => {
    if (!key) return
    touch()
    setRows((prev) => [...prev, { key: key as CriteriaKey, value: '' }])
  }
  const setRowValue = (key: CriteriaKey, value: string) => {
    touch()
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)))
  }
  const removeRow = (key: CriteriaKey) => {
    touch()
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  // ตรวจก่อนไปหน้ายืนยัน
  const validate = (): string | null => {
    if (!department.trim()) return 'กรุณาเลือกสาขาวิชา'
    if (mode === 'create' && !courseId.trim()) return 'กรุณากรอกรหัสหลักสูตร'
    if (!programName) return 'กรุณาเลือกประเภทหลักสูตร / โครงการ'
    const cap = Number(capacity)
    if (!Number.isInteger(cap) || cap <= 0) return 'จำนวนที่รับสมัครต้องเป็นจำนวนเต็มมากกว่า 0'
    const passed = initial?.passedApplicants ?? 0
    if (mode === 'edit' && cap < passed) return `อาจารย์คัดเลือกผ่านไปแล้ว ${passed} คน จำนวนรับต้องไม่น้อยกว่า ${passed}`
    const empty = rows.find((r) => r.value === '')
    if (empty) return `กรุณาเลือกค่าขั้นต่ำของ "${criterionLabel(empty.key)}" หรือกด ✕ เพื่อเอาออก`
    if (hasForeign && !foreign.trim()) return 'กรุณาระบุชื่อภาษาต่างประเทศ (เช่น ภาษาญี่ปุ่น)'
    return null
  }

  const goReview = () => {
    const problem = validate()
    if (problem) return setError(problem)
    setStep('review')
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const payload = {
      departmentName: department.trim(),
      Program_Criteriaid: courseId.trim(),
      programName,
      capacity: Number(capacity),
      isOpen,
      additionals: additionals.trim() || null,
      foreignLanguageSubject: hasForeign ? foreign.trim() : null,
      ...Object.fromEntries(CRITERIA.map((c) => [c.key, null])),
      ...Object.fromEntries(rows.map((r) => [r.key, Number(r.value)])),
    }
    try {
      const res =
        mode === 'edit' && initial ? await updateCourseAction(initial.id, payload) : await createCourseAction(payload)
      if (!res.success) {
        setError(res.message ?? 'บันทึกไม่สำเร็จ')
        setStep('form')
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  // ---------- ข้อมูลสำหรับหน้ายืนยัน ----------
  const summary = [
    { label: 'คณะ / สาขา', value: `${facultyName} · ${department}`, before: initial && `${facultyName} · ${initial.department}` },
    { label: 'รหัสหลักสูตร', value: courseId, before: initial?.id },
    { label: 'ประเภทหลักสูตร', value: programName, before: initial?.programName },
    { label: 'จำนวนรับ', value: `${capacity} คน`, before: initial && `${initial.capacity} คน` },
    { label: 'สถานะ', value: isOpen ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร', before: initial && (initial.isOpen ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร') },
  ]
  const criteriaSummary = CRITERIA.filter((c) => usedKeys.has(c.key) || initial?.criteria[c.key] != null).map((c) => {
    const now = rows.find((r) => r.key === c.key)?.value ?? null
    const was = initial?.criteria[c.key] != null ? fmt(c.key, Number(initial.criteria[c.key])) : null
    return { key: c.key, label: c.key === 'minAlevelForeign' && foreign ? `${c.label} (${foreign})` : c.label, now, was }
  })
  const isChanged = (now: string | null | undefined, was: string | null | undefined) => mode === 'edit' && (now ?? null) !== (was ?? null)

  return (
    <>
      {mode === 'create' ? (
        <button
          type="button"
          onClick={openForm}
          className="bg-[#0A6B50] hover:bg-[#07382B] text-white px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> เพิ่มหลักสูตรใหม่
        </button>
      ) : (
        <button
          type="button"
          onClick={openForm}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#07382B] border border-slate-200 hover:bg-emerald-50 transition flex items-center gap-1 cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" /> แก้ไข
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden text-left">
            {/* หัว */}
            <div className="flex items-center justify-between p-5 border-b bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {step === 'review'
                    ? 'ตรวจสอบก่อนบันทึก'
                    : mode === 'edit'
                    ? `แก้ไขหลักสูตร ${initial?.id}`
                    : 'เพิ่มหลักสูตร / กำหนดเกณฑ์ TCAS'}
                </h3>
                <p className="text-xs text-slate-500">
                  {step === 'review' ? 'ตรวจข้อมูลให้ถูกต้อง แล้วกดยืนยัน' : 'เลือกเฉพาะเกณฑ์ที่หลักสูตรนี้ใช้'}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-b border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* ===================== ขั้นที่ 1: ฟอร์ม ===================== */}
            {step === 'form' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* ข้อมูลหลักสูตร */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls + ' mb-0 flex items-center gap-1.5'}>
                        <Building className="w-3.5 h-3.5 text-[#0A6B50]" /> สาขาวิชา (คณะ{facultyName}) <span className="text-red-500">*</span>
                      </label>
                      {departments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            touch()
                            setNewDeptMode((v) => !v)
                            setDepartment('')
                          }}
                          className="text-[11px] font-semibold text-[#0A6B50] hover:underline cursor-pointer"
                        >
                          {newDeptMode ? 'เลือกจากสาขาที่มี' : '+ สาขาใหม่'}
                        </button>
                      )}
                    </div>
                    {newDeptMode ? (
                      <input
                        value={department}
                        onChange={(e) => {
                          touch()
                          setDepartment(e.target.value)
                        }}
                        placeholder="พิมพ์ชื่อสาขาใหม่ เช่น วิทยาการคอมพิวเตอร์"
                        className={inputCls}
                      />
                    ) : (
                      <select
                        value={department}
                        onChange={(e) => {
                          touch()
                          setDepartment(e.target.value)
                        }}
                        className={inputCls + ' cursor-pointer'}
                      >
                        <option value="">-- เลือกสาขาวิชา --</option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>
                      รหัสหลักสูตร{' '}
                      <span className="font-normal text-slate-400">{mode === 'edit' ? '(แก้ไม่ได้)' : '(สร้างให้อัตโนมัติ แก้ได้)'}</span>
                    </label>
                    <input
                      value={courseId}
                      readOnly={mode === 'edit'}
                      onChange={(e) => {
                        touch()
                        setCourseId(e.target.value.toUpperCase())
                      }}
                      className={inputCls + ' font-mono uppercase ' + (mode === 'edit' ? 'bg-slate-100 text-slate-500' : '')}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      ประเภทหลักสูตร / โครงการ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={programName}
                      onChange={(e) => {
                        touch()
                        setProgramName(e.target.value)
                      }}
                      className={inputCls + ' cursor-pointer'}
                    >
                      <option value="">-- เลือก --</option>
                      {[...new Set([...PROGRAM_TYPES, ...(programName ? [programName] : [])])].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>
                      จำนวนที่รับ (คน) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={Math.max(1, initial?.passedApplicants ?? 0)}
                      step="1"
                      value={capacity}
                      onChange={(e) => {
                        touch()
                        setCapacity(e.target.value)
                      }}
                      placeholder="เช่น 35"
                      className={inputCls}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 self-end pb-2 cursor-pointer">
                    <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
                    เปิดรับสมัคร
                  </label>
                </div>

                {/* ทางลัด: เทมเพลต / คัดลอก */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">เริ่มจากเทมเพลต (กดแล้วเกณฑ์ขึ้นให้ทันที ปรับค่าต่อได้)</p>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => applyTemplate(t.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition cursor-pointer ${
                          activeTemplate === t.name
                            ? 'bg-emerald-50 border-[#0A6B50] text-[#07382B] font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                    {existingCourses.filter((c) => c.id !== initial?.id).length > 0 && (
                      <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
                        <Copy className="w-3.5 h-3.5" />
                        <select
                          value=""
                          onChange={(e) => copyFrom(e.target.value)}
                          className="bg-transparent outline-none cursor-pointer text-xs"
                        >
                          <option value="">คัดลอกจากหลักสูตรเดิม</option>
                          {existingCourses
                            .filter((c) => c.id !== initial?.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.id} · {c.programName} ({c.department})
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>

                {/* เกณฑ์ที่ใช้ */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">เกณฑ์คะแนนขั้นต่ำ ({rows.length})</p>
                  {rows.length === 0 && (
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 text-center">
                      ยังไม่มีเกณฑ์ — เลือกเทมเพลตด้านบน หรือกด "เพิ่มเกณฑ์" ด้านล่าง (ไม่มีเกณฑ์เลย = ทุกคนสมัครได้)
                    </p>
                  )}
                  {rows.map((r) => {
                    const def = CRITERIA.find((c) => c.key === r.key)!
                    const base = def.max === 4 ? GPA_OPTIONS : SCORE_OPTIONS
                    const options = r.value && !base.includes(r.value) ? [...base, r.value].sort((a, b) => +a - +b) : base
                    return (
                      <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_140px_28px] gap-2 items-center border border-slate-200 rounded-xl px-3 py-2">
                        <span className="text-xs text-slate-800">
                          {def.label} <span className="text-slate-400">(สูงสุด {def.max})</span>
                        </span>
                        <select
                          value={r.value}
                          onChange={(e) => setRowValue(r.key, e.target.value)}
                          className={`px-2 py-1.5 text-xs border rounded-lg cursor-pointer ${
                            r.value ? 'border-slate-200' : 'border-amber-300 bg-amber-50/40'
                          }`}
                        >
                          <option value="">-- เลือก --</option>
                          {options.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeRow(r.key)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                          aria-label={`เอา ${def.label} ออก`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}

                  {hasForeign && (
                    <input
                      value={foreign}
                      onChange={(e) => {
                        touch()
                        setForeign(e.target.value)
                      }}
                      placeholder="ชื่อภาษาต่างประเทศ เช่น ภาษาญี่ปุ่น, ภาษาจีน"
                      className={inputCls}
                    />
                  )}

                  {rows.length < CRITERIA.length && (
                    <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                      <Plus className="w-4 h-4" />
                      <select value="" onChange={(e) => addRow(e.target.value)} className="flex-1 bg-transparent outline-none cursor-pointer">
                        <option value="">เพิ่มเกณฑ์ (เลือกวิชา)</option>
                        {GROUPS.map((g) => (
                          <optgroup key={g} label={g}>
                            {CRITERIA.filter((c) => c.group === g && !usedKeys.has(c.key)).map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div>
                  <label className={labelCls}>เงื่อนไขเพิ่มเติม (ถ้ามี)</label>
                  <textarea
                    rows={2}
                    value={additionals}
                    onChange={(e) => setAdditionals(e.target.value)}
                    placeholder="เช่น ต้องผ่านการสัมภาษณ์ หรือมีแฟ้มสะสมผลงาน"
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* ===================== ขั้นที่ 2: ยืนยัน ===================== */}
            {step === 'review' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {mode === 'edit' && (initial?.totalApplicants ?? 0) > 0 && (
                  <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-xs text-amber-900">
                    หลักสูตรนี้มีผู้สมัครแล้ว {initial?.totalApplicants} คน (คัดเลือกผ่าน {initial?.passedApplicants} คน) — เกณฑ์ใหม่จะใช้กับผู้สมัครคนต่อไป
                    ผลการคัดกรองของผู้ที่สมัครไปแล้วจะไม่เปลี่ยน
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {summary.map((s) => {
                    const changed = isChanged(s.value, s.before)
                    return (
                      <div key={s.label} className={`grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-2.5 ${changed ? 'bg-blue-50/60' : ''}`}>
                        <span className="text-slate-500">{s.label}</span>
                        <span className="text-slate-900 font-medium">
                          {changed && <span className="line-through text-slate-400 font-normal mr-2">{s.before}</span>}
                          {s.value}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700">เกณฑ์คะแนนขั้นต่ำ</p>
                  {criteriaSummary.length === 0 ? (
                    <p className="text-xs text-slate-400">ไม่มีเกณฑ์คะแนนขั้นต่ำ (ทุกคนสมัครได้)</p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                      {criteriaSummary.map((c) => {
                        const changed = isChanged(c.now, c.was)
                        return (
                          <div key={c.key} className={`grid grid-cols-[minmax(0,1fr)_120px] gap-3 px-4 py-2 ${changed ? 'bg-blue-50/60' : ''}`}>
                            <span className="text-slate-700">{c.label}</span>
                            <span className="text-right font-medium text-slate-900">
                              {changed && <span className="line-through text-slate-400 font-normal mr-2">{c.was ?? 'ไม่มี'}</span>}
                              {c.now ?? <span className="text-red-600">เอาออก</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {mode === 'edit' && <p className="text-[11px] text-slate-400">แถวสีฟ้า = ค่าที่เปลี่ยนจากเดิม</p>}
                </div>

                {additionals.trim() && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700">
                    <span className="font-semibold">เงื่อนไขเพิ่มเติม:</span> {additionals}
                  </div>
                )}
              </div>
            )}

            {/* ท้าย */}
            <div className="flex items-center justify-between p-5 border-t bg-slate-50">
              {step === 'form' ? (
                <>
                  <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer">
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={goReview}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0A6B50] hover:bg-[#07382B] rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> ตรวจสอบก่อนบันทึก
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" /> กลับไปแก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0A6B50] hover:bg-[#07382B] rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {saving ? 'กำลังบันทึก...' : mode === 'edit' ? 'ยืนยันบันทึกการแก้ไข' : 'ยืนยันเพิ่มหลักสูตร'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
