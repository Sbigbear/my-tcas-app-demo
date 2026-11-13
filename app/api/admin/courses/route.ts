import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ ID ของหลักสูตร' },
        { status: 400 }
      )
    }

    await prisma.application.deleteMany({
      where: {
        criteriaId: id,
      },
    })

    await prisma.programCriteria.deleteMany({
      where: {
        Program_Criteriaid: id,
      },
    })

    revalidatePath('/admin/courses')
    revalidatePath('/officer/courses')
    revalidatePath('/teacher/courses')
    revalidatePath('/student/search')

    return NextResponse.json({
      success: true,
      message: 'ลบหลักสูตรและข้อมูลการสมัครที่เกี่ยวข้องเรียบร้อยแล้ว',
    })
  } catch (error: any) {
    console.error('Error deleting course:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'เกิดข้อผิดพลาดในการลบหลักสูตร' },
      { status: 500 }
    )
  }
}