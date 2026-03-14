import './index.css';
import { useState, useRef, useMemo, useEffect } from 'react';
import { renderToPdf, analyzePlaceholders } from './services/api';
import PizZip from 'pizzip';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'render' | 'builder';
type RenderMode = 'template' | 'html' | 'url';
type BuilderBlock = { id: string; type: 'text' | 'field' | 'image' | 'heading' | 'divider' | 'table'; content: string; label?: string };

// ─── Tiny ID ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ico = {
  upload: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  zap: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></svg>,
  check: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  file: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  key: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  img: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round"/></svg>,
  trash: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  drag: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/></svg>,
  cursor: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4 4l16 6-7 2-2 7-7-15z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  code: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round"/><polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  download: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  eye: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ─── Step Badge ───────────────────────────────────────────────────────────────
const StepBadge = ({ n, done }: { n: number; done: boolean }) => (
  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 transition-all
    ${done ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700'}`}>
    {done ? <Ico.check /> : n}
  </div>
);

// ─── RENDER TAB ───────────────────────────────────────────────────────────────
function RenderTab() {
  const [renderMode, setRenderMode] = useState<RenderMode>('template');
  const [template, setTemplate] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState('{\n  "name": "Nguyen Van A",\n  "company": "FlowPDF Inc.",\n  "date": "2025-01-15",\n  "amount": "5,000,000 VND"\n}');
  const [images, setImages] = useState<Record<string, File>>({});
  const [apiKey, setApiKey] = useState('flowpdf_dev_key');
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [htmlInput, setHtmlInput] = useState('');
  const [urlInput, setUrlInput] = useState('');

  const isJsonValid = (() => { try { JSON.parse(jsonData); return true; } catch { return false; } })();

  const imagePreviews = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const [key, file] of Object.entries(images)) {
      urls[key] = URL.createObjectURL(file);
    }
    return urls;
  }, [images]);

  useEffect(() => {
    return () => { Object.values(imagePreviews).forEach(u => URL.revokeObjectURL(u)); };
  }, [imagePreviews]);

  const handleTemplateUpload = async (file: File) => {
    setTemplate(file); setAnalyzing(true); setPlaceholders([]); setPdfUrl(null); setStatus('idle');
    try {
      const result = await analyzePlaceholders(file, apiKey);
      const detected = result.placeholders.filter(p => !p.startsWith('%'));
      if (detected.length > 0) {
        const obj: Record<string, string> = {};
        detected.forEach(p => { obj[p] = `<${p}>`; });
        setJsonData(JSON.stringify(obj, null, 2));
      }
      setPlaceholders(result.placeholders);
    } catch { /* ignore */ }
    setAnalyzing(false);
  };

  const handleGenerate = async () => {
    setStatus('loading'); setError(null); setPdfUrl(null);
    try {
      let blob: Blob;
      if (renderMode === 'html') {
        blob = await renderToPdf({ html: htmlInput, apiKey });
      } else if (renderMode === 'url') {
        blob = await renderToPdf({ url: urlInput, apiKey });
      } else {
        if (!template) return;
        const data = JSON.parse(jsonData);
        blob = await renderToPdf({ template, data, images, apiKey });
      }
      setPdfUrl(URL.createObjectURL(blob));
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render failed');
      setStatus('error');
    }
  };

  const textFields = placeholders.filter(p => !p.startsWith('%'));
  const imgFields = placeholders.filter(p => p.startsWith('%'));

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-5 h-full">

      {/* COL 1 — Template + Config */}
      <div className="flex flex-col gap-4">
        {/* Render Mode Selector */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Source</span>
          </div>
          <div className="flex gap-1.5">
            {([['template', 'DOCX'], ['html', 'HTML'], ['url', 'URL']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => { setRenderMode(mode); setPdfUrl(null); setStatus('idle'); setError(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all
                  ${renderMode === mode ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {renderMode === 'template' && (<>
        {/* Template Upload */}
        <div className="card">
          <div className="card-header">
            <StepBadge n={1} done={!!template} />
            <span className="card-title">DOCX Template</span>
            {analyzing && <span className="ml-auto text-xs text-zinc-500 font-mono flex items-center gap-1.5"><span className="w-3 h-3 border border-lime-400 border-t-transparent rounded-full animate-spin inline-block"/>scanning…</span>}
          </div>
          {!template ? (
            <div
              className="drop-zone"
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.docx')) handleTemplateUpload(f); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => document.getElementById('tpl-input')?.click()}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors"><Ico.upload /></div>
              <p className="text-sm font-medium text-white">Drop .docx here or click</p>
              <p className="text-xs text-zinc-500 mt-1">Use <code className="text-lime-400 font-mono">{'{placeholder}'}</code> and <code className="text-lime-400 font-mono">{'{%image}'}</code></p>
              <input id="tpl-input" type="file" accept=".docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleTemplateUpload(f); }}/>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-1">
              <div className="w-8 h-8 rounded-lg bg-lime-400/10 border border-lime-400/20 flex items-center justify-center flex-shrink-0"><Ico.file /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{template.name}</p>
                <p className="text-xs text-zinc-500">{(template.size/1024).toFixed(1)} KB · {placeholders.length} vars</p>
              </div>
              <button onClick={() => { setTemplate(null); setPlaceholders([]); setPdfUrl(null); setStatus('idle'); }} className="icon-btn hover:text-red-400"><Ico.x /></button>
            </div>
          )}

          {placeholders.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">Variables</p>
              <div className="flex flex-wrap gap-1.5">
                {textFields.map(p => <span key={p} className="px-2 py-0.5 rounded bg-zinc-800 text-lime-400 text-xs font-mono border border-zinc-700">{'{'+p+'}'}</span>)}
                {imgFields.map(p => <span key={p} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono border border-blue-500/20">{'{'+p+'}'}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* API Key */}
        <div className="card">
          <div className="card-header">
            <StepBadge n={2} done={!!apiKey} />
            <span className="card-title">API Key</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
              className="input pl-9 font-mono text-sm" placeholder="flowpdf_dev_key"/>
          </div>
        </div>

        {/* Images */}
        <div className="card">
          <div className="card-header">
            <StepBadge n={3} done={Object.keys(images).length > 0} />
            <span className="card-title">Images</span>
            <span className="text-xs text-zinc-600 ml-auto">optional</span>
          </div>
          {imgFields.length === 0 && template && (
            <p className="text-xs text-zinc-600 mb-2">Use <code className="text-lime-400 font-mono">{'{%signature}'}</code> in template to embed images</p>
          )}
          <div className="flex flex-col gap-2">
            {(imgFields.length > 0
              ? imgFields.map(p => p.replace(/^%/, ''))
              : ['signature', 'logo', 'image1', 'image2', 'image3']
            ).map(field => (
              <label key={field} className="cursor-pointer">
                <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all
                  ${images[field] ? 'border-lime-400/30 bg-lime-400/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}>
                  {imagePreviews[field] ? (
                    <img src={imagePreviews[field]} alt={field}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-lime-400/20"/>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0"><Ico.img /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-zinc-300 capitalize">{field}</p>
                    <p className="text-xs text-zinc-600 truncate">{images[field] ? images[field].name : 'click to upload'}</p>
                  </div>
                  {images[field] && (
                    <button onClick={e => { e.preventDefault(); const n = {...images}; delete n[field]; setImages(n); }} className="icon-btn hover:text-red-400"><Ico.x /></button>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setImages({...images, [field]: f}); }}/>
              </label>
            ))}
          </div>
        </div>
        </>)}

        {renderMode === 'html' && (
          <div className="card flex-1 flex flex-col">
            <div className="card-header">
              <StepBadge n={1} done={!!htmlInput.trim()} />
              <span className="card-title">HTML Content</span>
            </div>
            <textarea
              value={htmlInput}
              onChange={e => setHtmlInput(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-4 bg-zinc-950 rounded-xl text-xs font-mono leading-relaxed text-orange-300
                border border-zinc-800 focus:border-zinc-600 focus:outline-none resize-none transition-colors min-h-[280px]"
              placeholder='<h1>Hello World</h1><p>Your HTML here...</p>'
            />
          </div>
        )}

        {renderMode === 'url' && (
          <div className="card">
            <div className="card-header">
              <StepBadge n={1} done={!!urlInput.trim()} />
              <span className="card-title">URL</span>
            </div>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="input font-mono text-sm"
              placeholder="https://example.com"
            />
            <p className="text-xs text-zinc-600 mt-2">Enter a URL to convert the web page to PDF</p>
          </div>
        )}
      </div>
      {/* COL 2 — JSON Editor / Generate */}
      <div className="flex flex-col gap-4">
        {renderMode === 'template' && (
        <div className="card flex-1 flex flex-col">
          <div className="card-header">
            <StepBadge n={4} done={isJsonValid && !!template} />
            <span className="card-title">Data JSON</span>
            <span className={`ml-auto px-2 py-0.5 rounded text-xs font-mono flex items-center gap-1 ${isJsonValid ? 'bg-lime-400/10 text-lime-400' : 'bg-red-500/10 text-red-400'}`}>
              {isJsonValid ? <><Ico.check /> valid</> : <><Ico.x /> invalid</>}
            </span>
          </div>
          <textarea
            value={jsonData}
            onChange={e => setJsonData(e.target.value)}
            spellCheck={false}
            className={`flex-1 w-full p-4 bg-zinc-950 rounded-xl text-xs font-mono leading-relaxed text-emerald-300
              border focus:outline-none resize-none transition-colors min-h-[280px]
              ${isJsonValid ? 'border-zinc-800 focus:border-zinc-600' : 'border-red-500/40'}`}
            placeholder='{ "key": "value" }'
          />
        </div>
        )}

        {renderMode !== 'template' && <div className="flex-1" />}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={
            (renderMode === 'template' && (!template || !isJsonValid)) ||
            (renderMode === 'html' && !htmlInput.trim()) ||
            (renderMode === 'url' && !urlInput.trim()) ||
            status === 'loading'
          }
          className={`h-13 rounded-2xl font-mono font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all
            ${(
              (renderMode === 'template' && template && isJsonValid) ||
              (renderMode === 'html' && htmlInput.trim()) ||
              (renderMode === 'url' && urlInput.trim())
            ) && status !== 'loading'
              ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.25)] active:scale-[0.98] cursor-pointer'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
        >
          {status === 'loading'
            ? <><span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"/>Rendering…</>
            : <><Ico.zap /> Generate PDF</>}
        </button>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400 font-mono leading-relaxed">⚠ {error}</div>
        )}

        {/* Curl snippet */}
        {renderMode === 'template' && template && (
          <div className="card">
            <p className="text-xs font-mono text-zinc-600 mb-2 uppercase tracking-wider">cURL</p>
            <pre className="text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{`curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F "template=@${template.name}" \\
  -F 'data=${jsonData.replace(/\s+/g,' ')}' \\${Object.entries(images).map(([k, f]) => `\n  -F "${k}=@${f.name}" \\`).join('')}
  --output doc.pdf`}</pre>
          </div>
        )}
        {renderMode === 'html' && htmlInput.trim() && (
          <div className="card">
            <p className="text-xs font-mono text-zinc-600 mb-2 uppercase tracking-wider">cURL</p>
            <pre className="text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{`curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F 'html=${htmlInput.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' \\
  --output doc.pdf`}</pre>
          </div>
        )}
        {renderMode === 'url' && urlInput.trim() && (
          <div className="card">
            <p className="text-xs font-mono text-zinc-600 mb-2 uppercase tracking-wider">cURL</p>
            <pre className="text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{`curl -X POST http://localhost:8080/api/render \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F 'url=${urlInput}' \\
  --output doc.pdf`}</pre>
          </div>
        )}
      </div>

      {/* COL 3 — PDF Preview */}
      <div className="card flex flex-col" style={{ minHeight: '600px' }}>
        <div className="card-header flex-shrink-0">
          <span className="flex items-center gap-1.5 text-zinc-500"><Ico.eye /><span className="card-title">Preview</span></span>
          {status === 'success' && <span className="px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 text-xs font-mono ml-2">ready</span>}
          {status === 'success' && (
            <button onClick={() => { if (!pdfUrl) return; const a = document.createElement('a'); a.href=pdfUrl; a.download='document.pdf'; a.click(); }}
              className="ml-auto flex items-center gap-1.5 text-xs font-mono text-lime-400 hover:text-lime-300 px-3 py-1.5 rounded-lg bg-lime-400/10 hover:bg-lime-400/20 transition-colors">
              <Ico.download /> download
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden rounded-xl">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0 rounded-xl" title="PDF Preview"/>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
              {status === 'loading' ? (
                <>
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-2 border-lime-400/20"/>
                    <div className="absolute inset-0 rounded-full border-2 border-t-lime-400 animate-spin"/>
                    <div className="absolute inset-2 rounded-full border border-t-lime-400/40 animate-spin" style={{animationDuration:'2s'}}/>
                  </div>
                  <p className="text-sm text-zinc-400 font-mono">Rendering PDF…</p>
                </>
              ) : (
                <>
                  <div className="w-32 opacity-10 space-y-1.5">
                    <div className="h-2 bg-zinc-600 rounded w-full"/>
                    {[80,90,70,85,65,75,80,60].map((w,i) => <div key={i} className="h-1.5 bg-zinc-700 rounded" style={{width:`${w}%`}}/>)}
                    <div className="h-12 bg-zinc-800 rounded mt-3"/>
                    {[70,85,65].map((w,i) => <div key={i} className="h-1.5 bg-zinc-700 rounded mt-1.5" style={{width:`${w}%`}}/>)}
                  </div>
                  <p className="text-xs text-zinc-600 font-mono text-center">{template ? 'fill data → generate' : 'upload template to start'}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BUILDER TAB ──────────────────────────────────────────────────────────────
const BLOCK_TYPES: { type: BuilderBlock['type']; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'heading',  label: 'Heading',    icon: <span className="font-bold text-sm">H</span>, desc: 'Title, section header' },
  { type: 'text',     label: 'Paragraph',  icon: <span className="text-xs">¶</span>,           desc: 'Body text, descriptions' },
  { type: 'field',    label: 'Field',      icon: <span className="font-mono text-xs">{'{}'}</span>, desc: 'Dynamic placeholder' },
  { type: 'image',    label: 'Image',      icon: <Ico.img />,                                  desc: 'Logo, signature, photo' },
  { type: 'divider',  label: 'Divider',    icon: <span className="text-lg leading-none">—</span>, desc: 'Horizontal rule' },
  { type: 'table',    label: 'Table',      icon: <span className="text-xs">⊞</span>,           desc: 'Row/col data table' },
];

// ── Parse DOCX XML into Builder blocks ────────────────────────────────────
async function parseDocxIntoBlocks(file: File, apiKey: string): Promise<BuilderBlock[]> {
  // Use /analyze to get placeholders
  let placeholders: string[] = [];
  try {
    const res = await analyzePlaceholders(file, apiKey);
    placeholders = res.placeholders;
  } catch { /* ignore */ }

  // Read the raw XML from the docx (zip) in the browser
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Simple ZIP entry reader — find word/document.xml
  let xmlText = '';
  try {
    // locate PK signature entries
    const sig = [0x50, 0x4B, 0x03, 0x04];
    let i = 0;
    while (i < uint8.length - 4) {
      if (uint8[i]===sig[0] && uint8[i+1]===sig[1] && uint8[i+2]===sig[2] && uint8[i+3]===sig[3]) {
        const nameLen = uint8[i+26] | (uint8[i+27] << 8);
        const extraLen = uint8[i+28] | (uint8[i+29] << 8);
        const nameBytes = uint8.slice(i+30, i+30+nameLen);
        const name = new TextDecoder().decode(nameBytes);
        const dataStart = i + 30 + nameLen + extraLen;
        const compSize = uint8[i+18] | (uint8[i+19]<<8) | (uint8[i+20]<<16) | (uint8[i+21]<<24);
        if (name === 'word/document.xml' && compSize > 0) {
          // compressed — just grab a chunk of raw text for pattern matching
          const raw = uint8.slice(dataStart, dataStart + compSize);
          xmlText = new TextDecoder('utf-8', { fatal: false }).decode(raw);
          break;
        }
        i = dataStart + compSize;
      } else { i++; }
    }
  } catch { /* ignore */ }

  // Build blocks from placeholders detected by API
  const blocks: BuilderBlock[] = [];
  blocks.push({ id: uid(), type: 'heading', content: file.name.replace(/\.docx$/i, '').replace(/[-_]/g, ' ').toUpperCase() });

  const textPhs = placeholders.filter(p => !p.startsWith('%'));
  const imgPhs  = placeholders.filter(p => p.startsWith('%')).map(p => p.slice(1));

  if (textPhs.length > 0) {
    blocks.push({ id: uid(), type: 'text', content: 'Document content with the following fields:' });
    textPhs.forEach(ph => {
      blocks.push({ id: uid(), type: 'field', content: ph, label: ph.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
    });
  }

  if (imgPhs.length > 0) {
    blocks.push({ id: uid(), type: 'divider', content: '' });
    imgPhs.forEach(key => {
      blocks.push({ id: uid(), type: 'image', content: key, label: key.charAt(0).toUpperCase() + key.slice(1) });
    });
  }

  if (blocks.length === 1) {
    // No placeholders found — add placeholder block as hint
    blocks.push({ id: uid(), type: 'text', content: 'No placeholders detected. Add {field} syntax to your template.' });
  }

  return blocks;
}

function BuilderTab() {
  const [blocks, setBlocks] = useState<BuilderBlock[]>([
    { id: uid(), type: 'heading',  content: 'CONTRACT AGREEMENT' },
    { id: uid(), type: 'field',    content: 'client_name',  label: 'Client Name' },
    { id: uid(), type: 'field',    content: 'date',         label: 'Date' },
    { id: uid(), type: 'text',     content: 'This agreement is entered into between the parties listed above.' },
    { id: uid(), type: 'field',    content: 'amount',       label: 'Amount' },
    { id: uid(), type: 'divider',  content: '' },
    { id: uid(), type: 'image',    content: 'signature',    label: 'Signature' },
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [builderApiKey, setBuilderApiKey] = useState('flowpdf_dev_key');
  const dragId = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  const handleImportDocx = async (file: File) => {
    setUploading(true);
    setUploadedFile(null);
    try {
      const parsed = await parseDocxIntoBlocks(file, builderApiKey);
      setBlocks(parsed);
      setSelected(null);
      setUploadedFile(file.name);
    } catch (e) {
      console.error('Parse failed', e);
    }
    setUploading(false);
  };

  const addBlock = (type: BuilderBlock['type']) => {
    const defaults: Record<BuilderBlock['type'], Partial<BuilderBlock>> = {
      heading:  { content: 'New Heading' },
      text:     { content: 'Enter paragraph text here...' },
      field:    { content: 'field_name', label: 'Field Label' },
      image:    { content: 'image_key',  label: 'Image' },
      divider:  { content: '' },
      table:    { content: 'col1,col2,col3', label: 'Table Columns' },
    };
    const nb: BuilderBlock = { id: uid(), type, ...defaults[type] } as BuilderBlock;
    setBlocks(b => [...b, nb]);
    setSelected(nb.id);
  };

  const updateBlock = (id: string, patch: Partial<BuilderBlock>) => {
    setBlocks(b => b.map(bl => bl.id === id ? { ...bl, ...patch } : bl));
  };

  const removeBlock = (id: string) => {
    setBlocks(b => b.filter(bl => bl.id !== id));
    if (selected === id) setSelected(null);
  };

  const handleDragStart = (id: string) => { dragId.current = id; };
  const handleDragEnterBlock = (id: string) => { dragOver.current = id; };
  const handleDrop = () => {
    if (!dragId.current || !dragOver.current || dragId.current === dragOver.current) return;
    setBlocks(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(b => b.id === dragId.current);
      const toIdx = arr.findIndex(b => b.id === dragOver.current);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    dragId.current = null; dragOver.current = null;
  };

  // Generate plain-text syntax preview
  const generateTemplate = () => {
    const lines = blocks.map(b => {
      if (b.type === 'heading')  return `# ${b.content}`;
      if (b.type === 'text')     return b.content;
      if (b.type === 'field')    return `{${b.content}}`;
      if (b.type === 'image')    return `{%${b.content}}`;
      if (b.type === 'divider')  return '────────────────────────────────';
      if (b.type === 'table')    return `| ${(b.content||'').split(',').join(' | ')} |\n| ${(b.content||'').split(',').map(()=>'---').join(' | ')} |`;
      return '';
    });
    return lines.join('\n\n');
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(generateTemplate());
  };

  // ── Build real DOCX from blocks ──────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const buildDocxXml = (): string => {
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const para = (xml: string, style = 'Normal') =>
      `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${xml}</w:p>`;

    const run = (text: string, bold = false, size = 24, color = '000000') => {
      const rPr = `<w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
      return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
    };

    const rows: string[] = [];

    for (const b of blocks) {
      switch (b.type) {
        case 'heading':
          rows.push(para(run(b.content || 'Heading', true, 32, '1a1a2e'), 'Heading1'));
          rows.push(para(''));
          break;

        case 'text':
          rows.push(para(run(b.content || '')));
          rows.push(para(''));
          break;

        case 'field': {
          const label = b.label ? b.label + ': ' : '';
          rows.push(para(
            run(label, false, 24, '555555') +
            run('{' + (b.content || 'field') + '}', false, 24, '166534')
          ));
          break;
        }

        case 'image':
          rows.push(para(run('{%' + (b.content || 'image') + '}', false, 24, '1d4ed8')));
          rows.push(para(''));
          break;

        case 'divider':
          rows.push(
            `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="cccccc"/></w:pBdr></w:pPr></w:p>`
          );
          break;

        case 'table': {
          const cols = (b.content || 'col1,col2').split(',').map(c => c.trim());
          const cellW = Math.floor(9360 / cols.length);
          const headerCells = cols.map(c =>
            `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="f3f4f6"/></w:tcPr>` +
            `<w:p>${'<w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>' + esc(c) + '</w:t></w:r>'}</w:p></w:tc>`
          ).join('');
          const dataCells = cols.map(c =>
            `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/></w:tcPr>` +
            `<w:p><w:r><w:rPr><w:color w:val="166534"/></w:rPr><w:t>{${esc(c)}}</w:t></w:r></w:p></w:tc>`
          ).join('');
          const tblBorders = `<w:tblBorders>
            <w:top w:val="single" w:sz="4" w:color="e5e7eb"/>
            <w:left w:val="single" w:sz="4" w:color="e5e7eb"/>
            <w:bottom w:val="single" w:sz="4" w:color="e5e7eb"/>
            <w:right w:val="single" w:sz="4" w:color="e5e7eb"/>
            <w:insideH w:val="single" w:sz="4" w:color="e5e7eb"/>
            <w:insideV w:val="single" w:sz="4" w:color="e5e7eb"/>
          </w:tblBorders>`;
          rows.push(`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>${tblBorders}</w:tblPr>` +
            `<w:tr>${headerCells}</w:tr><w:tr>${dataCells}</w:tr></w:tbl>`);
          rows.push(para(''));
          break;
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" mc:Ignorable="w14 w15 wp14"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
<w:body>
${rows.join('\n')}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
</w:sectPr>
</w:body>
</w:document>`;
  };

  const exportDocx = async () => {
    setExporting(true);
    try {
      const zip = new PizZip();

      // _rels/.rels
      zip.file('_rels/.rels',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

      // [Content_Types].xml
      zip.file('[Content_Types].xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

      // word/_rels/document.xml.rels
      zip.file('word/_rels/document.xml.rels',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

      // word/styles.xml — basic styles
      zip.file('word/styles.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" w:latentStyleCount="371">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:after="160"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
</w:styles>`);

      // word/document.xml
      zip.file('word/document.xml', buildDocxXml());

      const blob = zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = uploadedFile ? uploadedFile.replace(/\.docx$/i, '') : 'template';
      a.download = `${baseName}_edited.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
      alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    }
    setExporting(false);
  };

  // Render preview block
  const renderPreviewBlock = (b: BuilderBlock) => {
    switch(b.type) {
      case 'heading':  return <h2 className="text-xl font-bold text-white tracking-wide mb-0">{b.content||'Heading'}</h2>;
      case 'text':     return <p className="text-sm text-zinc-300 leading-relaxed">{b.content||'Paragraph text…'}</p>;
      case 'field':    return <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-lime-400/30 bg-lime-400/5"><span className="text-lime-400 font-mono text-sm">{'{'+b.content+'}'}</span>{b.label && <span className="text-zinc-500 text-xs">({b.label})</span>}</div>;
      case 'image':    return <div className="flex items-center gap-2 p-3 rounded-xl border border-blue-400/20 bg-blue-400/5 w-fit"><Ico.img /><span className="text-blue-400 font-mono text-sm">{'{%'+b.content+'}'}</span>{b.label && <span className="text-zinc-500 text-xs">{b.label}</span>}</div>;
      case 'divider':  return <hr className="border-zinc-700 my-1"/>;
      case 'table': {
        const cols = (b.content||'col1,col2').split(',').map(c=>c.trim());
        return <div className="w-full overflow-x-auto"><table className="w-full text-xs border-collapse"><thead><tr>{cols.map(c=><th key={c} className="border border-zinc-700 px-3 py-1.5 text-left text-zinc-300 bg-zinc-800">{c}</th>)}</tr></thead><tbody><tr>{cols.map(c=><td key={c} className="border border-zinc-700 px-3 py-1.5 text-zinc-500 italic">{'{'}{c}{'}'}</td>)}</tr></tbody></table></div>;
      }
      default: return null;
    }
  };

  const selBlock = blocks.find(b => b.id === selected);

  return (
    <div className="grid grid-cols-[260px_1fr_300px] gap-5 h-full">

      {/* LEFT — Block palette */}
      <div className="flex flex-col gap-3">

        {/* Import DOCX */}
        <div className="card">
          <p className="card-title mb-3">Import DOCX</p>
          <div
            className="drop-zone py-5"
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.docx')) handleImportDocx(f); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => document.getElementById('builder-docx-input')?.click()}
          >
            {uploading ? (
              <>
                <span className="w-6 h-6 border-2 border-lime-400 border-t-transparent rounded-full animate-spin mb-2"/>
                <p className="text-xs text-zinc-400">Parsing template…</p>
              </>
            ) : uploadedFile ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-lime-400/10 border border-lime-400/20 flex items-center justify-center mb-2"><Ico.file /></div>
                <p className="text-xs text-lime-400 font-mono truncate max-w-full px-2">{uploadedFile}</p>
                <p className="text-xs text-zinc-600 mt-1">click to replace</p>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center mb-2"><Ico.upload /></div>
                <p className="text-xs font-medium text-white">Drop .docx to import</p>
                <p className="text-xs text-zinc-600 mt-1">Parses placeholders into blocks</p>
              </>
            )}
            <input id="builder-docx-input" type="file" accept=".docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportDocx(f); e.currentTarget.value=''; }}/>
          </div>
          <div className="mt-3">
            <label className="field-label">API Key (for analyze)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
              <input type="text" value={builderApiKey} onChange={e => setBuilderApiKey(e.target.value)}
                className="input pl-8 text-xs font-mono" placeholder="flowpdf_dev_key"/>
            </div>
          </div>
          {uploadedFile && (
            <button onClick={() => { setBlocks([]); setUploadedFile(null); setSelected(null); }}
              className="mt-2 w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-mono flex items-center justify-center gap-1">
              <Ico.x /> clear canvas
            </button>
          )}
        </div>

        <div className="card">
          <p className="card-title mb-3">Add Block</p>
          <div className="flex flex-col gap-1.5">
            {BLOCK_TYPES.map(bt => (
              <button key={bt.type} onClick={() => addBlock(bt.type)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all text-left group">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-400 transition-colors">{bt.icon}</div>
                <div>
                  <p className="text-xs font-medium text-zinc-300">{bt.label}</p>
                  <p className="text-xs text-zinc-600">{bt.desc}</p>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500"><Ico.plus /></div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="card-title mb-3">Export</p>

          {/* Primary — Download DOCX */}
          <button
            onClick={exportDocx}
            disabled={exporting || blocks.length === 0}
            className={`w-full h-10 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2 transition-all mb-2
              ${blocks.length > 0 && !exporting
                ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300 shadow-[0_0_20px_rgba(163,230,53,0.2)] active:scale-[0.98] cursor-pointer'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
          >
            {exporting
              ? <><span className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"/>Exporting…</>
              : <><Ico.download /> Download .docx</>}
          </button>

          {uploadedFile && (
            <p className="text-xs text-zinc-600 font-mono text-center mb-2">
              → saves as <span className="text-zinc-400">{uploadedFile.replace(/\.docx$/i,'')+"_edited.docx"}</span>
            </p>
          )}

          {/* Secondary — copy syntax */}
          <button onClick={copyTemplate} className="btn-secondary w-full flex items-center justify-center gap-2 text-xs">
            <Ico.code /> Copy Syntax Only
          </button>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Syntax uses <span className="text-zinc-400 font-mono">{'{field}'}</span> and <span className="text-zinc-400 font-mono">{'{%image}'}</span> — paste into any .docx manually.
          </p>
        </div>
      </div>

      {/* MIDDLE — Canvas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-mono font-bold text-zinc-300 uppercase tracking-wider">Canvas</h2>
            <span className="text-xs text-zinc-600">{blocks.length} blocks</span>
          </div>
          <button onClick={() => setPreview(p => !p)}
            className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-all border
              ${preview ? 'bg-lime-400/10 text-lime-400 border-lime-400/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'}`}>
            <Ico.eye /> {preview ? 'Preview ON' : 'Preview OFF'}
          </button>
        </div>

        <div className="card flex-1 overflow-y-auto" style={{minHeight:'500px'}}>
          {/* Document page mock */}
          <div className="bg-white rounded-xl p-8 min-h-full shadow-2xl">
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-300">
                <p className="text-sm">Add blocks from the left panel</p>
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map(b => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => handleDragStart(b.id)}
                    onDragEnter={() => handleDragEnterBlock(b.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => setSelected(b.id === selected ? null : b.id)}
                    className={`group relative rounded-lg transition-all cursor-pointer
                      ${selected === b.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-zinc-50'}`}
                    style={{ padding: '6px 8px' }}
                  >
                    {/* Block controls */}
                    <div className={`absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 transition-opacity ${selected === b.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <span className="text-zinc-400 cursor-grab active:cursor-grabbing"><Ico.drag /></span>
                    </div>
                    <div className={`absolute -right-8 top-1/2 -translate-y-1/2 transition-opacity ${selected === b.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button onClick={e => { e.stopPropagation(); removeBlock(b.id); }} className="w-6 h-6 rounded bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center transition-colors"><Ico.trash /></button>
                    </div>

                    {/* Type tag */}
                    <span className={`absolute top-1 right-1 text-xs font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity
                      ${selected === b.id ? 'opacity-100' : ''} bg-zinc-100 text-zinc-400`}>{b.type}</span>

                    {preview ? (
                      renderPreviewBlock(b)
                    ) : (
                      <div>
                        {b.type === 'heading'  && <div className="text-xl font-bold text-zinc-800">{b.content||<span className="text-zinc-300 italic">Heading…</span>}</div>}
                        {b.type === 'text'     && <div className="text-sm text-zinc-600 leading-relaxed">{b.content||<span className="italic text-zinc-300">Paragraph…</span>}</div>}
                        {b.type === 'field'    && <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50"><span className="text-emerald-600 font-mono text-sm font-bold">{'{'+b.content+'}'}</span>{b.label&&<span className="text-zinc-400 text-xs">{b.label}</span>}</div>}
                        {b.type === 'image'    && <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 w-fit"><span className="text-blue-400">🖼</span><span className="text-blue-600 font-mono text-sm">{'{%'+b.content+'}'}</span>{b.label&&<span className="text-zinc-400 text-xs">{b.label}</span>}</div>}
                        {b.type === 'divider'  && <hr className="border-zinc-300"/>}
                        {b.type === 'table'    && (() => { const cols=(b.content||'col1,col2').split(',').map(c=>c.trim()); return <table className="w-full text-xs border-collapse"><thead><tr>{cols.map(c=><th key={c} className="border border-zinc-200 px-3 py-1.5 text-left bg-zinc-100 text-zinc-700">{c}</th>)}</tr></thead><tbody><tr>{cols.map(c=><td key={c} className="border border-zinc-200 px-3 py-1.5 text-zinc-400 italic">{'{'}{c}{'}'}</td>)}</tr></tbody></table>; })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — Properties panel */}
      <div className="flex flex-col gap-3">
        <div className="card flex-1">
          <p className="card-title mb-3">Properties</p>
          {!selBlock ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Ico.cursor />
              <p className="text-xs text-zinc-600 text-center font-mono">Click a block to edit its properties</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-xs font-mono text-zinc-400 border border-zinc-700">{selBlock.type}</span>
                <span className="text-xs text-zinc-600">block</span>
              </div>

              {/* Content */}
              {selBlock.type !== 'divider' && (
                <div>
                  <label className="field-label">
                    {selBlock.type === 'field' ? 'Variable Name' : selBlock.type === 'image' ? 'Image Key' : selBlock.type === 'table' ? 'Columns (comma-separated)' : 'Content'}
                  </label>
                  {selBlock.type === 'text' ? (
                    <textarea
                      value={selBlock.content}
                      onChange={e => updateBlock(selBlock.id, { content: e.target.value })}
                      rows={5}
                      className="input text-sm resize-none w-full"
                    />
                  ) : (
                    <input
                      type="text"
                      value={selBlock.content}
                      onChange={e => updateBlock(selBlock.id, { content: e.target.value })}
                      className="input text-sm w-full"
                    />
                  )}
                  {(selBlock.type === 'field' || selBlock.type === 'image') && (
                    <p className="text-xs text-zinc-600 mt-1 font-mono">
                      → template: <span className="text-lime-400">{selBlock.type === 'image' ? '{%'+selBlock.content+'}' : '{'+selBlock.content+'}'}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Label */}
              {(selBlock.type === 'field' || selBlock.type === 'image' || selBlock.type === 'table') && (
                <div>
                  <label className="field-label">Display Label</label>
                  <input type="text" value={selBlock.label||''} onChange={e => updateBlock(selBlock.id, { label: e.target.value })} className="input text-sm w-full" placeholder="Human-readable label"/>
                </div>
              )}

              {/* Image size hint */}
              {selBlock.type === 'image' && (
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <p className="text-xs font-mono text-blue-400 mb-1">Size hints (docxService.ts)</p>
                  <p className="text-xs text-zinc-500">signature → 150×50px</p>
                  <p className="text-xs text-zinc-500">logo → 120×60px</p>
                  <p className="text-xs text-zinc-500">other → 150×100px</p>
                </div>
              )}

              {/* Delete */}
              <button onClick={() => removeBlock(selBlock.id)} className="flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 rounded-xl py-2.5 transition-all mt-auto">
                <Ico.trash /> Remove Block
              </button>
            </div>
          )}
        </div>

        {/* Template syntax output */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="card-title text-xs">Template Syntax</p>
            <button onClick={copyTemplate} className="text-xs text-zinc-500 hover:text-zinc-300 font-mono flex items-center gap-1 transition-colors"><Ico.code /> copy</button>
          </div>
          <pre className="text-xs font-mono text-zinc-500 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-zinc-950 rounded-lg p-3 border border-zinc-800">
            {generateTemplate() || '— empty —'}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('render');

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-8 h-14 flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center shadow-[0_0_12px_rgba(163,230,53,0.4)]">
              <span className="text-zinc-950 font-bold text-xs font-mono">F</span>
            </div>
            <span className="font-bold text-white text-base tracking-tight">FlowPDF</span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1 ml-2">
            {([
              { id: 'render',  label: 'Render',          icon: <Ico.zap /> },
              { id: 'builder', label: 'Template Builder', icon: <Ico.cursor /> },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-all font-medium
                  ${tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse"/>
              <span className="text-xs text-zinc-500 font-mono">v1.0.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-6">
        {tab === 'render'  && <RenderTab />}
        {tab === 'builder' && <BuilderTab />}
      </main>
    </div>
  );
}
