import type { Metadata } from 'next';
import ApiDocsClient from '@/components/ApiDocsClient';
import './docs.css';

export const metadata: Metadata = { title: 'API' };

/** 表格行: [参数名, 类型, 说明] */
function ParamTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="table-wrap">
      <table className="docs-params">
        <thead>
          <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, type, desc]) => (
            <tr key={name}>
              <td>
                <code className="inline-code">{name}</code>
              </td>
              <td className="param-type">{type}</td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({
  path,
  desc,
  params,
  exampleUrl,
}: {
  path: string;
  desc: string;
  params?: [string, string, string][];
  exampleUrl?: string;
}) {
  return (
    <article className="doc-endpoint">
      <div className="doc-ep-head">
        <span className="doc-method">GET</span>
        <code className="doc-path">{path}</code>
        {exampleUrl && (
          <a className="doc-try" href={exampleUrl} target="_blank" rel="noreferrer">
            试一下 ↗
          </a>
        )}
      </div>
      <p className="doc-ep-desc">{desc}</p>
      {params && (
        <>
          <h4>请求参数</h4>
          <ParamTable rows={params} />
        </>
      )}
    </article>
  );
}

export default function ApiDocsPage() {
  return (
    <article className="docs">
      <header className="docs-head">
        <h1>API</h1>
        <p>代理自 chalaoshi.de 的浙大老师教评数据接口, 全部 GET, 无需鉴权。</p>
      </header>

      <ApiDocsClient />

      <section className="docs-section">
        <h2>端点</h2>

        <Endpoint
          path="/api/search?q=<名字或拼音>"
          desc="按姓名或拼音搜索老师, 返回候选列表(支持模糊匹配)。"
          params={[['q', 'string(必填)', '老师姓名或拼音, 如 陈建海 / chenjianhai']]}
          exampleUrl="/api/search?q=陈建海"
        />

        <Endpoint
          path="/api/teacher/<tid>"
          desc="老师详情: 综合评分、参与打分人数、点名率、评论数, 以及各门课的历史平均绩点。"
          params={[['tid', 'string(必填)', '老师数字 ID, 来自搜索结果的 tid']]}
          exampleUrl="/api/teacher/1902"
        />

        <Endpoint
          path="/api/comments/<tid>?sort=time|rate&limit=20&offset=0"
          desc="评论列表, 支持分页与排序。sort=time 最新在前, sort=rate 赞最多在前; 响应含 total / hasMore 便于分页。"
          params={[
            ['tid', 'string(必填)', '老师数字 ID'],
            ['sort', 'time | rate', '排序方式, 默认 time'],
            ['limit', 'number', '每页条数, 1–100, 默认 20'],
            ['offset', 'number', '偏移量, 默认 0'],
          ]}
          exampleUrl="/api/comments/1902?sort=time&limit=20"
        />

        <Endpoint
          path="/api/gpa?course=<课程名>"
          desc="列出该课所有任课老师的平均绩点(±标准差)与上报人数, 按绩点排序。数据来自「课否」。"
          params={[['course', 'string(必填)', '课程名, 支持模糊匹配']]}
          exampleUrl="/api/gpa?course=程序设计基础及实验"
        />

        <Endpoint
          path="/api/health[?probe=1]"
          desc="代理存活检查。加 probe=1 时真实探测上游 chalaoshi.de 是否可访问。"
          exampleUrl="/api/health"
        />
      </section>
    </article>
  );
}
