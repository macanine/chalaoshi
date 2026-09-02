import TeacherSearch from '@/components/TeacherSearch';
import ZjuLogo from '@/components/ZjuLogo';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;

  return (
    <>
      <section className="hero">
        <div className="hero-title">
          <ZjuLogo className="hero-zju-logo" />
          <h1 className="hero-brand">查老师</h1>
        </div>
      </section>
      <TeacherSearch initialQ={q} />
    </>
  );
}
