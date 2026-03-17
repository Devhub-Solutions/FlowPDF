import { useNavigate } from 'react-router-dom';
import { Ico } from '../components/icons/Ico';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80 flex-shrink-0">
        <div className="max-w-[1200px] mx-auto px-8 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center shadow-[0_0_12px_rgba(163,230,53,0.4)]">
              <span className="text-zinc-950 font-bold text-xs font-mono">F</span>
            </div>
            <span className="font-bold text-white text-base tracking-tight">FlowPDF</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="/api-docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors font-mono px-3 py-1.5 rounded-lg hover:bg-zinc-800"
            >
              API Docs
            </a>
            <button
              onClick={() => navigate('/render')}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-lime-400 text-zinc-950 text-sm font-bold font-mono hover:bg-lime-300 transition-all shadow-[0_0_16px_rgba(163,230,53,0.25)] active:scale-95"
            >
              Open App →
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 pt-24 pb-16 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-lime-400/5 blur-[100px] pointer-events-none" />

        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-lime-400/20 bg-lime-400/5 text-lime-400 text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            Self-hosted · Docker ready · No cloud lock-in
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight mb-6 max-w-3xl">
            DOCX Templates{' '}
            <span className="text-lime-400">→ PDF</span>
            <br />in One API Call
          </h1>

          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed mb-10">
            Fill Word templates with JSON data, embed images, and merge files into pixel-perfect PDFs.
            Drop it into any stack — no SaaS fees, no data leaving your infra.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/render')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-lime-400 text-zinc-950 font-bold font-mono text-sm hover:bg-lime-300 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] active:scale-[0.98]"
            >
              <Ico.zap /> Open App
            </button>
            <a
              href="/api-docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 bg-zinc-800/60 text-zinc-300 font-mono text-sm hover:border-zinc-600 hover:bg-zinc-700/60 transition-all"
            >
              <Ico.code /> API Reference
            </a>
          </div>
        </div>

        {/* Curl snippet */}
        <div className="mt-16 w-full max-w-2xl animate-fade-up">
          <div className="card text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-lime-500/60" />
              <span className="text-xs text-zinc-600 font-mono ml-2">terminal</span>
            </div>
            <pre className="text-xs font-mono text-zinc-400 leading-loose overflow-x-auto whitespace-pre">{`curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer <your_api_key>" \\
  -F "template=@contract.docx" \\
  -F 'data={"client_name":"Nguyen Van A","amount":"5,000,000 VND"}' \\
  -F "signature=@sign.png" \\
  --output contract.pdf`}</pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1200px] mx-auto w-full px-8 pb-20">
        <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest text-center mb-10">What you can do</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <Ico.zap />,
              title: 'Template Render',
              color: 'lime',
              desc: 'Write {placeholders} in any .docx file. POST with JSON data → get a filled PDF back instantly.',
              tag: 'POST /api/render',
            },
            {
              icon: <Ico.img />,
              title: 'Image Embedding',
              color: 'blue',
              desc: 'Use {%signature} or {%logo} in your template. Upload images as form fields — they land in the right spot.',
              tag: '{%image}',
            },
            {
              icon: <Ico.merge />,
              title: 'PDF Merge',
              color: 'purple',
              desc: 'Combine PDFs, DOCX, JPG, PNG and TIFF files into one merged PDF in a single request.',
              tag: 'POST /api/combine',
            },
            {
              icon: <Ico.cursor />,
              title: 'Template Builder',
              color: 'orange',
              desc: 'Visual drag-and-drop builder. Add fields, headings, images, tables. Export a ready-to-use .docx.',
              tag: 'No code',
            },
          ].map((f) => {
            const accent: Record<string, string> = {
              lime: 'border-lime-400/20 bg-lime-400/5 text-lime-400',
              blue: 'border-blue-400/20 bg-blue-400/5 text-blue-400',
              purple: 'border-purple-400/20 bg-purple-400/5 text-purple-400',
              orange: 'border-orange-400/20 bg-orange-400/5 text-orange-400',
            };
            const iconBg: Record<string, string> = {
              lime: 'bg-lime-400/10 text-lime-400',
              blue: 'bg-blue-400/10 text-blue-400',
              purple: 'bg-purple-400/10 text-purple-400',
              orange: 'bg-orange-400/10 text-orange-400',
            };
            return (
              <div key={f.title} className="card flex flex-col gap-4 hover:border-zinc-700 transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[f.color]}`}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
                <span className={`mt-auto self-start text-xs font-mono px-2 py-1 rounded-lg border ${accent[f.color]}`}>
                  {f.tag}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-[1200px] mx-auto px-8 py-16">
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest text-center mb-10">How it works</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Prepare a .docx template',
                desc: 'Add {client_name}, {date} etc. for text fields. Add {%signature} for images. Use Word, LibreOffice, or the built-in Builder.',
              },
              {
                step: '02',
                title: 'POST to the API',
                desc: 'Send your template as a multipart form. Include JSON data and any image files. Bearer token auth keeps it secure.',
              },
              {
                step: '03',
                title: 'Receive a perfect PDF',
                desc: 'LibreOffice handles the heavy conversion. Your PDF comes back in the response body — ready to save, e-mail or store.',
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-xs text-zinc-500 font-bold">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1.5">{s.title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="max-w-[1200px] mx-auto w-full px-8 py-12">
        <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest text-center mb-6">Built with</p>
        <div className="flex items-center justify-center flex-wrap gap-3">
          {['Node.js 18', 'TypeScript', 'Express', 'Docxtemplater', 'LibreOffice', 'Gotenberg', 'Docker', 'React', 'Tailwind CSS'].map(
            (t) => (
              <span key={t} className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500 font-mono">
                {t}
              </span>
            )
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800/60 bg-zinc-950">
        <div className="max-w-[1200px] mx-auto px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-base font-semibold text-white mb-1">Ready to start?</p>
            <p className="text-sm text-zinc-500">Open the app and render your first PDF in under a minute.</p>
          </div>
          <button
            onClick={() => navigate('/render')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-lime-400 text-zinc-950 font-bold font-mono text-sm hover:bg-lime-300 transition-all shadow-[0_0_30px_rgba(163,230,53,0.2)] active:scale-[0.98] flex-shrink-0"
          >
            <Ico.zap /> Get Started
          </button>
        </div>
      </section>

      <footer className="border-t border-zinc-800/40 bg-zinc-950">
        <div className="max-w-[1200px] mx-auto px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-lime-400 flex items-center justify-center">
              <span className="text-zinc-950 font-bold text-[8px] font-mono">F</span>
            </div>
            <span className="text-xs text-zinc-600 font-mono">FlowPDF</span>
          </div>
          <span className="text-xs text-zinc-700 font-mono">Self-hosted PDF generation API</span>
        </div>
      </footer>
    </div>
  );
}
