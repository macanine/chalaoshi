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
        <p className="subtitle">按名字或拼音查老师评分、点名率、评论, 或查一门课所有老师的绩点对比。</p>
      </section>
      <TeacherSearch initialQ={q} />
    </>
  );
}
