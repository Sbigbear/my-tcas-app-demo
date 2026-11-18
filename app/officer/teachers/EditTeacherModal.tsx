'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, RefreshCw } from 'lucide-react'
import { updateTeacherData } from './actions'

type Teacher = { id: string; name: string; email: string; teacherId: string; department: string }

const inputCls = 'w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-[#07382B] text-xs'

// ปุ่มดินสอ + หน้าต่างแก้ไขข้อมูลอาจารย์
export default function EditTeacherModal({
  teacher,
  facultyName,
  departments,
  onSaved,
}: {
  teacher: Teacher
  facultyName: string
  departments: string[]
  onSaved: (message: string, emailChanged: boolean) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', teacherId: '', department: '' })
  const [customDept, setCustomDept] = useState(false)

  const openModal = () => {
    setForm({
      name: teacher.name,
      email: teacher.email,
      teacherId: teacher.teacherId === '-' ? '' : teacher.teacherId,
      department: teacher.department === '-' ? '' : teacher.department,
    })
    setCustomDept(!departments.includes(teacher.department))
    setError(null)
    setOpen(true)
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setError(null)
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await updateTeacherData(teacher.id, form)
    setBusy(false)
    if (!res.success) return setError(res.message ?? 'บันทึกไม่สำเร็จ')
    setOpen(false)
    onSaved(res.message ?? 'บันทึกแล้ว', Boolean(res.emailChanged))
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-slate-600 hover:text-[#07382B] p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        title="แก้ไขข้อมูลอาจารย์"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <form onSubmit={save} className="bg-white w-full max-w-md p-6 rounded-2xl space-y-4 shadow-xl text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">แก้ไขข้อมูลอาจารย์</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="p-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700">{error}</div>}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
              </label>
              <input value={form.name} onChange={set('name')} required className={inputCls} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                อีเมล <span className="text-red-500">*</span>
              </label>
              <input type="email" value={form.email} onChange={set('email')} required className={inputCls} />
              {form.email.trim().toLowerCase() !== teacher.email && (
                <p className="text-[11px] text-amber-700 mt-1">
                  อาจารย์ต้องใช้อีเมลใหม่นี้ในการเข้าสู่ระบบ (รหัสผ่านเดิมยังใช้ได้)
                </p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                รหัสประจำตัวอาจารย์ <span className="text-red-500">*</span>
              </label>
              <input value={form.teacherId} onChange={set('teacherId')} required className={inputCls + ' font-mono'} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700">
                  สาขาวิชา (คณะ{facultyName}) <span className="text-red-500">*</span>
                </label>
                {departments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDept((v) => !v)
                      setForm((f) => ({ ...f, department: '' }))
                    }}
                    className="text-[11px] font-semibold text-[#07382B] hover:underline cursor-pointer"
                  >
                    {customDept ? 'เลือกจากสาขาที่มี' : '+ สาขาใหม่'}
                  </button>
                )}
              </div>
              {customDept ? (
                <input value={form.department} onChange={set('department')} required placeholder="ชื่อสาขาใหม่" className={inputCls} />
              ) : (
                <select value={form.department} onChange={set('department')} required className={inputCls + ' bg-white cursor-pointer'}>
                  <option value="">-- เลือกสาขาวิชา --</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#07382B] text-white rounded-xl font-semibold hover:bg-[#05281f] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {busy ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
