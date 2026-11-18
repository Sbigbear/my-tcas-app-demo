'use server'

import { revalidatePath } from 'next/cache'
import { setApplicationStatusAsTeacher } from '@/lib/applicationStatus'

// ปุ่ม "รับผ่านการคัดเลือก" / "ยกเลิกผล" ในหน้ารายชื่อผู้สมัครของอาจารย์
// (server action เรียกจากภายนอกได้เหมือน API จึงต้องตรวจสิทธิ์ทุกครั้ง — ทำใน setApplicationStatusAsTeacher)
export async function updateApplicationStatus(applicationId: string, newStatus: 'PASSED' | 'PENDING' | 'REJECTED') {
  try {
    const result = await setApplicationStatusAsTeacher(applicationId, newStatus)
    if (!result.success) return { success: false, message: result.message }

    // ล้าง Cache ทุกหน้า (ทั้งฝั่งนักเรียน อาจารย์ และเจ้าหน้าที่คณะ)
    revalidatePath('/student/search')
    revalidatePath('/student/sample-apply')
    revalidatePath('/teacher/applicants')
    revalidatePath('/teacher/courses')
    revalidatePath('/teacher/dashboard')
    revalidatePath('/officer/courses')
    revalidatePath('/officer/confirmations')

    return { success: true, newStatus }
  } catch (err: any) {
    console.error('Update Status Error:', err)
    return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' }
  }
}
