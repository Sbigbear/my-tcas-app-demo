import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/adminAuth'

// DELETE ?id=... : ผู้ดูแลระบบลบหลักสูตร (พร้อมใบสมัครที่เกี่ยวข้อง) — ต้องเป็น ADMIN ที่ล็อกอินอยู่
export async function DELETE(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ ID ของหลักสูตร' },
        { status: 400 }
      )
    }

    const course = await prisma.programCriteria.findUnique({
      where: { Program_Criteriaid: id },
      include: { _count: { select: { applications: true } } },
    })
    if (!course) {
      return NextResponse.json({ success: false, message: 'ไม่พบหลักสูตรนี้' }, { status: 404 })
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

    await prisma.auditLog.create({
      data: {
        action: 'DELETE_COURSE',
        details: `ผู้ดูแลระบบ (${admin.name}) ลบหลักสูตร ${course.programName} (${id}) พร้อมใบสมัคร ${course._count.applications} รายการ`,
        userId: admin.Usersid,
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
