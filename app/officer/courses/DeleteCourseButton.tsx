'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
import { deleteCourseAction } from './actions'

// ปุ่มลบหลักสูตร + หน้าต่างยืนยัน (ลบได้เฉพาะหลักสูตรที่ยังไม่มีผู้สมัคร)
export default function DeleteCourseButton({
  courseId,
  programName,
  applicants,
}: {
  courseId: string
  programName: string
  applicants: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blocked = applicants > 0

  const remove = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteCourseAction(courseId)
    setBusy(false)
    if (!res.success) return setError(res.message ?? 'ลบไม่สำเร็จ')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-slate-200 hover:bg-red-50 transition flex items-center gap-1 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" /> ลบ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-left space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${blocked ? 'bg-amber-100' : 'bg-red-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${blocked ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {blocked ? 'ลบหลักสูตรนี้ไม่ได้' : 'ยืนยันลบหลักสูตร?'}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-mono font-semibold">{courseId}</span> · {programName}
                </p>
              </div>
            </div>

            {blocked ? (
              <p className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                หลักสูตรนี้มีผู้สมัครแล้ว {applicants} คน ถ้าลบ ใบสมัครของนักเรียนจะหายไปด้วย ระบบจึงไม่อนุญาต — ถ้าไม่ต้องการรับเพิ่ม
                ให้กด <b>แก้ไข</b> แล้วเอาติ๊ก <b>เปิดรับสมัคร</b> ออกแทน
              </p>
            ) : (
              <p className="text-xs text-slate-700 bg-red-50 border border-red-200 rounded-xl p-3">
                หลักสูตรและเกณฑ์ทั้งหมดจะถูกลบถาวร กู้คืนไม่ได้
              </p>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                {blocked ? 'ปิด' : 'ยกเลิก'}
              </button>
              {!blocked && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {busy ? 'กำลังลบ...' : 'ลบถาวร'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
