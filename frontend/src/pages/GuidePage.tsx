import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ico } from '../components/icons/Ico';

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = 'quickstart' | 'syntax' | 'tables' | 'conditions' | 'loops' | 'images' | 'api' | 'samples';

interface SyntaxItem {
  tag: string;
  color: string;
  label: string;
  desc: string;
  example: string;
  data?: string;
  result?: string;
}

// ─── Code Block ───────────────────────────────────────────────────────────────
function Code({ children, lang = '' }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
      {lang && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <span className="text-xs font-mono text-zinc-600">{lang}</span>
          <button
            onClick={copy}
            className="text-xs font-mono text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {copied ? <><Ico.check /> copied!</> : 'copy'}
          </button>
        </div>
      )}
      <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-zinc-300 whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mt-10 mb-4 flex items-center gap-2">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-zinc-200 mt-6 mb-3">{children}</h3>;
}

// ─── Callout ──────────────────────────────────────────────────────────────────
function Note({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' | 'tip' }) {
  const styles = {
    info: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    warn: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
    tip:  'border-lime-500/30 bg-lime-500/5 text-lime-300',
  };
  const icons = { info: 'ℹ', warn: '⚠️', tip: '💡' };
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed flex gap-3 my-4 ${styles[type]}`}>
      <span className="flex-shrink-0 text-base">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function Tag({ children, color = 'lime' }: { children: string; color?: string }) {
  const c: Record<string, string> = {
    lime:   'bg-lime-400/10 text-lime-400 border-lime-400/20',
    blue:   'bg-blue-400/10 text-blue-400 border-blue-400/20',
    purple: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
    amber:  'bg-amber-400/10 text-amber-400 border-amber-400/20',
    rose:   'bg-rose-400/10 text-rose-400 border-rose-400/20',
    cyan:   'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  };
  return (
    <code className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-mono ${c[color] ?? c.lime}`}>
      {children}
    </code>
  );
}

// ─── Sample download card ─────────────────────────────────────────────────────
function SampleCard({ title, desc, docx, json, color }: {
  title: string; desc: string; docx: string; json: string; color: string;
}) {
  const bg: Record<string, string> = {
    lime: 'border-lime-400/20 hover:border-lime-400/40',
    blue: 'border-blue-400/20 hover:border-blue-400/40',
    purple: 'border-purple-400/20 hover:border-purple-400/40',
  };
  const iconBg: Record<string, string> = {
    lime: 'bg-lime-400/10 text-lime-400',
    blue: 'bg-blue-400/10 text-blue-400',
    purple: 'bg-purple-400/10 text-purple-400',
  };
  return (
    <div className={`rounded-2xl border bg-zinc-900/60 p-5 flex flex-col gap-4 transition-all ${bg[color] ?? bg.lime}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${iconBg[color]}`}>
          📄
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <a
          href={`/templates/${docx}`}
          download
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-mono py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-all"
        >
          ⬇ template.docx
        </a>
        <a
          href={`/templates/${json}`}
          download
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-mono py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-all"
        >
          ⬇ data.json
        </a>
      </div>
    </div>
  );
}

// ─── Sidebar nav ─────────────────────────────────────────────────────────────
const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'quickstart',  label: 'Bắt đầu nhanh',      icon: '🚀' },
  { id: 'syntax',      label: 'Cú pháp cơ bản',      icon: '{}' },
  { id: 'conditions',  label: 'Điều kiện if/else',   icon: '?' },
  { id: 'loops',       label: 'Vòng lặp & mảng',     icon: '↺' },
  { id: 'tables',      label: 'Bảng (Table)',         icon: '⊞' },
  { id: 'images',      label: 'Chèn hình ảnh',        icon: '🖼' },
  { id: 'api',         label: 'API Reference',        icon: '⚡' },
  { id: 'samples',     label: 'Template mẫu',         icon: '📁' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function GuidePage() {
  const [active, setActive] = useState<Section>('quickstart');

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center shadow-[0_0_12px_rgba(163,230,53,0.4)]">
              <span className="text-zinc-950 font-bold text-xs font-mono">F</span>
            </div>
            <span className="font-bold text-white text-base tracking-tight">FlowPDF</span>
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 font-mono">Hướng dẫn sử dụng</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/render"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-400 text-zinc-950 text-xs font-bold font-mono hover:bg-lime-300 transition-all">
              <Ico.zap /> Mở App
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full px-6 py-8 gap-8">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 sticky top-22" style={{ alignSelf: 'flex-start', top: '80px' }}>
          <nav className="flex flex-col gap-0.5">
            <p className="text-xs font-mono text-zinc-600 uppercase tracking-wider mb-3 px-3">Nội dung</p>
            {NAV.map(n => (
              <button
                key={n.id}
                onClick={() => setActive(n.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left w-full
                  ${active === n.id
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <p className="text-xs text-zinc-500 font-mono mb-2">Template engine</p>
            <a href="https://docxtemplater.com/docs/" target="_blank" rel="noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline">
              docxtemplater docs →
            </a>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">

          {/* ── QUICKSTART ─────────────────────────────────────────────────── */}
          {active === 'quickstart' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Bắt đầu nhanh</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                FlowPDF nhận file <Tag color="lime">.docx</Tag> có placeholder, inject JSON data, và trả về PDF.
                Chỉ cần 3 bước.
              </p>

              <H2>⚡ 3 bước cơ bản</H2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                  { step:'01', title:'Tạo template .docx', desc:'Mở Word hoặc LibreOffice. Viết {ten_khach} ở chỗ nào bạn muốn điền dữ liệu. Lưu lại dạng .docx.' },
                  { step:'02', title:'Chuẩn bị data JSON', desc:'Tạo file JSON với các key tương ứng: {"ten_khach": "Nguyen Van A"}. Key phải khớp chính xác với tên placeholder.' },
                  { step:'03', title:'Gọi API hoặc dùng UI', desc:'Upload template + nhập JSON vào tab Render. Nhấn Generate PDF. Hoặc dùng cURL/API trong code.' },
                ].map(s => (
                  <div key={s.step} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-xs text-zinc-500 font-bold mb-3">{s.step}</div>
                    <p className="text-sm font-semibold text-white mb-2">{s.title}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>

              <H2>📝 Template đơn giản nhất</H2>
              <p className="text-sm text-zinc-400 mb-3">Nội dung file <code className="text-lime-400 font-mono text-xs">contract.docx</code>:</p>
              <Code lang="template.docx">{`Kính gửi: {ten_khach}

Công ty {ten_cong_ty} trân trọng thông báo hợp đồng số {so_hop_dong}.
Ngày ký: {ngay_ky}
Giá trị: {gia_tri} VNĐ

Trân trọng,
{nguoi_ky}`}</Code>

              <H3>Data JSON tương ứng</H3>
              <Code lang="data.json">{`{
  "ten_khach":   "Nguyen Van A",
  "ten_cong_ty": "FlowPDF Technology",
  "so_hop_dong": "HD-2025-001",
  "ngay_ky":     "15/01/2025",
  "gia_tri":     "12,000,000",
  "nguoi_ky":    "Le Van Director"
}`}</Code>

              <H3>Gọi API bằng cURL</H3>
              <Code lang="bash">{`curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@contract.docx" \\
  -F 'data={"ten_khach":"Nguyen Van A","ten_cong_ty":"FlowPDF Technology","so_hop_dong":"HD-2025-001","ngay_ky":"15/01/2025","gia_tri":"12,000,000","nguoi_ky":"Le Van Director"}' \\
  --output contract_filled.pdf`}</Code>

              <Note type="tip">
                Dùng tab <strong>Render</strong> trong app để test nhanh không cần cURL — upload file, điền JSON, nhấn Generate PDF.
              </Note>

              <H2>🔑 Quy tắc đặt tên placeholder</H2>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60">
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Loại</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Cú pháp</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {[
                      [<Tag color="lime">{'{field}'}</Tag>,     'Text field', 'Thay thế bằng giá trị string/number trong JSON'],
                      [<Tag color="blue">{'{%image}'}</Tag>,    'Image',      'Chèn ảnh — upload file cùng tên field'],
                      [<Tag color="purple">{'{#arr}…{/arr}'}</Tag>, 'Loop', 'Lặp qua mảng trong JSON'],
                      [<Tag color="amber">{'{#flag}…{/flag}'}</Tag>, 'If', 'Hiện nội dung nếu flag = true'],
                      [<Tag color="rose">{'{^flag}…{/flag}'}</Tag>, 'Else', 'Hiện nếu flag = false / undefined'],
                    ].map(([tag, type, desc], i) => (
                      <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-3">{tag}</td>
                        <td className="px-4 py-3 text-xs font-mono text-zinc-400">{type as string}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{desc as string}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SYNTAX ─────────────────────────────────────────────────────── */}
          {active === 'syntax' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Cú pháp cơ bản</h1>
              <p className="text-zinc-400 mb-8">FlowPDF dùng <a href="https://docxtemplater.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">docxtemplater</a> làm engine. Các tag được viết trực tiếp trong file .docx.</p>

              <H2>Text Field — <Tag color="lime">{'{key}'}</Tag></H2>
              <p className="text-sm text-zinc-400 mb-3">Placeholder đơn giản nhất. Key trong <code className="text-lime-400 font-mono text-xs">{}</code> phải khớp với key trong JSON.</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-zinc-600 font-mono mb-2">template.docx</p>
                  <Code>{`Tên: {ho_ten}
Email: {email}
Điện thoại: {dien_thoai}
Ngày sinh: {ngay_sinh}`}</Code>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 font-mono mb-2">data.json</p>
                  <Code lang="json">{`{
  "ho_ten":     "Nguyen Thi Lan",
  "email":      "lan@email.com",
  "dien_thoai": "0901234567",
  "ngay_sinh":  "01/01/1995"
}`}</Code>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-1 font-mono">Kết quả:</p>
              <Code>{`Tên: Nguyen Thi Lan
Email: lan@email.com
Điện thoại: 0901234567
Ngày sinh: 01/01/1995`}</Code>

              <Note type="info">
                Placeholder <strong>case-sensitive</strong> — <code className="font-mono text-xs">{'{HoTen}'}</code> khác với <code className="font-mono text-xs">{'{hoTen}'}</code>. Nên dùng snake_case nhất quán.
              </Note>

              <H2>Số và Format</H2>
              <p className="text-sm text-zinc-400 mb-3">FlowPDF không tự format số. Hãy format trong JSON trước khi gửi.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-2">❌ Không nên — số thô</p>
                  <Code lang="json">{`{ "so_tien": 12500000 }`}</Code>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-2">✅ Nên — đã format</p>
                  <Code lang="json">{`{ "so_tien": "12,500,000 VNĐ" }`}</Code>
                </div>
              </div>

              <H2>Giá trị null / undefined</H2>
              <Note type="warn">
                Nếu key không tồn tại trong JSON, placeholder sẽ được thay bằng chuỗi rỗng <code className="font-mono text-xs">""</code>. Template sẽ không báo lỗi nhưng PDF sẽ trống ở chỗ đó.
              </Note>
            </div>
          )}

          {/* ── CONDITIONS ─────────────────────────────────────────────────── */}
          {active === 'conditions' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Điều kiện if / else</h1>
              <p className="text-zinc-400 mb-8">Hiện hoặc ẩn nội dung dựa theo giá trị boolean, string rỗng, hay mảng rỗng.</p>

              <H2>If cơ bản — <Tag color="amber">{'{#flag}…{/flag}'}</Tag></H2>
              <p className="text-sm text-zinc-400 mb-3">Nội dung bên trong chỉ hiện khi <code className="font-mono text-xs text-amber-400">flag</code> là truthy (true, số khác 0, string không rỗng, mảng không rỗng).</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-zinc-600 font-mono mb-2">template.docx</p>
                  <Code>{`Trạng thái thanh toán:
{#da_thanh_toan}
✓ ĐÃ THANH TOÁN
  Ngày TT: {ngay_thanh_toan}
{/da_thanh_toan}`}</Code>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 font-mono mb-2">data.json</p>
                  <Code lang="json">{`{
  "da_thanh_toan":  true,
  "ngay_thanh_toan": "15/01/2025"
}`}</Code>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-1 font-mono">Kết quả (da_thanh_toan = true):</p>
              <Code>{`Trạng thái thanh toán:
✓ ĐÃ THANH TOÁN
  Ngày TT: 15/01/2025`}</Code>

              <H2>If / Else — <Tag color="rose">{'{^flag}…{/flag}'}</Tag></H2>
              <p className="text-sm text-zinc-400 mb-3"><Tag color="rose">{'{^field}'}</Tag> = "nếu KHÔNG truthy". Kết hợp với <Tag color="amber">{'{#field}'}</Tag> tạo thành if/else hoàn chỉnh.</p>
              <Code lang="template.docx">{`{#da_thanh_toan}
✓ ĐÃ THANH TOÁN ngày {ngay_thanh_toan}
{/da_thanh_toan}
{^da_thanh_toan}
⚠ CHƯA THANH TOÁN — Hạn chót: {han_thanh_toan}
{/da_thanh_toan}`}</Code>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-2 font-mono">da_thanh_toan = true</p>
                  <Code>{`✓ ĐÃ THANH TOÁN ngày 15/01/2025`}</Code>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-2 font-mono">da_thanh_toan = false</p>
                  <Code>{`⚠ CHƯA THANH TOÁN — Hạn chót: 30/01/2025`}</Code>
                </div>
              </div>

              <H2>Điều kiện theo string</H2>
              <Note type="info">
                Không chỉ boolean — string rỗng <code className="font-mono text-xs">""</code> và <code className="font-mono text-xs">null</code> đều là falsy. String có nội dung bất kỳ đều là truthy.
              </Note>
              <Code lang="json">{`{
  "cap_bac": "senior",
  "ghi_chu": ""
}

// Trong template:
// {#ghi_chu} → KHÔNG hiện (string rỗng = falsy)
// {^ghi_chu}Không có ghi chú{/ghi_chu} → HIỆN
// {#cap_bac}Có thông tin cấp bậc{/cap_bac} → HIỆN`}</Code>

              <H2>Nested conditions</H2>
              <Code lang="template.docx">{`{#la_khach_vip}
  🌟 KHÁCH HÀNG VIP
  {#co_discount}
    Giảm giá đặc biệt: {phan_tram_giam}%
  {/co_discount}
  {^co_discount}
    Ưu đãi sẽ được áp dụng trong kỳ tới.
  {/co_discount}
{/la_khach_vip}`}</Code>
            </div>
          )}

          {/* ── LOOPS ──────────────────────────────────────────────────────── */}
          {active === 'loops' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Vòng lặp & mảng</h1>
              <p className="text-zinc-400 mb-8">Dùng <Tag color="purple">{'{#array}'}</Tag> để lặp qua danh sách. Bên trong vòng lặp, mỗi key trở thành field của từng phần tử.</p>

              <H2>Loop cơ bản</H2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-zinc-600 font-mono mb-2">template.docx</p>
                  <Code>{`Danh sách sản phẩm:
{#san_pham}
• {ten_sp} — {so_luong} cái — {don_gia}
{/san_pham}

Tổng cộng: {tong_tien}`}</Code>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 font-mono mb-2">data.json</p>
                  <Code lang="json">{`{
  "san_pham": [
    {
      "ten_sp": "Laptop Dell",
      "so_luong": 2,
      "don_gia": "15,000,000"
    },
    {
      "ten_sp": "Chuột Logitech",
      "so_luong": 5,
      "don_gia": "500,000"
    }
  ],
  "tong_tien": "31,500,000 VNĐ"
}`}</Code>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-1 font-mono">Kết quả:</p>
              <Code>{`Danh sách sản phẩm:
• Laptop Dell — 2 cái — 15,000,000
• Chuột Logitech — 5 cái — 500,000

Tổng cộng: 31,500,000 VNĐ`}</Code>

              <H2>Loop lồng nhau (Nested)</H2>
              <Note type="warn">
                Loop lồng nhau hoạt động bình thường nhưng chỉ dùng được trong paragraph (văn bản), <strong>không phải bảng</strong>. Với bảng xem phần <button onClick={() => setActive('tables')} className="text-blue-400 underline">Table</button>.
              </Note>
              <div className="grid grid-cols-2 gap-4">
                <Code lang="template.docx">{`{#phong_ban}
== {ten_phong} ({truong_phong}) ==
  {#nhan_vien}
  - {ho_ten} | {chuc_vu}
  {/nhan_vien}

{/phong_ban}`}</Code>
                <Code lang="json">{`{
  "phong_ban": [
    {
      "ten_phong": "Engineering",
      "truong_phong": "Le Van A",
      "nhan_vien": [
        {"ho_ten":"Nguyen B","chuc_vu":"Dev"},
        {"ho_ten":"Tran C","chuc_vu":"QA"}
      ]
    }
  ]
}`}</Code>
              </div>

              <H2>Loop kết hợp điều kiện</H2>
              <Code lang="template.docx">{`{#nhan_vien}
{ho_ten} — {chuc_vu}
{#dang_lam}  ● Đang làm việc{/dang_lam}
{^dang_lam}  ○ Đã nghỉ việc{/dang_lam}

{/nhan_vien}`}</Code>

              <Note type="tip">
                Phần tử đầu tiên của mảng có thể truy cập với <code className="font-mono text-xs">{'{[0].field}'}</code> nhưng ít dùng — thường loop toàn bộ dễ hơn.
              </Note>
            </div>
          )}

          {/* ── TABLES ─────────────────────────────────────────────────────── */}
          {active === 'tables' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Bảng (Table)</h1>
              <p className="text-zinc-400 mb-8">Loop trong bảng cần cú pháp đặc biệt — tag <Tag color="purple">{'{#arr}'}</Tag> và <Tag color="purple">{'{/arr}'}</Tag> phải nằm trong các row riêng biệt.</p>

              <H2>Cấu trúc bảng chuẩn</H2>
              <Note type="warn">
                <strong>Quy tắc quan trọng:</strong> Tag <code className="font-mono text-xs">{'{#items}'}</code> phải là cell đầu tiên của một row riêng (không có data). Row data tiếp theo. Row cuối có <code className="font-mono text-xs">{'{/items}'}</code>. Nếu đặt sai, docxtemplater sẽ báo lỗi "unclosed loop".
              </Note>

              <p className="text-sm text-zinc-400 mb-3">Cấu trúc table trong Word (nhìn như này):</p>
              <div className="rounded-xl border border-zinc-700 overflow-hidden mb-4">
                <table className="w-full text-xs font-mono">
                  <tbody className="divide-y divide-zinc-700">
                    <tr className="bg-zinc-800/60">
                      <td className="px-3 py-2 border-r border-zinc-700 text-zinc-400">STT</td>
                      <td className="px-3 py-2 border-r border-zinc-700 text-zinc-400">Tên sản phẩm</td>
                      <td className="px-3 py-2 border-r border-zinc-700 text-zinc-400">SL</td>
                      <td className="px-3 py-2 text-zinc-400">Giá</td>
                    </tr>
                    <tr className="bg-purple-400/5 border-t border-zinc-700">
                      <td colSpan={4} className="px-3 py-2 text-purple-400">{'{#items}'} ← row này span 4 cols, chỉ có tag</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border-r border-zinc-700 text-lime-400">{'{stt}'}</td>
                      <td className="px-3 py-2 border-r border-zinc-700 text-lime-400">{'{ten_sp}'}</td>
                      <td className="px-3 py-2 border-r border-zinc-700 text-lime-400">{'{so_luong}'}</td>
                      <td className="px-3 py-2 text-lime-400">{'{don_gia}'}</td>
                    </tr>
                    <tr className="bg-purple-400/5 border-t border-zinc-700">
                      <td colSpan={4} className="px-3 py-2 text-purple-400">{'{/items}'} ← row close</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>Data JSON</H3>
              <Code lang="json">{`{
  "items": [
    { "stt": 1, "ten_sp": "FlowPDF Pro",   "so_luong": 1, "don_gia": "8,000,000" },
    { "stt": 2, "ten_sp": "Template Setup", "so_luong": 3, "don_gia": "500,000" },
    { "stt": 3, "ten_sp": "API Support",    "so_luong": 10, "don_gia": "300,000" }
  ],
  "tong_cong": "11,500,000 VNĐ"
}`}</Code>

              <H3>Kết quả PDF</H3>
              <div className="rounded-xl border border-zinc-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-800 border-b border-zinc-700">
                      <th className="px-3 py-2 text-left text-zinc-400">STT</th>
                      <th className="px-3 py-2 text-left text-zinc-400">Tên sản phẩm</th>
                      <th className="px-3 py-2 text-left text-zinc-400">SL</th>
                      <th className="px-3 py-2 text-left text-zinc-400">Giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {[
                      [1,'FlowPDF Pro',1,'8,000,000'],
                      [2,'Template Setup',3,'500,000'],
                      [3,'API Support',10,'300,000'],
                    ].map(([i,n,q,p]) => (
                      <tr key={i as number} className="text-zinc-300">
                        <td className="px-3 py-2">{i}</td>
                        <td className="px-3 py-2">{n}</td>
                        <td className="px-3 py-2">{q}</td>
                        <td className="px-3 py-2">{p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <H2>Cách tạo table loop trong Word</H2>
              <ol className="space-y-3 text-sm text-zinc-400">
                {[
                  'Tạo bảng bình thường trong Word với header row',
                  'Thêm một row trống ngay sau header row — đây là "loop open row"',
                  'Gộp (merge) tất cả cells trong row đó thành 1 cell',
                  'Gõ {#tên_mảng} vào cell đó',
                  'Thêm row data bình thường với {field1}, {field2}, v.v.',
                  'Thêm một row trống nữa ở cuối, merge cells, gõ {/tên_mảng}',
                ].map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-mono text-zinc-500">{i+1}</span>
                    {s}
                  </li>
                ))}
              </ol>

              <Note type="tip">
                Xem file <code className="font-mono text-xs">template_invoice.docx</code> trong phần Template Mẫu để có ví dụ hoàn chỉnh có thể dùng ngay.
              </Note>
            </div>
          )}

          {/* ── IMAGES ─────────────────────────────────────────────────────── */}
          {active === 'images' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Chèn hình ảnh</h1>
              <p className="text-zinc-400 mb-8">Dùng <Tag color="blue">{'{%ten_anh}'}</Tag> để đánh dấu vị trí ảnh. Upload ảnh cùng tên field khi gọi API.</p>

              <H2>Cú pháp</H2>
              <Code lang="template.docx">{`Chữ ký Bên A:
{%chu_ky_a}

Logo công ty:
{%logo}

Ảnh sản phẩm:
{%anh_sp}`}</Code>

              <H2>Gọi API với ảnh</H2>
              <Code lang="bash">{`curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@contract.docx" \\
  -F 'data={"ho_ten":"Nguyen Van A"}' \\
  -F "chu_ky_a=@signature.png" \\
  -F "logo=@company_logo.png" \\
  --output output.pdf`}</Code>

              <Note type="info">
                Tên field trong <code className="font-mono text-xs">-F "field_name=@file.png"</code> phải khớp với tên trong template <code className="font-mono text-xs">{'{%field_name}'}</code>.
              </Note>

              <H2>Kích thước mặc định</H2>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60">
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Field name</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Kích thước</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-xs text-zinc-400">
                    <tr><td className="px-4 py-3 font-mono text-blue-400">signature</td><td className="px-4 py-3">150 × 50 px</td><td className="px-4 py-3">Chữ ký nằm ngang</td></tr>
                    <tr><td className="px-4 py-3 font-mono text-blue-400">logo</td><td className="px-4 py-3">120 × 60 px</td><td className="px-4 py-3">Logo công ty</td></tr>
                    <tr><td className="px-4 py-3 font-mono text-blue-400">khác</td><td className="px-4 py-3">150 × 100 px</td><td className="px-4 py-3">Default fallback</td></tr>
                  </tbody>
                </table>
              </div>

              <H2>Upload ảnh trong App UI</H2>
              <p className="text-sm text-zinc-400 mb-3">Trong tab <Link to="/render" className="text-lime-400 underline">Render</Link>, phần Images có sẵn slot cho <code className="font-mono text-xs">signature</code> và <code className="font-mono text-xs">logo</code>. Click vào để upload.</p>
              <Note type="tip">
                Ảnh PNG với nền trong suốt (transparent) cho kết quả đẹp nhất, đặc biệt với chữ ký.
              </Note>
            </div>
          )}

          {/* ── API ────────────────────────────────────────────────────────── */}
          {active === 'api' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">API Reference</h1>
              <p className="text-zinc-400 mb-8">Tất cả endpoint đều yêu cầu header <Tag color="lime">Authorization: Bearer &lt;key&gt;</Tag>. Default key: <code className="font-mono text-xs text-lime-400">flowpdf_dev_key</code></p>

              {[
                {
                  method: 'POST', path: '/api/render',
                  desc: 'Render DOCX template → trả về file PDF binary',
                  color: 'lime',
                  fields: [
                    { name: 'template', type: 'file (.docx)', required: true, desc: 'File template DOCX' },
                    { name: 'data',     type: 'JSON string', required: true, desc: 'Object chứa tất cả placeholder values' },
                    { name: 'signature', type: 'file (image)', required: false, desc: 'Ảnh chữ ký — field {%signature}' },
                    { name: 'logo',     type: 'file (image)', required: false, desc: 'Ảnh logo — field {%logo}' },
                  ],
                  response: 'Content-Type: application/pdf\nBinary PDF data',
                  curl: `curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@template.docx" \\
  -F 'data={"name":"Nguyen Van A","date":"15/01/2025"}' \\
  --output result.pdf`,
                },
                {
                  method: 'POST', path: '/api/preview',
                  desc: 'Render DOCX template → trả về base64 PDF (cho preview trong browser)',
                  color: 'blue',
                  fields: [
                    { name: 'template', type: 'file (.docx)', required: true, desc: 'File template DOCX' },
                    { name: 'data',     type: 'JSON string', required: true, desc: 'Placeholder values' },
                  ],
                  response: `{\n  "success": true,\n  "pdf": "<base64 string>",\n  "size": 48392\n}`,
                  curl: `curl -X POST http://localhost:8080/api/preview \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@template.docx" \\
  -F 'data={"name":"Test"}'`,
                },
                {
                  method: 'POST', path: '/api/analyze',
                  desc: 'Detect tất cả placeholders trong một DOCX template',
                  color: 'purple',
                  fields: [
                    { name: 'template', type: 'file (.docx)', required: true, desc: 'File template cần analyze' },
                  ],
                  response: `{\n  "placeholders": ["name","date","amount","items"]\n}`,
                  curl: `curl -X POST http://localhost:8080/api/analyze \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "template=@template.docx"`,
                },
                {
                  method: 'POST', path: '/api/combine',
                  desc: 'Gộp nhiều file (PDF, DOCX, JPG, PNG, TIFF) thành 1 PDF duy nhất',
                  color: 'orange',
                  fields: [
                    { name: 'files[]', type: 'file (multiple)', required: true, desc: 'Các file cần gộp, theo thứ tự' },
                  ],
                  response: 'Content-Type: application/pdf\nBinary merged PDF',
                  curl: `curl -X POST http://localhost:8080/api/combine \\
  -H "Authorization: Bearer flowpdf_dev_key" \\
  -F "files[]=@page1.pdf" \\
  -F "files[]=@page2.docx" \\
  -F "files[]=@image.jpg" \\
  --output merged.pdf`,
                },
                {
                  method: 'GET', path: '/health',
                  desc: 'Health check — kiểm tra API và Gotenberg đang chạy',
                  color: 'cyan',
                  fields: [],
                  response: `{\n  "status": "ok",\n  "gotenberg": "ok",\n  "timestamp": "2025-01-15T10:00:00.000Z"\n}`,
                  curl: `curl http://localhost:8080/health`,
                },
              ].map(ep => {
                const colors: Record<string, string> = {
                  lime: 'border-lime-400/30 bg-lime-400/5 text-lime-400',
                  blue: 'border-blue-400/30 bg-blue-400/5 text-blue-400',
                  purple: 'border-purple-400/30 bg-purple-400/5 text-purple-400',
                  orange: 'border-orange-400/30 bg-orange-400/5 text-orange-400',
                  cyan: 'border-cyan-400/30 bg-cyan-400/5 text-cyan-400',
                };
                const methodColor: Record<string, string> = {
                  POST: 'bg-lime-400/20 text-lime-400',
                  GET:  'bg-blue-400/20 text-blue-400',
                };
                return (
                  <div key={ep.path} className={`rounded-2xl border mb-6 overflow-hidden ${colors[ep.color]}`}>
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-current/20">
                      <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${methodColor[ep.method]}`}>{ep.method}</span>
                      <code className="font-mono text-sm text-white">{ep.path}</code>
                      <span className="text-xs text-zinc-500 ml-2">{ep.desc}</span>
                    </div>
                    <div className="p-5 space-y-4">
                      {ep.fields.length > 0 && (
                        <div>
                          <p className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Form fields</p>
                          <div className="rounded-xl border border-zinc-800 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-zinc-950/60 border-b border-zinc-800">
                                <th className="text-left px-3 py-2 font-mono text-zinc-600">Field</th>
                                <th className="text-left px-3 py-2 font-mono text-zinc-600">Type</th>
                                <th className="text-left px-3 py-2 font-mono text-zinc-600">Required</th>
                                <th className="text-left px-3 py-2 font-mono text-zinc-600">Mô tả</th>
                              </tr></thead>
                              <tbody className="divide-y divide-zinc-800/50">
                                {ep.fields.map(f => (
                                  <tr key={f.name}>
                                    <td className="px-3 py-2 font-mono text-lime-400">{f.name}</td>
                                    <td className="px-3 py-2 text-zinc-500">{f.type}</td>
                                    <td className="px-3 py-2">{f.required ? <span className="text-rose-400">✓ Yes</span> : <span className="text-zinc-600">No</span>}</td>
                                    <td className="px-3 py-2 text-zinc-400">{f.desc}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Response</p>
                          <Code>{ep.response}</Code>
                        </div>
                        <div>
                          <p className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">cURL example</p>
                          <Code lang="bash">{ep.curl}</Code>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SAMPLES ────────────────────────────────────────────────────── */}
          {active === 'samples' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Template mẫu</h1>
              <p className="text-zinc-400 mb-8">
                Download template <code className="font-mono text-xs text-lime-400">.docx</code> và file data <code className="font-mono text-xs text-lime-400">.json</code> đã verify.
                Upload lên tab <Link to="/render" className="text-lime-400 underline">Render</Link> để test ngay.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                <SampleCard
                  title="Hợp đồng dịch vụ"
                  desc="Basic fields, chữ ký 2 bên, thông tin hợp đồng. Syntax: {field} + {%image}"
                  docx="template_contract.docx"
                  json="data_contract.json"
                  color="lime"
                />
                <SampleCard
                  title="Hóa đơn bán hàng"
                  desc="Loop sản phẩm, tổng tiền, if/else trạng thái thanh toán. Syntax: {#items} + {#is_paid}/{^is_paid}"
                  docx="template_invoice.docx"
                  json="data_invoice.json"
                  color="blue"
                />
                <SampleCard
                  title="Báo cáo nhân sự"
                  desc="Nested loops: phòng ban → nhân viên, inline if/else trong bảng. Syntax: {#departments}{#members}"
                  docx="template_report.docx"
                  json="data_report.json"
                  color="purple"
                />
              </div>

              <H2>Syntax được dùng trong từng template</H2>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden mb-8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60">
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Template</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Syntax</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">Mục đích học</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-xs">
                    <tr>
                      <td className="px-4 py-3 text-zinc-300 font-medium">Contract</td>
                      <td className="px-4 py-3 space-x-1">
                        <Tag color="lime">{'{field}'}</Tag>
                        <Tag color="blue">{'{%signature}'}</Tag>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">Cơ bản, chèn ảnh chữ ký</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-zinc-300 font-medium">Invoice</td>
                      <td className="px-4 py-3 space-x-1">
                        <Tag color="purple">{'{#items}…{/items}'}</Tag>
                        <Tag color="amber">{'{#is_paid}'}</Tag>
                        <Tag color="rose">{'{^is_paid}'}</Tag>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">Loop bảng, if/else payment</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-zinc-300 font-medium">Report</td>
                      <td className="px-4 py-3 space-x-1">
                        <Tag color="purple">{'{#depts}{#members}'}</Tag>
                        <Tag color="amber">{'{#is_active}'}</Tag>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">Nested loops, if trong cell</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H2>Tự tạo template từ đầu</H2>
              <ol className="space-y-4 text-sm text-zinc-400">
                {[
                  { title: 'Mở Word hoặc LibreOffice Writer', desc: 'Tạo file .docx mới. Thiết kế layout như bình thường — font, màu, border, bảng.' },
                  { title: 'Chèn placeholder', desc: 'Gõ {ten_khach} ở chỗ muốn điền tên. Gõ {%logo} ở chỗ muốn chèn ảnh. Placeholder phải viết chính xác, không có space thừa.' },
                  { title: 'Tạo bảng có loop', desc: 'Thêm 2 row đặc biệt: row đầu merge cells gõ {#items}, row cuối gõ {/items}. Row giữa là template cho mỗi dòng data.' },
                  { title: 'Test với FlowPDF', desc: 'Upload lên tab Render, paste JSON data, Generate PDF. Nếu lỗi, xem log để biết placeholder nào bị thiếu.' },
                  { title: 'Dùng tab Builder', desc: 'Dùng Template Builder để tạo nhanh rồi export .docx, sau đó mở lại trong Word để chỉnh chi tiết hơn.' },
                ].map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-mono text-zinc-500 font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">{s.title}</p>
                      <p className="text-zinc-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <Note type="tip">
                Tab <Link to="/builder" className="text-lime-400 underline">Template Builder</Link> trong app cho phép upload file .docx có sẵn để edit trực tiếp trong ONLYOFFICE (nếu đang chạy), hoặc dùng Block Builder để tạo template mới bằng kéo thả.
              </Note>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
