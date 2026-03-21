import { useState } from 'react';
import { combinePdfs } from '../services/api';
import { Ico } from '../components/icons/Ico';
import { StepBadge } from '../components/ui/StepBadge';

const ACCEPTED_MERGE_TYPES = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,.bmp,.gif,.doc,.docx';

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState('flowpdf_dev_key');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => {
      const combined = [...prev, ...arr];
      if (combined.length > 20) {
        setError(`Maximum 20 files allowed. ${combined.length - 20} file(s) were not added.`);
        return combined.slice(0, 20);
      }
      return combined;
    });
    setPdfUrl(null);
    setStatus('idle');
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPdfUrl(null);
    setStatus('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const handleReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setPdfUrl(null);
    setStatus('idle');
  };

  const handleMerge = async () => {
    if (files.length === 0) return;
    setStatus('loading');
    setError(null);
    setPdfUrl(null);
    try {
      const blob = await combinePdfs(files, null, apiKey);
      setPdfUrl(URL.createObjectURL(blob));
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed');
      setStatus('error');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff'].includes(ext)) return 'IMG';
    if (['doc', 'docx'].includes(ext)) return 'DOC';
    return 'FILE';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full">
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="card-header">
            <StepBadge n={1} done={files.length > 0} />
            <span className="card-title">Upload Files</span>
            <span className="text-xs text-zinc-600 ml-auto">{files.length}/20 files</span>
          </div>
          <div className="drop-zone" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => document.getElementById('merge-input')?.click()}>
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors"><Ico.upload /></div>
            <p className="text-sm font-medium text-white">Drop files here or click to browse</p>
            <p className="text-xs text-zinc-500 mt-1">PDF, Images, DOC, DOCX</p>
            <input id="merge-input" type="file" accept={ACCEPTED_MERGE_TYPES} multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {files.length > 0 && (
          <div className="card flex-1">
            <div className="card-header">
              <StepBadge n={2} done={files.length >= 1} />
              <span className="card-title">File Order</span>
              <span className="text-xs text-zinc-600 ml-auto">drag to reorder</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDragEnd={() => {
                    if (dragIdx !== null && dragOverIdx !== null) handleReorder(dragIdx, dragOverIdx);
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${dragOverIdx === idx ? 'border-lime-400/40 bg-lime-400/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                >
                  <span className="text-zinc-600 flex-shrink-0"><Ico.drag /></span>
                  <span className="text-[10px] text-zinc-500 font-mono w-8">{getFileIcon(file.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-300 truncate">{file.name}</p>
                    <p className="text-xs text-zinc-600">{formatSize(file.size)}</p>
                  </div>
                  <span className="text-xs text-zinc-600 font-mono flex-shrink-0">#{idx + 1}</span>
                  <button onClick={() => removeFile(idx)} className="icon-btn hover:text-red-400 flex-shrink-0"><Ico.x /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <StepBadge n={3} done={!!apiKey} />
            <span className="card-title">API Key</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="input pl-9 font-mono text-sm" placeholder="flowpdf_dev_key" />
          </div>
        </div>

        <button
          onClick={handleMerge}
          disabled={files.length === 0 || status === 'loading'}
          className={`h-13 rounded-2xl font-mono font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${files.length > 0 && status !== 'loading' ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.25)] active:scale-[0.98] cursor-pointer' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
        >
          {status === 'loading' ? <><span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />Merging...</> : <><Ico.merge /> Merge to PDF</>}
        </button>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400 font-mono leading-relaxed">⚠ {error}</div>}
      </div>

      <div className="card flex flex-col min-h-[520px]">
        <div className="card-header flex-shrink-0">
          <span className="flex items-center gap-1.5 text-zinc-500"><Ico.eye /><span className="card-title">Preview</span></span>
          {status === 'success' && <span className="px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 text-xs font-mono ml-2">ready</span>}
          {status === 'success' && (
            <button onClick={() => { if (!pdfUrl) return; const a = document.createElement('a'); a.href = pdfUrl; a.download = 'combined.pdf'; a.click(); }} className="ml-auto flex items-center gap-1.5 text-xs font-mono text-lime-400 hover:text-lime-300 px-3 py-1.5 rounded-lg bg-lime-400/10 hover:bg-lime-400/20 transition-colors">
              <Ico.download /> download
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden rounded-xl">
          {pdfUrl ? <iframe src={pdfUrl} className="w-full h-full border-0 rounded-xl" title="Merged PDF Preview" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600 font-mono text-xs">upload files to start</div>}
        </div>
      </div>
    </div>
  );
}
