import Link from 'next/link'

// กรอบหน้าเว็บแบบเดียวกับหน้าเข้าสู่ระบบ (ใช้กับหน้าลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่)
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#07382B] flex items-center justify-center font-bold text-white">KU</div>
          <span className="text-sm font-semibold text-slate-700">ระบบคัดเลือก TCAS มหาวิทยาลัยเกษตรศาสตร์</span>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="text-center text-xs">
          <Link href="/login" className="text-[#07382B] font-semibold hover:underline">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}

export const inputClass =
  'w-full px-4 py-3 text-sm text-[#0f172a] bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#07382B] focus:bg-white placeholder:text-slate-400 transition'

export const buttonClass =
  'w-full py-3 px-4 bg-[#07382B] hover:bg-[#052b21] text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50 cursor-pointer'
