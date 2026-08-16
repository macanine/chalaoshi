import TeacherSearch from '@/components/TeacherSearch';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;

  return (
    <>
      <section className="hero">
        <h1>浙江大学 · 匿名教评</h1>
      </section>
      <TeacherSearch initialQ={q} />
    </>
  );
}
