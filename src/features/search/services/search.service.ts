import { prisma } from '@/db/prisma/client';

type SearchCategory = 'students' | 'teachers' | 'courses' | 'exams';

export interface NormalizedSearchResult {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string | null;
  meta: string | null;
  href: string;
  matchScore: number;
}

const computeScore = (matchTitle: boolean, matchSub: boolean): number => {
  if (matchTitle && matchSub) return 0.98;
  if (matchTitle) return 0.92;
  if (matchSub) return 0.68;
  return 0.5;
};

export class SearchService {
  static async globalSearch(q: string, page = 1, limit = 20) {
    const query = q.trim();
    const normalized = query.toLowerCase();

    const [students, teachers, courses, exams] = await Promise.all([
      prisma.student.findMany({
        take: limit,
        skip: (page - 1) * limit,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          batch: { select: { name: true } },
          department: { select: { name: true } },
        },
      }),
      prisma.teacher.findMany({
        take: limit,
        skip: (page - 1) * limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.course.findMany({
        take: limit,
        skip: (page - 1) * limit,
        include: { _count: { select: { enrollments: true } } },
      }),
      prisma.exam.findMany({
        take: limit,
        skip: (page - 1) * limit,
        where: { deletedAt: null },
        include: { course: { select: { title: true, code: true } } },
      }),
    ]);

    const results: NormalizedSearchResult[] = [];

    students.forEach((s) => {
      const name = [s.user?.firstName, s.user?.lastName].filter(Boolean).join(' ') || 'Unknown Student';
      const matchName = name.toLowerCase().includes(normalized);
      const matchId = (s.studentId || '').toLowerCase().includes(normalized);
      const matchEmail = (s.user?.email || '').toLowerCase().includes(normalized);
      const matchBatch = (s.batch?.name || '').toLowerCase().includes(normalized);
      const score = computeScore(matchName || matchId, matchEmail || matchBatch);
      if (!(matchName || matchId || matchEmail || matchBatch) && normalized) return;
      results.push({
        id: s.id,
        category: 'students',
        title: name,
        subtitle: s.studentId ? `Student ID: ${s.studentId}` : s.user?.email || null,
        meta: [
          s.batch?.name ? `Batch: ${s.batch.name}` : null,
          s.isActive === false ? 'Inactive' : null,
        ]
          .filter(Boolean)
          .join(' • ') || null,
        href: `/students/${s.id}`,
        matchScore: score,
      });
    });

    teachers.forEach((t) => {
      const name = [t.user?.firstName, t.user?.lastName].filter(Boolean).join(' ') || 'Unknown Teacher';
      const matchName = name.toLowerCase().includes(normalized);
      const matchEmpId = (t.employeeId || '').toLowerCase().includes(normalized);
      const matchEmail = (t.user?.email || '').toLowerCase().includes(normalized);
      const matchSpec = (t.specialization || '').toLowerCase().includes(normalized);
      const score = computeScore(matchName || matchEmpId, matchEmail || matchSpec);
      if (!(matchName || matchEmpId || matchEmail || matchSpec) && normalized) return;
      results.push({
        id: t.id,
        category: 'teachers',
        title: name,
        subtitle: t.user?.email ? `Email: ${t.user.email}` : t.employeeId ? `Employee ID: ${t.employeeId}` : null,
        meta: t.specialization ? `Specialization: ${t.specialization}` : null,
        href: `/teachers/${t.id}`,
        matchScore: score,
      });
    });

    courses.forEach((c) => {
      const matchTitle = (c.title || '').toLowerCase().includes(normalized);
      const matchCode = (c.code || '').toLowerCase().includes(normalized);
      const matchDesc = (c.description || '').toLowerCase().includes(normalized);
      const score = computeScore(matchTitle || matchCode, matchDesc);
      if (!(matchTitle || matchCode || matchDesc) && normalized) return;
      results.push({
        id: c.id,
        category: 'courses',
        title: c.code ? `${c.title} (${c.code})` : c.title || 'Untitled Course',
        subtitle: c.credits ? `${c.credits} Credits${c.durationWeeks ? ` • ${c.durationWeeks} Weeks` : ''}` : null,
        meta: [
          c._count?.enrollments ? `Enrolled: ${c._count.enrollments}` : null,
          c.difficultyLevel ? `Level: ${c.difficultyLevel}` : null,
        ]
          .filter(Boolean)
          .join(' • ') || null,
        href: `/courses/${c.id}`,
        matchScore: score,
      });
    });

    exams.forEach((e) => {
      const matchTitle = (e.title || '').toLowerCase().includes(normalized);
      const matchCourse = (e.course?.title || e.course?.code || '').toLowerCase().includes(normalized);
      const score = computeScore(matchTitle, matchCourse);
      if (!(matchTitle || matchCourse) && normalized) return;
      const scheduleParts: string[] = [];
      if (e.startDate) scheduleParts.push(`Start: ${new Date(e.startDate).toLocaleDateString()}`);
      if (e.durationMinutes) scheduleParts.push(`Duration: ${e.durationMinutes} min`);
      results.push({
        id: e.id,
        category: 'exams',
        title: e.title || 'Untitled Exam',
        subtitle: e.course?.code || e.course?.title || null,
        meta: [e.course?.title ? `Course: ${e.course.title}` : null, scheduleParts.join(' • ') || null]
          .filter(Boolean)
          .join(' • ') || null,
        href: `/exams/${e.id}`,
        matchScore: score,
      });
    });

    results.sort((a, b) => b.matchScore - a.matchScore);
    const total = results.length;

    return { results, total, page, limit };
  }
}

export default SearchService;
