'use server'

import prisma from '@/lib/prisma'
import { getLoggedInOfficer } from '@/lib/officerAuth'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { isValidEmail, sendResetEmail, sendWelcomeEmail } from '@/lib/passwordReset'

// เจ้าหน้าที่คณะที่ล็อกอินอยู่ (ใช้ helper กลางตัวเดียวกับหน้าหลักสูตร)
async function getOfficerInfo() {
  const user = await getLoggedInOfficer()
  return user?.role === 'OFFICER' ? user : null
}

export async function createTeacherData(formData: FormData) {
  try {
    const officer = await getOfficerInfo()
    if (!officer) return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่คณะ' }

    const name = (formData.get('name') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const rawPassword = (formData.get('password') as string)?.trim()
    const teacherId = (formData.get('teacherId') as string)?.trim()
    const department = (formData.get('department') as string)?.trim()

    if (!name || !email || !rawPassword || !department) {
      return { success: false, message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' }
    }
    if (!isValidEmail(email)) {
      return { success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลจริงของอาจารย์' }
    }
    if (!teacherId) {
      return { success: false, message: 'กรุณากรอกรหัสประจำตัวอาจารย์' }
    }

    // 🔒 1. เข้ารหัสรหัสผ่าน (Hash Password) ก่อนบันทึกลง DB
    const hashedPassword = await bcrypt.hash(rawPassword, 10)

    // 📌 คณะต้องเป็นคณะของเจ้าหน้าที่ที่ล็อกอินอยู่ (ไม่เชื่อค่าที่หน้าเว็บส่งมา)
    const faculty = officer.university?.faculty

    if (!faculty) {
      return { success: false, message: 'บัญชีเจ้าหน้าที่ยังไม่ได้ผูกกับคณะสังกัด' }
    }

    const campus = officer?.university?.campus || 'บางเขน'

    // 📌 ค้นหาสังกัดในตาราง University (คณะ + สาขา)
    let universityTarget = await prisma.university.findFirst({
      where: {
        faculty: faculty,
        department: department,
      },
    })

    if (!universityTarget) {
      const allUnivs = await prisma.university.findMany({ select: { Universitiesid: true } })
      const numbers = allUnivs
        .map((u) => {
          const numStr = u.Universitiesid.replace('univ-', '')
          const parsed = parseInt(numStr, 10)
          return isNaN(parsed) ? null : parsed
        })
        .filter((n): n is number => n !== null)

      const maxNum = numbers.length > 0 ? Math.max(...numbers) : allUnivs.length
      const newUnivId = `univ-${String(maxNum + 1).padStart(3, '0')}`

      universityTarget = await prisma.university.create({
        data: {
          Universitiesid: newUnivId,
          code: `KU${String(maxNum + 1).padStart(3, '0')}`,
          name: officer?.university?.name || 'มหาวิทยาลัยเกษตรศาสตร์',
          campus,
          faculty,
          department,
        },
      })
    }

    // 📌 สร้าง Usersid แบบหาตัวเลขสูงสุด + 1 ป้องกัน PK ชน
    const allUsers = await prisma.user.findMany({ select: { Usersid: true } })
    const userNumbers = allUsers
      .map((u) => {
        const match = u.Usersid.match(/\d+/)
        return match ? parseInt(match[0], 10) : null
      })
      .filter((n): n is number => n !== null)

    const maxUserNum = userNumbers.length > 0 ? Math.max(...userNumbers) : 0
    const customUserId = `usr-t${String(maxUserNum + 1).padStart(2, '0')}`

    // 🔒 2. บันทึกข้อมูลอาจารย์โดยใช้ hashedPassword
    const newTeacher = await prisma.user.create({
      data: {
        Usersid: customUserId,
        name,
        email,
        password: hashedPassword,
        role: 'TEACHER',
        teacherId: teacherId || null,
        universityId: universityTarget.Universitiesid,
      },
    })

    // 📧 3. ส่งอีเมลต้อนรับ + ลิงก์ให้อาจารย์ตั้งรหัสผ่านเอง
    const mail = await sendWelcomeEmail(newTeacher, officer?.name)

    revalidatePath('/officer/teachers')
    revalidatePath('/admin/users')

    return { success: true, mailSent: mail.sent, mailError: mail.error, email: newTeacher.email }
  } catch (error: any) {
    console.error('Create teacher error:', error)
    if (error.code === 'P2002') {
      const target = String(error.meta?.target ?? '')
      return {
        success: false,
        message: target.includes('teacherId')
          ? 'รหัสประจำตัวอาจารย์นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น'
          : 'อีเมลนี้มีอยู่ในระบบแล้ว',
      }
    }
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการเพิ่มอาจารย์' }
  }
}

// ✏️ เจ้าหน้าที่แก้ไขข้อมูลอาจารย์ (ชื่อ อีเมล รหัสประจำตัว สาขา) — เฉพาะอาจารย์ในคณะเดียวกัน
export async function updateTeacherData(
  teacherUserId: string,
  input: { name: string; email: string; teacherId: string; department: string }
) {
  try {
    const officer = await getOfficerInfo()
    if (!officer || officer.role !== 'OFFICER') {
      return { success: false, message: 'ต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่คณะ' }
    }
    const faculty = officer.university?.faculty
    if (!faculty) return { success: false, message: 'บัญชีเจ้าหน้าที่ยังไม่ได้ผูกกับคณะสังกัด' }

    const teacher = await prisma.user.findFirst({
      where: { Usersid: teacherUserId, role: 'TEACHER' },
      include: { university: true },
    })
    if (!teacher) return { success: false, message: 'ไม่พบบัญชีอาจารย์' }
    if (teacher.university?.faculty !== faculty) return { success: false, message: 'แก้ไขได้เฉพาะอาจารย์ในคณะของคุณ' }

    const name = input.name?.trim()
    const email = input.email?.trim().toLowerCase()
    const teacherId = input.teacherId?.trim()
    const department = input.department?.trim()
    if (!name || !email || !teacherId || !department) return { success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' }
    if (!isValidEmail(email)) return { success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลจริงของอาจารย์' }

    // สาขาภายใต้คณะของเจ้าหน้าที่ (ถ้ายังไม่มี สร้างใหม่)
    let univ = await prisma.university.findFirst({ where: { faculty, department } })
    if (!univ) {
      univ = await prisma.university.create({
        data: {
          name: officer.university?.name || 'มหาวิทยาลัยเกษตรศาสตร์',
          code: officer.university?.code || `UNIV-${Date.now().toString().slice(-4)}`,
          campus: officer.university?.campus || 'บางเขน',
          faculty,
          department,
        },
      })
    }

    await prisma.user.update({
      where: { Usersid: teacherUserId },
      data: { name, email, teacherId, universityId: univ.Universitiesid },
    })

    // เปลี่ยนอีเมลแล้ว -> ยกเลิกลิงก์ตั้ง/รีเซ็ตรหัสผ่านที่เคยส่งไปอีเมลเก่า (กันคนถืออีเมลเก่ายึดบัญชี)
    if (teacher.email !== email) {
      await prisma.passwordResetToken.updateMany({
        where: { userId: teacherUserId, usedAt: null },
        data: { usedAt: new Date() },
      })
    }

    const changes = [
      teacher.name !== name && `ชื่อ ${teacher.name} → ${name}`,
      teacher.email !== email && `อีเมล ${teacher.email} → ${email}`,
      teacher.teacherId !== teacherId && `รหัส ${teacher.teacherId ?? '-'} → ${teacherId}`,
      teacher.university?.department !== department && `สาขา ${teacher.university?.department ?? '-'} → ${department}`,
    ].filter(Boolean)
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_TEACHER',
        details: `${officer.name} แก้ไขข้อมูลอาจารย์ ${teacherUserId}: ${changes.join(', ') || 'ไม่มีการเปลี่ยนแปลง'}`,
        userId: officer.Usersid,
      },
    })

    revalidatePath('/officer/teachers')
    revalidatePath('/admin/users')
    return {
      success: true,
      message: changes.length ? `บันทึกข้อมูลอาจารย์ ${name} แล้ว` : 'ไม่มีข้อมูลที่เปลี่ยนแปลง',
      emailChanged: teacher.email !== email,
    }
  } catch (error: any) {
    console.error('Update teacher error:', error)
    if (error.code === 'P2002') {
      const target = String(error.meta?.target ?? '')
      return {
        success: false,
        message: target.includes('teacherId') ? 'รหัสประจำตัวอาจารย์นี้มีอยู่ในระบบแล้ว' : 'อีเมลนี้มีอยู่ในระบบแล้ว',
      }
    }
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลอาจารย์' }
  }
}

// 📧 เจ้าหน้าที่ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลอาจารย์ (เฉพาะอาจารย์ในคณะเดียวกัน)
export async function sendTeacherResetLink(teacherUserId: string) {
  try {
    const officer = await getOfficerInfo()
    if (!officer) {
      return { success: false, message: 'ไม่พบสิทธิ์ผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่' }
    }

    const teacher = await prisma.user.findFirst({
      where: { Usersid: teacherUserId, role: 'TEACHER' },
      include: { university: true },
    })
    if (!teacher) return { success: false, message: 'ไม่พบบัญชีอาจารย์' }
    if (officer.role === 'OFFICER' && teacher.university?.faculty !== officer.university?.faculty) {
      return { success: false, message: 'ส่งลิงก์ได้เฉพาะอาจารย์ในคณะของคุณ' }
    }

    const mail = await sendResetEmail(teacher, officer.name)
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET_LINK_SENT',
        details: `${officer.name} ส่งลิงก์รีเซ็ตรหัสผ่านให้ ${teacher.name} (${teacher.email}) — ${mail.sent ? 'ส่งอีเมลแล้ว' : `ส่งไม่สำเร็จ: ${mail.error}`}`,
        userId: officer.Usersid,
      },
    })

    return mail.sent
      ? { success: true, message: `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${teacher.email} แล้ว` }
      : { success: false, message: `ส่งอีเมลไม่สำเร็จ: ${mail.error}` }
  } catch (error: any) {
    console.error('Send teacher reset link error:', error)
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการส่งลิงก์' }
  }
}

// 📌 Export ฟังก์ชันลบอาจารย์ให้เรียกใช้งานจาก Client ได้
export async function deleteTeacherData(teacherUserId: string) {
  try {
    const officer = await getOfficerInfo()
    if (!officer) return { success: false, message: 'ไม่พบสิทธิ์ผู้ใช้งาน' }

    // ลบได้เฉพาะบัญชีอาจารย์ในคณะของเจ้าหน้าที่ (กันการส่งรหัสผู้ใช้อื่น เช่น แอดมิน มาลบ)
    const target = await prisma.user.findFirst({
      where: { Usersid: teacherUserId, role: 'TEACHER' },
      include: { university: true },
    })
    if (!target || target.university?.faculty !== officer.university?.faculty) {
      return { success: false, message: 'ลบได้เฉพาะบัญชีอาจารย์ในคณะของคุณ' }
    }

    try {
      await prisma.auditLog.deleteMany({
        where: { userId: teacherUserId },
      })
    } catch (e) {}

    await prisma.user.deleteMany({
      where: { Usersid: teacherUserId },
    })

    revalidatePath('/officer/teachers')
    revalidatePath('/admin/users')

    return { success: true, message: 'ลบข้อมูลอาจารย์เรียบร้อยแล้ว' }
  } catch (error: any) {
    console.error('Delete teacher error:', error)
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการลบ' }
  }
}