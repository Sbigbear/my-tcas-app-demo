import prisma from '@/lib/prisma'
import { getLoggedInOfficer } from '@/lib/officerAuth'
import { CRITERIA_KEYS } from '@/lib/courseCriteria'
import CourseFormModal, { type CourseSnapshot } from './CourseFormModal'
import DeleteCourseButton from './DeleteCourseButton'

export default async function OfficerCoursesPage() {
  const officer = await getLoggedInOfficer()
  const facultyName = officer?.university?.faculty || ''

  const courses = facultyName
    ? await prisma.programCriteria.findMany({
        where: {
          university: {
            faculty: facultyName,
          },
        },
        include: {
          university: true,
          applications: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  // สาขาในคณะของเจ้าหน้าที่ (ไม่รวมแถว "ประจำคณะ" ของบัญชีเจ้าหน้าที่เอง)
  const deptRows = facultyName
    ? await prisma.university.findMany({ where: { faculty: facultyName }, select: { department: true } })
    : []
  const departments = [...new Set(deptRows.map((d) => d.department).filter((d) => d && d !== 'ประจำคณะ'))].sort()

  // ข้อมูลหลักสูตรสำหรับฟอร์ม (แก้ไข / คัดลอก)
  const snapshots: CourseSnapshot[] = courses.map((c) => ({
    id: c.Program_Criteriaid,
    programName: c.programName,
    capacity: c.capacity,
    isOpen: c.isOpen,
    additionals: c.additionals,
    foreignLanguageSubject: c.foreignLanguageSubject,
    department: c.university.department,
    criteria: Object.fromEntries(CRITERIA_KEYS.map((k) => [k, (c as any)[k] ?? null])),
    totalApplicants: c.applications.length,
    passedApplicants: c.applications.filter((a) => a.status === 'PASSED' || a.status === 'CONFIRMED').length,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">ระบบจัดการหลักสูตรระดับคณะ (Faculty Officer)</p>
          <h1 className="text-2xl font-bold text-slate-900">จัดการหลักสูตรและเกณฑ์การรับสมัคร</h1>
          <p className="text-xs text-slate-500">
            กำหนดหลักสูตร จำนวนรับ และเกณฑ์คะแนนขั้นต่ำสำหรับอาจารย์ใช้คัดเลือก สังกัด{' '}
            <span className="font-bold text-[#07382B]">
              {facultyName ? `คณะ${facultyName}` : 'ยังไม่ได้ระบุคณะสังกัด'}
            </span>
          </p>
        </div>

        {facultyName && (
          <CourseFormModal mode="create" facultyName={facultyName} departments={departments} existingCourses={snapshots} />
        )}
      </div>

      <div className="space-y-4">
        {!facultyName ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-amber-200 bg-amber-50/30 text-amber-800 text-xs">
            บัญชีผู้ใช้นี้ยังไม่ได้ผูกกับคณะสังกัด กรุณาให้ผู้ดูแลระบบกำหนดคณะให้บัญชีนี้ก่อน
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            ยังไม่มีรายการหลักสูตรที่เปิดรับสมัครในคณะ{facultyName}
          </div>
        ) : (
          courses.map((course) => {
            const totalApps = course.applications.length
            const passedApps = course.applications.filter(
              (a) => a.status === 'PASSED' || a.status === 'CONFIRMED'
            ).length

            const criteriaList = [
              // เกรดเฉลี่ยขั้นต่ำ (GPA)
              course.minGpax ? `GPAX ขั้นต่ำ: ${Number(course.minGpax).toFixed(2)}` : null,
              course.minMathGpa ? `GPA คณิต: ${Number(course.minMathGpa).toFixed(2)}` : null,
              course.minSciGpa ? `GPA วิทย์: ${Number(course.minSciGpa).toFixed(2)}` : null,
              course.minEngGpa ? `GPA อังกฤษ: ${Number(course.minEngGpa).toFixed(2)}` : null,
              course.minThaiGpa ? `GPA ไทย: ${Number(course.minThaiGpa).toFixed(2)}` : null,
              course.minSocialGpa ? `GPA สังคม: ${Number(course.minSocialGpa).toFixed(2)}` : null,
              course.minHealthGpa ? `GPA สุขศึกษา: ${Number(course.minHealthGpa).toFixed(2)}` : null,
              course.minArtGpa ? `GPA ศิลปะ: ${Number(course.minArtGpa).toFixed(2)}` : null,
              course.minCareerGpa ? `GPA การงาน: ${Number(course.minCareerGpa).toFixed(2)}` : null,

              // คะแนนสอบ TGAT / TPAT
              course.minTgat ? `TGAT ขั้นต่ำ: ${Number(course.minTgat).toFixed(2)}` : null,
              course.minTpat1 ? `TPAT1: ${Number(course.minTpat1).toFixed(2)}` : null,
              course.minTpat2 ? `TPAT2: ${Number(course.minTpat2).toFixed(2)}` : null,
              course.minTpat3 ? `TPAT3: ${Number(course.minTpat3).toFixed(2)}` : null,
              course.minTpat4 ? `TPAT4: ${Number(course.minTpat4).toFixed(2)}` : null,
              course.minTpat5 ? `TPAT5: ${Number(course.minTpat5).toFixed(2)}` : null,

              // คะแนนสอบ A-Level
              course.minAlevelMath1 ? `A-Level คณิต 1: ${Number(course.minAlevelMath1).toFixed(2)}` : null,
              course.minAlevelMath2 ? `A-Level คณิต 2: ${Number(course.minAlevelMath2).toFixed(2)}` : null,
              course.minAlevelSci ? `A-Level วิทย์ทั่วไป: ${Number(course.minAlevelSci).toFixed(2)}` : null,
              course.minAlevelPhy ? `A-Level ฟิสิกส์: ${Number(course.minAlevelPhy).toFixed(2)}` : null,
              course.minAlevelChem ? `A-Level เคมี: ${Number(course.minAlevelChem).toFixed(2)}` : null,
              course.minAlevelBio ? `A-Level ชีวะ: ${Number(course.minAlevelBio).toFixed(2)}` : null,
              course.minAlevelSoc ? `A-Level สังคม: ${Number(course.minAlevelSoc).toFixed(2)}` : null,
              course.minAlevelThai ? `A-Level ภาษาไทย: ${Number(course.minAlevelThai).toFixed(2)}` : null,
              course.minAlevelEng ? `A-Level อังกฤษ: ${Number(course.minAlevelEng).toFixed(2)}` : null,
              course.minAlevelForeign
                ? `A-Level ต่างประเทศ${course.foreignLanguageSubject ? ` (${course.foreignLanguageSubject})` : ''}: ${Number(course.minAlevelForeign).toFixed(2)}`
                : null,
            ].filter(Boolean)

            return (
              <div
                key={course.Program_Criteriaid}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded-lg">
                        {course.Program_Criteriaid}
                      </span>
                      <h2 className="text-base font-bold text-slate-900">{course.programName}</h2>
                      {passedApps >= course.capacity ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          เต็มแล้ว
                        </span>
                      ) : course.isOpen ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          เปิดรับสมัคร
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          ปิดรับสมัคร
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {course.university.faculty}{' '}
                      <span className="font-bold text-slate-700">{course.university.department}</span> ({course.university.campus})
                    </p>
                  </div>

                  <div className="text-right text-xs">
                    <p className="text-slate-400 text-[11px]">คัดเลือกผ่านแล้ว / รับทั้งหมด</p>
                    <p className="font-bold text-[#07382B] text-sm">
                      {passedApps} / {course.capacity}{' '}
                      <span className="text-xs text-slate-500 font-normal">(สมัครรวม {totalApps} คน)</span>
                    </p>
                    <div className="flex justify-end gap-2 mt-2">
                      <CourseFormModal
                        mode="edit"
                        facultyName={facultyName}
                        departments={departments}
                        existingCourses={snapshots}
                        initial={snapshots.find((x) => x.id === course.Program_Criteriaid)}
                      />
                      <DeleteCourseButton
                        courseId={course.Program_Criteriaid}
                        programName={course.programName}
                        applicants={totalApps}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">เกณฑ์คุณสมบัติขั้นต่ำที่ต้องผ่าน:</p>
                  <div className="flex flex-wrap gap-2">
                    {criteriaList.length > 0 ? (
                      criteriaList.map((crit, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium"
                        >
                          {crit}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">ไม่มีเกณฑ์คะแนนขั้นต่ำ</span>
                    )}
                  </div>

                  {course.additionals && (
                    <div className="mt-2 p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                      <strong>เงื่อนไขเพิ่มเติม:</strong> {course.additionals}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}