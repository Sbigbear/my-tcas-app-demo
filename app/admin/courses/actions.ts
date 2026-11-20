'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function deleteCourseAction(id: string) {
  try {
    if (!id) {
      return { success: false, message: 'กรุณาระบุ ID หลักสูตร' }
    }

    await prisma.application.deleteMany({
      where: { criteriaId: id },
    })

    await prisma.programCriteria.deleteMany({
      where: { Program_Criteriaid: id },
    })

    revalidatePath('/admin/courses')
    revalidatePath('/officer/courses')
    revalidatePath('/teacher/courses')
    revalidatePath('/student/search')

    return { success: true, message: 'ลบหลักสูตรเรียบร้อยแล้ว' }
  } catch (error: any) {
    console.error('Delete admin course error:', error)
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการลบหลักสูตร' }
  }
}