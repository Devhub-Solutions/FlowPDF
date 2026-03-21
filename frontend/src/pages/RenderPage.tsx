import { useEffect, useMemo, useState } from 'react';
import { analyzePlaceholders, renderToPdf } from '../services/api';
import { Ico } from '../components/icons/Ico';
import { StepBadge } from '../components/ui/StepBadge';
import type { RenderMode } from '../types';

export default function RenderPage() {
  const [renderMode, setRenderMode] = useState<RenderMode>('template');
  const [template, setTemplate] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState('{\n  "name": "Nguyen Van A",\n  "company": "FlowPDF Inc.",\n  "date": "2025-01-15",\n  "amount": "5,000,000 VND"\n}');
  const [images, setImages] = useState<Record<string, File>>({});
  const [apiKey, setApiKey] = useState('flowpdf_dev_key');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [htmlInput, setHtmlInput] = useState('');
  const [urlInput, setUrlInput] = useState('');

  const isJsonValid = (() => {
    try {
      JSON.parse(jsonData);
      return true;
    } catch {
      return false;
    }
  })();

  const imagePreviews = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const [key, file] of Object.entries(images)) {
      urls[key] = URL.createObjectURL(file);
    }
    return urls;
  }, [images]);

  useEffect(() => {
    return () => {
      Object.values(imagePreviews).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imagePreviews]);

  const handleTemplateUpload = async (file: File) => {
    setTemplate(file);
    setAnalyzing(true);
    setPlaceholders([]);
    setPdfUrl(null);
    setStatus('idle');

    try {
      const result = await analyzePlaceholders(file, apiKey);
      const detected = result.placeholders.filter((p) => !p.startsWith('%'));
      if (detected.length > 0) {
        const obj: Record<string, string> = {};
        detected.forEach((p) => {
          obj[p] = `<${p}>`;
        });
        setJsonData(JSON.stringify(obj, null, 2));
      }
      setPlaceholders(result.placeholders);
    } catch {
      // ignore analyze failures
    }

    setAnalyzing(false);
  };

  const handleGenerate = async () => {
    setStatus('loading');
    setError(null);
    setPdfUrl(null);

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

  const textFields = placeholders.filter((p) => !p.startsWith('%'));
  const imgFields = placeholders.filter((p) => p.startsWith('%'));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr] gap-5 h-full">
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Source</span>
          </div>
          <div className="flex gap-1.5">
            {([
              ['template', 'DOCX'],
              ['html', 'HTML'],
              ['url', 'URL'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => {
                  setRenderMode(mode);
                  setPdfUrl(null);
                  setStatus('idle');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all
                  ${renderMode === mode ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {renderMode === 'template' && (
          <>
            <div className="card">
              <div className="card-header">
                <StepBadge n={1} done={!!template} />
                <span className="card-title">DOCX Template</span>
                {analyzing && (
                  <span className="ml-auto text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-lime-400 border-t-transparent rounded-full animate-spin inline-block" />
                    scanning...
                  </span>
                )}
              </div>

              {!template ? (
                <div
                  className="drop-zone"
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f?.name.endsWith('.docx')) handleTemplateUpload(f);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => document.getElementById('tpl-input')?.click()}
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors">
                    <Ico.upload />
                  </div>
                  <p className="text-sm font-medium text-white">Drop .docx here or click</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Use <code className="text-lime-400 font-mono">{'{placeholder}'}</code> and{' '}
                    <code className="text-lime-400 font-mono">{'{%image}'}</code>
                  </p>
                  <input
                    id="tpl-input"
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleTemplateUpload(f);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-1">
                  <div className="w-8 h-8 rounded-lg bg-lime-400/10 border border-lime-400/20 flex items-center justify-center flex-shrink-0">
                    <Ico.file />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{template.name}</p>
                    <p className="text-xs text-zinc-500">{(template.size / 1024).toFixed(1)} KB · {placeholders.length} vars</p>
                  </div>
                  <button
                    onClick={() => {
                      setTemplate(null);
                      setPlaceholders([]);
                      setPdfUrl(null);
                      setStatus('idle');
                    }}
                    className="icon-btn hover:text-red-400"
                  >
                    <Ico.x />
                  </button>
                </div>
              )}

              {placeholders.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">Variables</p>
                  <div className="flex flex-wrap gap-1.5">
                    {textFields.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded bg-zinc-800 text-lime-400 text-xs font-mono border border-zinc-700">
                        {'{' + p + '}'}
                      </span>
                    ))}
                    {imgFields.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono border border-blue-500/20">
                        {'{' + p + '}'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <StepBadge n={2} done={!!apiKey} />
                <span className="card-title">API Key</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input pl-9 font-mono text-sm"
                  placeholder="flowpdf_dev_key"
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <StepBadge n={3} done={Object.keys(images).length > 0} />
                <span className="card-title">Images</span>
                <span className="text-xs text-zinc-600 ml-auto">optional</span>
              </div>

              {imgFields.length === 0 && template && (
                <p className="text-xs text-zinc-600 mb-2">
                  Use <code className="text-lime-400 font-mono">{'{%signature}'}</code>,{' '}
                  <code className="text-lime-400 font-mono">{'{%logo}'}</code>, etc. in template to embed images
                </p>
              )}

              <div className="flex flex-col gap-2">
                {(imgFields.length > 0
                  ? imgFields.map((p) => p.replace(/^%/, ''))
                  : ['signature', 'logo', 'image1', 'image2', 'image3']
                ).map((field) => (
                  <label key={field} className="cursor-pointer">
                    <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all
                      ${images[field] ? 'border-lime-400/30 bg-lime-400/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}>
                      {imagePreviews[field] ? (
                        <img src={imagePreviews[field]} alt={field} className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-lime-400/20" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0"><Ico.img /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-zinc-300 capitalize">{field}</p>
                        <p className="text-xs text-zinc-600 truncate">{images[field] ? images[field].name : 'click to upload'}</p>
                      </div>
                      {images[field] && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            const next = { ...images };
                            delete next[field];
                            setImages(next);
                          }}
                          className="icon-btn hover:text-red-400"
                        >
                          <Ico.x />
                        </button>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setImages({ ...images, [field]: f });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {renderMode === 'html' && (
          <div className="card flex-1 flex flex-col">
            <div className="card-header">
              <StepBadge n={1} done={!!htmlInput.trim()} />
              <span className="card-title">HTML Content</span>
            </div>
            <textarea
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-4 bg-zinc-950 rounded-xl text-xs font-mono leading-relaxed text-orange-300 border border-zinc-800 focus:border-zinc-600 focus:outline-none resize-none transition-colors min-h-[280px]"
              placeholder="<h1>Hello World</h1><p>Your HTML here...</p>"
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
              onChange={(e) => setUrlInput(e.target.value)}
              className="input font-mono text-sm"
              placeholder="https://example.com"
            />
            <p className="text-xs text-zinc-600 mt-2">Enter a URL to convert the web page to PDF</p>
          </div>
        )}
      </div>

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
              onChange={(e) => setJsonData(e.target.value)}
              spellCheck={false}
              className={`flex-1 w-full p-4 bg-zinc-950 rounded-xl text-xs font-mono leading-relaxed text-emerald-300 border focus:outline-none resize-none transition-colors min-h-[280px] ${isJsonValid ? 'border-zinc-800 focus:border-zinc-600' : 'border-red-500/40'}`}
              placeholder='{ "key": "value" }'
            />
          </div>
        )}

        {renderMode !== 'template' && <div className="flex-1" />}

        <button
          onClick={handleGenerate}
          disabled={
            (renderMode === 'template' && (!template || !isJsonValid)) ||
            (renderMode === 'html' && !htmlInput.trim()) ||
            (renderMode === 'url' && !urlInput.trim()) ||
            status === 'loading'
          }
          className={`h-13 rounded-2xl font-mono font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all
            ${((renderMode === 'template' && template && isJsonValid) || (renderMode === 'html' && htmlInput.trim()) || (renderMode === 'url' && urlInput.trim())) && status !== 'loading' ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.25)] active:scale-[0.98] cursor-pointer' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
        >
          {status === 'loading' ? (
            <><span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />Rendering...</>
          ) : (
            <><Ico.zap /> Generate PDF</>
          )}
        </button>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400 font-mono leading-relaxed">⚠ {error}</div>
        )}
      </div>

      <div className="card flex flex-col min-h-[400px] md:min-h-[520px]">
        <div className="card-header flex-shrink-0">
          <span className="flex items-center gap-1.5 text-zinc-500"><Ico.eye /><span className="card-title">Preview</span></span>
          {status === 'success' && <span className="px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 text-xs font-mono ml-2">ready</span>}
          {status === 'success' && (
            <button
              onClick={() => {
                if (!pdfUrl) return;
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.download = 'document.pdf';
                a.click();
              }}
              className="ml-auto flex items-center gap-1.5 text-xs font-mono text-lime-400 hover:text-lime-300 px-3 py-1.5 rounded-lg bg-lime-400/10 hover:bg-lime-400/20 transition-colors"
            >
              <Ico.download /> download
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden rounded-xl">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0 rounded-xl" title="PDF Preview" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
              {status === 'loading' ? (
                <>
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-2 border-lime-400/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-lime-400 animate-spin" />
                    <div className="absolute inset-2 rounded-full border border-t-lime-400/40 animate-spin" style={{ animationDuration: '2s' }} />
                  </div>
                  <p className="text-sm text-zinc-400 font-mono">Rendering PDF...</p>
                </>
              ) : (
                <>
                  <div className="w-32 opacity-10 space-y-1.5">
                    <div className="h-2 bg-zinc-600 rounded w-full" />
                    {[80, 90, 70, 85, 65, 75, 80, 60].map((w, i) => (
                      <div key={i} className="h-1.5 bg-zinc-700 rounded" style={{ width: `${w}%` }} />
                    ))}
                    <div className="h-12 bg-zinc-800 rounded mt-3" />
                    {[70, 85, 65].map((w, i) => (
                      <div key={i} className="h-1.5 bg-zinc-700 rounded mt-1.5" style={{ width: `${w}%` }} />
                    ))}
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
