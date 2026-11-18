'use client'

import { useState } from 'react'
import { MessageSquarePlus, X, RefreshCw, CheckCircle2 } from 'lucide-react'
import { proposeCourseChange } from './actions'

// ปุ่ม "เสนอแก้ไขเกณฑ์" ในหน้าหลักสูตรของอาจารย์
export default function ProposeChangeButton({ courseId, programName }: { courseId: string; programName: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const openModal = () => {
    setText('')
    setError(null)
    setDone(null)
    setOpen(true)
  }

  const send = async () => {
    setBusy(true)
    setError(null)
    const res = await proposeCourseChange(courseId, text)
    setBusy(false)
    if (res.success) setDone(res.message ?? 'ส่งแล้ว')
    else setError(res.message ?? 'ส่งไม่สำเร็จ')
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#07382B] border border-slate-200 hover:bg-emerald-50 transition flex items-center gap-1 cursor-pointer"
      >
        <MessageSquarePlus className="w-3.5 h-3.5" /> เสนอแก้ไขเกณฑ์
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">เสนอแก้ไขเกณฑ์หลักสูตร</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-mono font-semibold">{courseId}</span> · {programName}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {done ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{done} — เจ้าหน้าที่จะเป็นผู้แก้ไขเกณฑ์ และสามารถตอบกลับทางอีเมลของคุณได้</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  ระบบจะส่งข้อความนี้ทางอีเมลถึงเจ้าหน้าที่ประจำคณะ เจ้าหน้าที่จะพิจารณาและแก้เกณฑ์ให้
                </p>
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => {
                    setError(null)
                    setText(e.target.value)
                  }}
                  maxLength={1000}
                  placeholder="เช่น อยากปรับ GPAX ขั้นต่ำจาก 1.50 เป็น 2.50 และเพิ่มเกณฑ์ A-Level ภาษาอังกฤษ 50 คะแนน เพราะ..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A6B50] text-slate-800"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{error && <span className="text-red-600">{error}</span>}</span>
                  <span>{text.length}/1000</span>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                {done ? 'ปิด' : 'ยกเลิก'}
              </button>
              {!done && (
                <button
                  type="button"
                  onClick={send}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0A6B50] hover:bg-[#07382B] rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {busy ? 'กำลังส่ง...' : 'ส่งถึงเจ้าหน้าที่'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
