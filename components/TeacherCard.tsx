import type { TeacherHit } from '@/lib/types';
import ScoreBadge from './ScoreBadge';

export default function TeacherCard({ teacher }: { teacher: TeacherHit }) {
  return (
    <a className="teacher-card" href={`/teacher/${teacher.tid}`}>
      <div>
        <div className="teacher-card-name">{teacher.name}</div>
        <div className="teacher-card-college">{teacher.college || '—'}</div>
      </div>
      <ScoreBadge score={teacher.score} />
    </a>
  );
}
