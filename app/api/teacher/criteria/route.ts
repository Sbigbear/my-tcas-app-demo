import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const toNumber = (val: any) => {
  if (val === null || val === undefined || val === '') return null
  const parsed = Number(val)
  return isNaN(parsed) ? null : parsed
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let universityId = searchParams.get('universityId')

    if (!universityId) {
      const cookieStore = await cookies()
      
      // 📌 ปรับให้เช็ค Cookie ครอบคลุมทั้ง email, user_email, userId, teacher_id
      let userEmail = cookieStore.get('email')?.value || cookieStore.get('user_email')?.value
      let userId = cookieStore.get('userId')?.value || cookieStore.get('teacher_id')?.value
      const token = cookieStore.get('token')?.value

      if (token) {
        try {
          const decoded = jwt.decode(token) as any
          if (decoded) {
            userEmail = userEmail || decoded?.email || decoded?.userEmail
            userId = userId || decoded?.id || decoded?.userId || decoded?.sub
          }
        } catch (e) {
          console.error('JWT Decode Error:', e)
        }
      }

      if (userEmail || userId) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              userEmail ? { email: userEmail } : {},
              userId ? { Usersid: userId } : {},
            ],
          },
          select: { universityId: true },
        })
        universityId = user?.universityId || null
      }
    }

    const whereCondition = universityId ? { universityId } : {}
    const criteria = await prisma.programCriteria.findMany({
      where: whereCondition,
      include: { university: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: criteria })
  } catch (error) {
    console.error('Error fetching criteria:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch criteria' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.universityId) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลมหาวิทยาลัย/สาขา (universityId)' },
        { status: 400 }
      )
    }

    const newCriteria = await prisma.programCriteria.create({
      data: {
        universityId: body.universityId,
        programName: body.programName,
        capacity: toNumber(body.capacity) ?? 0,
        minGpax: toNumber(body.minGpax),
        isOpen: body.isOpen ?? true,
        minMathGpa: toNumber(body.minMathGpa),
        minSciGpa: toNumber(body.minSciGpa),
        minEngGpa: toNumber(body.minEngGpa),
        minThaiGpa: toNumber(body.minThaiGpa),
        minSocialGpa: toNumber(body.minSocialGpa),
        minHealthGpa: toNumber(body.minHealthGpa),
        minArtGpa: toNumber(body.minArtGpa),
        minCareerGpa: toNumber(body.minCareerGpa),
        minTgat: toNumber(body.minTgat),
        minTpat1: toNumber(body.minTpat1),
        minTpat2: toNumber(body.minTpat2),
        minTpat3: toNumber(body.minTpat3),
        minTpat4: toNumber(body.minTpat4),
        minTpat5: toNumber(body.minTpat5),
        minAlevelMath1: toNumber(body.minAlevelMath1),
        minAlevelMath2: toNumber(body.minAlevelMath2),
        minAlevelSci: toNumber(body.minAlevelSci),
        minAlevelPhy: toNumber(body.minAlevelPhy),
        minAlevelChem: toNumber(body.minAlevelChem),
        minAlevelBio: toNumber(body.minAlevelBio),
        minAlevelSoc: toNumber(body.minAlevelSoc),
        minAlevelThai: toNumber(body.minAlevelThai),
        minAlevelEng: toNumber(body.minAlevelEng),
        minAlevelForeign: toNumber(body.minAlevelForeign),
        foreignLanguageSubject: body.foreignLanguageSubject || null,
      },
    })

    return NextResponse.json({ success: true, data: newCriteria })
  } catch (error) {
    console.error('Error creating criteria:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to create criteria' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, isOpen } = await req.json()

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Missing criteria ID' },
        { status: 400 }
      )
    }

    const updated = await prisma.programCriteria.update({
      where: { Program_Criteriaid: id },
      data: { isOpen },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update status' },
      { status: 500 }
    )
  }
}