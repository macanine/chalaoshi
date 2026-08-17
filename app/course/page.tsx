import type { Metadata } from 'next';
import CourseSearch from '@/components/CourseSearch';

export const metadata: Metadata = { title: '查课程绩点' };

export default async function CoursePage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course = '' } = await searchParams;

  return (
    <>
      <section className="hero">
        <h1>课程绩点对比</h1>
      </section>
      <CourseSearch initialCourse={course} />
    </>
  );
}
