import type { Metadata } from 'next';
import CourseSearch from '@/components/CourseSearch';
import ZjuLogo from '@/components/ZjuLogo';

export const metadata: Metadata = { title: '查绩点' };

export default async function CoursePage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course = '' } = await searchParams;

  return (
    <>
      <section className="hero">
        <div className="hero-title">
          <ZjuLogo className="hero-zju-logo" />
          <h1 className="hero-brand">查绩点</h1>
        </div>
      </section>
      <CourseSearch initialCourse={course} />
    </>
  );
}
