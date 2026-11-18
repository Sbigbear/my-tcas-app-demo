// ส่งอีเมลจริงผ่าน SMTP (เช่น Gmail) — ตั้งค่าใน .env
//   SMTP_USER   = อีเมล Gmail ที่ใช้ส่ง
//   SMTP_PASS   = App Password 16 หลักของ Gmail (ไม่ใช่รหัสผ่านปกติ)
// ถ้ายังไม่ได้ตั้งค่า ระบบจะพิมพ์อีเมลออกทาง terminal แทน (ไม่ส่งจริง)
import nodemailer from 'nodemailer'

export const isMailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)

let transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      // Gmail แสดง App Password แบบเว้นวรรค (abcd efgh ...) -> ตัดช่องว่างออกให้อัตโนมัติ
      auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s+/g, '') },
    })
  }
  return transporter
}

export async function sendMail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  if (!isMailConfigured()) {
    console.log(`\n[mail:not-configured] ถึง ${to}\nหัวข้อ: ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}\n`)
    return { sent: false, error: 'ยังไม่ได้ตั้งค่า SMTP_USER / SMTP_PASS ใน .env' }
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || `ระบบ TCAS <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    return { sent: true }
  } catch (err: any) {
    console.error('Send mail error:', err)
    return { sent: false, error: err?.message || 'ส่งอีเมลไม่สำเร็จ' }
  }
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// เทมเพลตอีเมลแบบเรียบ ๆ ใช้ร่วมกันทุกฉบับ
export function emailTemplate(opts: { greetingName: string; paragraphs: string[]; button?: { label: string; url: string }; footnote?: string }) {
  const { greetingName, paragraphs, button, footnote } = opts
  return `
  <div style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <div style="background:#07382B;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold">
      ระบบคัดเลือก TCAS มหาวิทยาลัยเกษตรศาสตร์
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
      <p>เรียน คุณ${escape(greetingName)}</p>
      ${paragraphs.map((p) => `<p style="line-height:1.6">${p}</p>`).join('')}
      ${
        button
          ? `<p style="margin:28px 0"><a href="${button.url}" style="background:#07382B;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">${escape(button.label)}</a></p>
             <p style="font-size:12px;color:#64748b">ถ้ากดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br>${button.url}</p>`
          : ''
      }
      ${footnote ? `<p style="font-size:12px;color:#64748b;margin-top:24px">${footnote}</p>` : ''}
    </div>
  </div>`
}

export { escape as escapeHtml }
