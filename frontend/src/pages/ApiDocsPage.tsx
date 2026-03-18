import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Ico } from '../components/icons/Ico';

// ─── Data model ───────────────────────────────────────────────────────────────
interface Field {
  name: string;
  type: string;
  required: boolean;
  desc: string;
  example?: string;
}

interface ResponseEx {
  status: number;
  label: string;
  body: string;
}

interface Endpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  tag: string;
  summary: string;
  description: string;
  auth: boolean;
  fields: Field[];
  responses: ResponseEx[];
  curl: string;
  tryable: boolean;
}

// ─── API Spec ─────────────────────────────────────────────────────────────────
const ENDPOINTS: Endpoint[] = [
  {
    id: 'health',
    method: 'GET',
    path: '/health',
    tag: 'System',
    summary: 'Health Check',
    description: 'Kiểm tra trạng thái API server và Gotenberg PDF engine. Không cần auth.',
    auth: false,
    fields: [],
    responses: [
      { status: 200, label: 'OK', body: JSON.stringify({ status: 'ok', gotenberg: 'ok', timestamp: '2025-01-15T10:00:00.000Z' }, null, 2) },
    ],
    curl: `curl http://localhost:8080/health`,
    tryable: true,
  },
  {
    id: 'render',
    method: 'POST',
    path: '/api/render',
    tag: 'Render',
    summary: 'Render DOCX → PDF',
    description: 'Upload file .docx template với {placeholder} syntax, inject JSON data, nhận lại file PDF binary.\n\nCũng hỗ trợ convert HTML string hoặc URL → PDF trực tiếp (không cần template).\n\nImage placeholder dùng cú pháp {%imageKey} — upload ảnh cùng tên field, bất kỳ format nào Sharp hỗ trợ.',
    auth: true,
    fields: [
      { name: 'template', type: 'file (.docx)', required: true, desc: 'File template DOCX với {placeholder} hoặc {%imageKey}', example: 'contract.docx' },
      { name: 'data',     type: 'JSON string', required: true, desc: 'Object chứa giá trị cho các placeholder. Có thể thêm imageOptions để cấu hình kích thước ảnh.', example: '{"name":"Nguyen Van A","amount":"5,000,000","imageOptions":{"signature":{"width":180,"height":60}}}' },
      { name: 'html',     type: 'string', required: false, desc: 'HTML string → bỏ qua template, convert HTML sang PDF trực tiếp', example: '<h1>Hello {name}</h1>' },
      { name: 'url',      type: 'string', required: false, desc: 'URL → convert webpage sang PDF', example: 'https://example.com' },
      { name: '[imageKey]', type: 'file (image)', required: false, desc: 'Ảnh khớp với {%imageKey} trong template. VD: field "signature" → placeholder {%signature}. Hỗ trợ JPG, PNG, WebP, v.v.' },
    ],
    responses: [
      { status: 200, label: 'PDF binary', body: '< binary PDF data >\nContent-Type: application/pdf\nContent-Disposition: attachment; filename="document.pdf"' },
      { status: 400, label: 'Bad Request', body: JSON.stringify({ error: 'No template file provided' }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'Missing or invalid Authorization header' }, null, 2) },
      { status: 500, label: 'Render Error', body: JSON.stringify({ error: 'Gotenberg conversion failed: ...' }, null, 2) },
    ],
    curl: `curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@contract.docx" \\
  -F 'data={"name":"Nguyen Van A","date":"15/01/2025","amount":"12,000,000"}' \\
  --output contract_filled.pdf`,
    tryable: false,
  },
  {
    id: 'preview',
    method: 'POST',
    path: '/api/preview',
    tag: 'Render',
    summary: 'Preview → Base64 PDF',
    description: 'Giống /render nhưng trả về base64-encoded PDF trong JSON. Dùng để preview trong browser mà không cần download file.\n\nHỗ trợ tất cả tính năng giống /render: image placeholders, imageOptions, HTML, URL.',
    auth: true,
    fields: [
      { name: 'template', type: 'file (.docx)', required: true, desc: 'File template DOCX', example: 'invoice.docx' },
      { name: 'data',     type: 'JSON string', required: true, desc: 'Placeholder values + optional imageOptions', example: '{"customer":"Tran Thi B","total":"14,850,000"}' },
      { name: '[imageKey]', type: 'file (image)', required: false, desc: 'Ảnh khớp với {%imageKey} trong template' },
    ],
    responses: [
      { status: 200, label: 'Base64 PDF', body: JSON.stringify({ success: true, pdf: 'JVBERi0xLjQK...', size: 48392 }, null, 2) },
      { status: 400, label: 'Bad Request', body: JSON.stringify({ error: 'No template file provided' }, null, 2) },
    ],
    curl: `curl -X POST http://localhost:8080/api/preview \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@invoice.docx" \\
  -F 'data={"customer":"Tran Thi B","total":"14,850,000"}'`,
    tryable: false,
  },
  {
    id: 'analyze',
    method: 'POST',
    path: '/api/analyze',
    tag: 'Template',
    summary: 'Analyze Template Placeholders',
    description: 'Quét file .docx và trả về danh sách tất cả placeholder tìm thấy.\n\nText placeholder trả về dạng "name", image placeholder trả về dạng "%signature" (có prefix %).\n\nHữu ích để validate template trước khi render hoặc build dynamic form từ template.',
    auth: true,
    fields: [
      { name: 'template', type: 'file (.docx)', required: true, desc: 'File template cần analyze', example: 'report.docx' },
    ],
    responses: [
      { status: 200, label: 'Placeholder list', body: JSON.stringify({ placeholders: ['ho_ten', 'email', 'ngay_ky', '%signature', 'items', 'tong_tien'] }, null, 2) },
      { status: 400, label: 'No file', body: JSON.stringify({ error: 'No template file provided' }, null, 2) },
    ],
    curl: `curl -X POST http://localhost:8080/api/analyze \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@report.docx"`,
    tryable: false,
  },
  {
    id: 'combine',
    method: 'POST',
    path: '/api/combine',
    tag: 'Combine',
    summary: 'Combine Files → PDF',
    description: 'Gộp nhiều file thuộc nhiều định dạng khác nhau thành một file PDF duy nhất.\n\nMỗi file non-PDF được convert trước rồi merge theo thứ tự upload. Có thể chỉ định thứ tự tùy chỉnh qua field "order".\n\n**Hỗ trợ:** PDF, DOCX, DOC, JPG, PNG, TIFF, BMP, GIF.\n\n**Giới hạn:** Tối đa 20 file, mỗi file tối đa 50MB.',
    auth: true,
    fields: [
      { name: 'files[]', type: 'file (multiple)', required: true, desc: 'Các file cần gộp. Upload theo thứ tự muốn merge. Hỗ trợ: pdf, docx, doc, jpg, png, tiff, bmp, gif' },
      { name: 'order',   type: 'JSON string', required: false, desc: 'Mảng tên file theo thứ tự muốn merge. File không có trong list được thêm vào cuối.', example: '["cover.pdf","body.docx","appendix.pdf"]' },
    ],
    responses: [
      { status: 200, label: 'Merged PDF', body: '< binary PDF data >\nContent-Type: application/pdf\nContent-Disposition: attachment; filename="combined.pdf"' },
      { status: 400, label: 'Bad Request', body: JSON.stringify({ error: 'No files uploaded' }, null, 2) },
      { status: 500, label: 'Combine Error', body: JSON.stringify({ error: 'PDF merge failed: ...' }, null, 2) },
    ],
    curl: `curl -X POST http://localhost:8080/api/combine \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "files[]=@cover.pdf" \\
  -F "files[]=@contract.docx" \\
  -F "files[]=@signature.jpg" \\
  -F 'order=["cover.pdf","contract.docx","signature.jpg"]' \\
  --output merged.pdf`,
    tryable: false,
  },
];

const TAGS = ['Tất cả', 'System', 'Render', 'Template', 'Combine'];

// ─── Method badge ─────────────────────────────────────────────────────────────
function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold tracking-wide
      ${method === 'GET' ? 'bg-blue-500/20 text-blue-400' : 'bg-lime-400/20 text-lime-400'}`}>
      {method}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: number }) {
  const color = status < 300 ? 'text-lime-400' : status < 400 ? 'text-amber-400' : status < 500 ? 'text-orange-400' : 'text-red-400';
  return <span className={`font-mono text-xs font-bold ${color}`}>{status}</span>;
}

// ─── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden group">
      {lang && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/40">
          <span className="text-xs font-mono text-zinc-600">{lang}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-xs font-mono text-zinc-600 hover:text-lime-400 transition-colors flex items-center gap-1"
          >
            {copied ? <><Ico.check /> copied!</> : 'copy'}
          </button>
        </div>
      )}
      <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

// ─── Try-it panel (health check) ─────────────────────────────────────────────
function TryHealthCheck({ apiBase }: { apiBase: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  const run = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${apiBase}/health`);
      const d = await r.json();
      setResult(JSON.stringify(d, null, 2));
      setOk(r.ok);
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setOk(false);
    }
    setLoading(false);
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-zinc-500">Base URL:</span>
        <code className="text-xs font-mono text-zinc-300 bg-zinc-800 px-2 py-1 rounded">{apiBase}/health</code>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-400 text-zinc-950 text-xs font-mono font-bold
            hover:bg-lime-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {loading ? <><span className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />Running…</> : '▶ Send Request'}
        </button>
      </div>
      {result && (
        <div className={`rounded-xl border overflow-hidden ${ok ? 'border-lime-500/30' : 'border-red-500/30'}`}>
          <div className={`flex items-center gap-2 px-4 py-2 text-xs font-mono ${ok ? 'bg-lime-500/5 text-lime-400' : 'bg-red-500/5 text-red-400'}`}>
            {ok ? '● 200 OK' : '● Error'}
          </div>
          <pre className="p-4 text-xs font-mono text-zinc-300 bg-zinc-950">{result}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Single endpoint card ─────────────────────────────────────────────────────
function EndpointCard({ ep, apiBase, apiKey }: { ep: Endpoint; apiBase: string; apiKey: string }) {
  const [open, setOpen] = useState(false);
  const [activeRes, setActiveRes] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={cardRef} id={ep.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden transition-all">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800/40 transition-colors text-left"
      >
        <MethodBadge method={ep.method} />
        <code className="font-mono text-sm text-white">{ep.path}</code>
        <span className="text-xs text-zinc-500 hidden md:block">{ep.summary}</span>
        {ep.auth && (
          <span className="ml-auto mr-2 flex items-center gap-1 text-xs text-zinc-600 font-mono flex-shrink-0">
            <Ico.key /> auth
          </span>
        )}
        <span className={`text-zinc-500 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-zinc-800 p-5 space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{ep.description}</p>
          </div>

          {/* Auth note */}
          {ep.auth && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 font-mono">
              <Ico.key />
              <span>Yêu cầu header: <strong>Authorization: Bearer &lt;api_key&gt;</strong></span>
            </div>
          )}

          {/* Request fields */}
          {ep.fields.length > 0 && (
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Request — multipart/form-data</p>
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-950/60 border-b border-zinc-800">
                      <th className="text-left px-4 py-2.5 font-mono text-zinc-600 font-normal">Field</th>
                      <th className="text-left px-4 py-2.5 font-mono text-zinc-600 font-normal">Type</th>
                      <th className="text-left px-4 py-2.5 font-mono text-zinc-600 font-normal">Req</th>
                      <th className="text-left px-4 py-2.5 font-mono text-zinc-600 font-normal">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {ep.fields.map(f => (
                      <tr key={f.name} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-lime-400 whitespace-nowrap">{f.name}</td>
                        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{f.type}</td>
                        <td className="px-4 py-3">
                          {f.required
                            ? <span className="text-rose-400 font-mono">✓</span>
                            : <span className="text-zinc-700 font-mono">—</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 leading-relaxed">
                          {f.desc}
                          {f.example && <code className="ml-2 text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{f.example}</code>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Two-column: responses + curl */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Responses */}
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Responses</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {ep.responses.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveRes(i)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all
                      ${activeRes === i ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <StatusBadge status={r.status} />
                    <span className="text-zinc-500">{r.label}</span>
                  </button>
                ))}
              </div>
              <CodeBlock code={ep.responses[activeRes].body} />
            </div>

            {/* cURL */}
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">cURL Example</p>
              <CodeBlock code={ep.curl} lang="bash" />
            </div>
          </div>

          {/* Try it (health only) */}
          {ep.tryable && (
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">Try It</p>
              <TryHealthCheck apiBase={apiBase} />
            </div>
          )}

          {/* Try render hint */}
          {!ep.tryable && ep.id !== 'health' && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-400">
              <Ico.zap />
              <span>Test endpoint này trực tiếp trong </span>
              <Link
                to={ep.id === 'combine' ? '/merge' : '/render'}
                className="text-lime-400 hover:text-lime-300 underline font-medium"
              >
                {ep.id === 'combine' ? 'Merge PDF' : 'Render'} →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ApiDocsPage() {
  const [tag, setTag] = useState('Tất cả');
  const [apiBase, setApiBase] = useState('http://localhost:8080');
  const [apiKey, setApiKey] = useState('flowpdf_dev_key');
  const [keyVisible, setKeyVisible] = useState(false);

  const filtered = tag === 'Tất cả' ? ENDPOINTS : ENDPOINTS.filter(e => e.tag === tag);

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80">
        <div className="max-w-[1300px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center shadow-[0_0_12px_rgba(163,230,53,0.4)]">
              <span className="text-zinc-950 font-bold text-xs font-mono">F</span>
            </div>
            <span className="font-bold text-white text-base tracking-tight">FlowPDF</span>
          </Link>
          <span className="text-zinc-700 hidden sm:block">/</span>
          <span className="text-sm text-zinc-400 font-mono hidden sm:block">API Reference</span>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/guide" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-all">
              📖 Hướng dẫn
            </Link>
            <Link to="/render" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-400 text-zinc-950 text-xs font-bold font-mono hover:bg-lime-300 transition-all">
              <Ico.zap /> Open App
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1300px] mx-auto w-full px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0" style={{ position: 'sticky', top: '80px', alignSelf: 'flex-start' }}>
          {/* Config panel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 mb-4 space-y-3">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Config</p>
            <div>
              <label className="text-xs text-zinc-600 font-mono block mb-1">Base URL</label>
              <input
                value={apiBase}
                onChange={e => setApiBase(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-mono text-white
                  focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-600 font-mono block mb-1">API Key</label>
              <div className="relative">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full px-2 py-1.5 pr-8 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-mono text-white
                    focus:outline-none focus:border-zinc-500 transition-colors"
                />
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Ico.eye />
                </button>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5">
            <p className="text-xs font-mono text-zinc-600 uppercase tracking-wider mb-2 px-2">Endpoints</p>
            {ENDPOINTS.map(ep => (
              <a
                key={ep.id}
                href={`#${ep.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-zinc-800/60 transition-colors group"
              >
                <MethodBadge method={ep.method} />
                <span className="font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">{ep.path.replace('/api', '')}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">FlowPDF API</h1>
              <span className="px-2 py-0.5 rounded-full border border-zinc-700 text-xs font-mono text-zinc-500">v1.0.0</span>
              <span className="px-2 py-0.5 rounded-full border border-lime-500/30 bg-lime-500/5 text-xs font-mono text-lime-400">OpenAPI 3.0</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
              DOCX Template → PDF rendering microservice. Upload template với <code className="text-lime-400 font-mono text-xs bg-zinc-800 px-1.5 py-0.5 rounded">{'{placeholder}'}</code> syntax,
              inject JSON data, nhận PDF binary. Hỗ trợ image embed, loop, conditional, nested data.
            </p>

            {/* Auth info */}
            <div className="mt-4 flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 max-w-2xl">
              <Ico.key />
              <div>
                <p className="text-xs font-mono text-amber-400 font-semibold mb-1">Authentication</p>
                <p className="text-xs text-zinc-400">
                  Tất cả endpoint (trừ <code className="font-mono text-xs text-zinc-300">/health</code>) yêu cầu header:
                </p>
                <code className="text-xs font-mono text-amber-300 mt-1 block">Authorization: Bearer {'<API_KEY>'}</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Đặt <code className="font-mono text-xs">FLOWPDF_API_KEY</code> trong <code className="font-mono text-xs">docker-compose.yml</code>.
                  Default dev key: <code className="font-mono text-xs text-zinc-300">flowpdf_dev_key</code>
                </p>
              </div>
            </div>
          </div>

          {/* Tag filter */}
          <div className="flex items-center gap-1.5 mb-5 flex-wrap">
            {TAGS.map(t => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all
                  ${tag === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'}`}
              >
                {t}
                {t !== 'Tất cả' && (
                  <span className="ml-1.5 text-zinc-600">
                    {ENDPOINTS.filter(e => e.tag === t).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Endpoint list */}
          <div className="space-y-3">
            {filtered.map(ep => (
              <EndpointCard key={ep.id} ep={ep} apiBase={apiBase} apiKey={apiKey} />
            ))}
          </div>

          {/* Template syntax quick ref */}
          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Template Syntax — Docxtemplater</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Viết trực tiếp trong file .docx. Xem <Link to="/guide" className="text-lime-400 hover:underline">Hướng dẫn đầy đủ →</Link></p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { tag: '{field}',              color: 'lime',   desc: 'Text field — thay thế bằng string/number trong JSON' },
                { tag: '{%imageKey}',           color: 'blue',   desc: 'Image — upload file cùng tên field trong multipart' },
                { tag: '{#array}…{/array}',     color: 'purple', desc: 'Loop — lặp qua mảng. Bên trong dùng {field} của từng phần tử' },
                { tag: '{#flag}…{/flag}',       color: 'amber',  desc: 'If — hiện nội dung khi flag là truthy (true, string, array không rỗng)' },
                { tag: '{^flag}…{/flag}',       color: 'rose',   desc: 'Else — hiện nội dung khi flag là falsy (false, null, "", [])' },
                { tag: '{#items}row{/items}',   color: 'cyan',   desc: 'Table loop — {#items} và {/items} phải là row riêng biệt, merge cells' },
              ].map(({ tag: t, color, desc }) => {
                const c: Record<string, string> = {
                  lime: 'bg-lime-400/10 text-lime-400 border-lime-400/20',
                  blue: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
                  purple: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
                  amber: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
                  rose: 'bg-rose-400/10 text-rose-400 border-rose-400/20',
                  cyan: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
                };
                return (
                  <div key={t} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                    <code className={`px-2 py-1 rounded-lg border text-xs font-mono flex-shrink-0 whitespace-nowrap ${c[color]}`}>{t}</code>
                    <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error codes */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">HTTP Status Codes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-zinc-800/40">
                  {[
                    { s: 200, c: 'lime',   l: 'OK',            d: 'Request thành công. Trả về PDF binary hoặc JSON.' },
                    { s: 400, c: 'orange', l: 'Bad Request',    d: 'Thiếu file, JSON không hợp lệ, placeholder không tìm thấy trong template.' },
                    { s: 401, c: 'rose',   l: 'Unauthorized',   d: 'Thiếu header Authorization hoặc format không đúng.' },
                    { s: 403, c: 'rose',   l: 'Forbidden',      d: 'API key không hợp lệ.' },
                    { s: 500, c: 'red',    l: 'Server Error',   d: 'Lỗi render (Gotenberg), lỗi LibreOffice, hoặc lỗi server nội bộ.' },
                  ].map(({ s, c, l, d }) => {
                    const cc: Record<string, string> = { lime: 'text-lime-400', orange: 'text-orange-400', rose: 'text-rose-400', red: 'text-red-400' };
                    return (
                      <tr key={s} className="hover:bg-zinc-800/20">
                        <td className={`px-5 py-3 font-mono font-bold w-16 ${cc[c]}`}>{s}</td>
                        <td className="px-4 py-3 text-zinc-400 font-mono w-32">{l}</td>
                        <td className="px-4 py-3 text-zinc-500">{d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-600 font-mono">
            <span>FlowPDF API v1.0.0 · OpenAPI 3.0</span>
            <div className="flex items-center gap-4">
              <Link to="/guide" className="hover:text-zinc-400 transition-colors">Hướng dẫn</Link>
              <a href="https://docxtemplater.com/docs/" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">
                docxtemplater docs ↗
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
