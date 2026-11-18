'use client'

import { useState } from 'react'
import AuthShell, { buttonClass, inputClass } from '@/components/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setResult({ ok: data.success, message: data.message })
    } catch {
      setResult({ ok: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="ลืมรหัสผ่าน" subtitle="สำหรับอาจารย์ เจ้าหน้าที่ประจำคณะ และผู้ดูแลระบบ — กรอกอีเมลของบัญชี แล้วระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้">
      {result && (
        <div
          className={`p-3 text-xs rounded-lg border ${
            result.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-600 border-red-100'
          }`}
        >
          {result.message}
        </div>
      )}

      {!result?.ok && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">อีเมล</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
