'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthShell, { buttonClass, inputClass } from '@/components/AuthShell'

type LinkInfo = { email: string; name: string; purpose: 'RESET' | 'SETUP' }

export default function ResetPasswordForm({ token }: { token: string }) {
  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // เช็กลิงก์ก่อนว่ายังใช้ได้
  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => (d.success ? setInfo(d) : setLinkError(d.message)))
      .catch(() => setLinkError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.success) setDone(data.message)
      else setError(data.message)
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const title = info?.purpose === 'SETUP' ? 'ตั้งรหัสผ่านสำหรับบัญชีใหม่' : 'ตั้งรหัสผ่านใหม่'

  return (
    <AuthShell title={title} subtitle={info ? `บัญชี ${info.email} (${info.name})` : 'กำลังตรวจสอบลิงก์...'}>
      {linkError && (
        <div className="space-y-3">
          <div className="p-3 text-xs bg-red-50 text-red-600 rounded-lg border border-red-100">{linkError}</div>
          <Link href="/forgot-password" className="block text-center text-xs font-semibold text-[#07382B] hover:underline">
            ขอลิงก์ใหม่
          </Link>
        </div>
      )}

      {done && (
        <div className="space-y-4">
          <div className="p-3 text-xs bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">{done}</div>
          <Link href="/login" className={`${buttonClass} block text-center`}>
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      )}

      {info && !done && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 text-xs bg-red-50 text-red-600 rounded-lg border border-red-100">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">รหัสผ่านใหม่</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              placeholder="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข"
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null) }}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
