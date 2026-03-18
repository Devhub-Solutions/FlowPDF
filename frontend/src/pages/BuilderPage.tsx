import { useEffect, useRef, useState } from 'react';
import PizZip from 'pizzip';
import { analyzePlaceholders, previewPdf } from '../services/api';
import { Ico } from '../components/icons/Ico';
import { uid } from '../utils/uid';
import type { BuilderBlock } from '../types';

const BLOCK_TYPES: { type: BuilderBlock['type']; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'heading', label: 'Heading', icon: <span className="font-bold text-sm">H</span>, desc: 'Title, section header' },
  { type: 'text', label: 'Paragraph', icon: <span className="text-xs">¶</span>, desc: 'Body text, descriptions' },
  { type: 'field', label: 'Field', icon: <span className="font-mono text-xs">{'{}'}</span>, desc: 'Dynamic placeholder' },
  { type: 'image', label: 'Image', icon: <Ico.img />, desc: 'Logo, signature, photo' },
  { type: 'divider', label: 'Divider', icon: <span className="text-lg leading-none">-</span>, desc: 'Horizontal rule' },
  { type: 'table', label: 'Table', icon: <span className="text-xs">[]</span>, desc: 'Row/col data table' },
];

async function parseDocxIntoBlocks(file: File, apiKey: string): Promise<BuilderBlock[]> {
  let placeholders: string[] = [];
  try {
    const res = await analyzePlaceholders(file, apiKey);
    placeholders = res.placeholders;
  } catch {
    // ignore
  }

  const blocks: BuilderBlock[] = [];
  blocks.push({ id: uid(), type: 'heading', content: file.name.replace(/\.docx$/i, '').replace(/[-_]/g, ' ').toUpperCase() });

  const textPhs = placeholders.filter((p) => !p.startsWith('%'));
  const imgPhs = placeholders.filter((p) => p.startsWith('%')).map((p) => p.slice(1));

  if (textPhs.length > 0) {
    blocks.push({ id: uid(), type: 'text', content: 'Document content with the following fields:' });
    textPhs.forEach((ph) => {
      blocks.push({ id: uid(), type: 'field', content: ph, label: ph.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) });
    });
  }

  if (imgPhs.length > 0) {
    blocks.push({ id: uid(), type: 'divider', content: '' });
    imgPhs.forEach((key) => {
      blocks.push({ id: uid(), type: 'image', content: key, label: key.charAt(0).toUpperCase() + key.slice(1) });
    });
  }

  if (blocks.length === 1) {
    blocks.push({ id: uid(), type: 'text', content: 'No placeholders detected. Add {field} syntax to your template.' });
  }

  return blocks;
}

export default function BuilderPage() {
  const [blocks, setBlocks] = useState<BuilderBlock[]>([
    { id: uid(), type: 'heading', content: 'CONTRACT AGREEMENT' },
    { id: uid(), type: 'field', content: 'client_name', label: 'Client Name' },
    { id: uid(), type: 'field', content: 'date', label: 'Date' },
    { id: uid(), type: 'text', content: 'This agreement is entered into between the parties listed above.' },
    { id: uid(), type: 'field', content: 'amount', label: 'Amount' },
    { id: uid(), type: 'divider', content: '' },
    { id: uid(), type: 'image', content: 'signature', label: 'Signature' },
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [builderApiKey, setBuilderApiKey] = useState('flowpdf_dev_key');
  const [exporting, setExporting] = useState(false);

  // PDF preview state
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<Record<string, string>>({});

  const dragId = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  // Derive field blocks for sample data panel
  const fieldBlocks = blocks.filter((b) => b.type === 'field');

  // Revoke PDF blob URL whenever it changes (cleans up the previous one) and on unmount
  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

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
      heading: { content: 'New Heading' },
      text: { content: 'Enter paragraph text here...' },
      field: { content: 'field_name', label: 'Field Label' },
      image: { content: 'image_key', label: 'Image' },
      divider: { content: '' },
      table: { content: 'col1,col2,col3', label: 'Table Columns' },
    };
    const nb: BuilderBlock = { id: uid(), type, ...defaults[type] } as BuilderBlock;
    setBlocks((b) => [...b, nb]);
    setSelected(nb.id);
  };

  const updateBlock = (id: string, patch: Partial<BuilderBlock>) => {
    setBlocks((b) => b.map((bl) => (bl.id === id ? { ...bl, ...patch } : bl)));
  };

  const removeBlock = (id: string) => {
    setBlocks((b) => b.filter((bl) => bl.id !== id));
    if (selected === id) setSelected(null);
  };

  const handleDragStart = (id: string) => { dragId.current = id; };
  const handleDragEnterBlock = (id: string) => { dragOver.current = id; };
  const handleDrop = () => {
    if (!dragId.current || !dragOver.current || dragId.current === dragOver.current) return;
    setBlocks((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((b) => b.id === dragId.current);
      const toIdx = arr.findIndex((b) => b.id === dragOver.current);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    dragId.current = null;
    dragOver.current = null;
  };

  const generateTemplate = () => {
    const lines = blocks.map((b) => {
      if (b.type === 'heading') return `# ${b.content}`;
      if (b.type === 'text') return b.content;
      if (b.type === 'field') return `{${b.content}}`;
      if (b.type === 'image') return `{%${b.content}}`;
      if (b.type === 'divider') return '--------------------------------';
      if (b.type === 'table') return `| ${(b.content || '').split(',').join(' | ')} |`;
      return '';
    });
    return lines.join('\n\n');
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(generateTemplate());
  };

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
        case 'field':
          rows.push(para(run((b.label ? b.label + ': ' : ''), false, 24, '555555') + run('{' + (b.content || 'field') + '}', false, 24, '166534')));
          break;
        case 'image':
          rows.push(para(run('{%' + (b.content || 'image') + '}', false, 24, '1d4ed8')));
          rows.push(para(''));
          break;
        case 'divider':
          rows.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="cccccc"/></w:pBdr></w:pPr></w:p>');
          break;
        case 'table': {
          const cols = (b.content || 'col1,col2').split(',').map((c) => c.trim());
          const cellW = Math.floor(9360 / cols.length);
          const headerCells = cols.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${esc(c)}</w:t></w:r></w:p></w:tc>`).join('');
          rows.push(`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/></w:tblPr><w:tr>${headerCells}</w:tr></w:tbl>`);
          rows.push(para(''));
          break;
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${rows.join('\n')}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;
  };

  /** Build a DOCX Blob from current blocks (reused by both export and preview) */
  const buildDocxBlob = (): Blob => {
    const zip = new PizZip();
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.file('word/document.xml', buildDocxXml());
    return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  };

  const exportDocx = async () => {
    setExporting(true);
    try {
      const blob = buildDocxBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = uploadedFile ? uploadedFile.replace(/\.docx$/i, '') : 'template';
      a.download = `${baseName}_edited.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
    setExporting(false);
  };

  const handleGeneratePreview = async () => {
    setPreviewStatus('loading');
    setPreviewError(null);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
    try {
      const docxBlob = buildDocxBlob();
      const docxFile = new File([docxBlob], 'template.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Build data map: use filled sample values or fallback placeholder text
      const dataForPreview: Record<string, string> = {};
      fieldBlocks.forEach((b) => {
        dataForPreview[b.content] = sampleData[b.content] || `[${b.label || b.content}]`;
      });

      const base64Pdf = await previewPdf({ template: docxFile, data: dataForPreview, apiKey: builderApiKey });

      // Convert base64 → Blob URL for reliable iframe display
      const bytes = atob(base64Pdf);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const pdfBlob = new Blob([arr], { type: 'application/pdf' });
      setPreviewPdfUrl(URL.createObjectURL(pdfBlob));
      setPreviewStatus('success');
    } catch (e) {
      console.error('Preview failed', e);
      setPreviewError(e instanceof Error ? e.message : 'Preview generation failed');
      setPreviewStatus('error');
    }
  };

  const renderBlockInCanvas = (b: BuilderBlock) => {
    switch (b.type) {
      case 'heading':
        return <div className="text-xl font-bold text-zinc-800 leading-tight">{b.content || 'Heading'}</div>;
      case 'text':
        return <div className="text-sm text-zinc-600 leading-relaxed">{b.content || 'Paragraph text...'}</div>;
      case 'field':
        return (
          <div className="flex items-center gap-2">
            {b.label && <span className="text-xs text-zinc-400">{b.label}:</span>}
            <span className="text-emerald-600 font-mono text-sm bg-emerald-50 px-1.5 py-0.5 rounded">{'{' + b.content + '}'}</span>
          </div>
        );
      case 'image':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Ico.img />
            <span className="font-mono text-sm bg-blue-50 px-1.5 py-0.5 rounded">{'{%' + b.content + '}'}</span>
            {b.label && <span className="text-xs text-zinc-400">({b.label})</span>}
          </div>
        );
      case 'divider':
        return <hr className="border-zinc-300" />;
      case 'table': {
        const cols = (b.content || 'col1,col2').split(',').map((c) => c.trim());
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>{cols.map((c) => <th key={c} className="border border-zinc-200 px-3 py-1.5 text-left text-zinc-600 bg-zinc-50">{c}</th>)}</tr>
              </thead>
            </table>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const selBlock = blocks.find((b) => b.id === selected);
  const canPreview = blocks.length > 0 && previewStatus !== 'loading';

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        {/* Import DOCX */}
        <button
          onClick={() => document.getElementById('builder-docx-input')?.click()}
          disabled={uploading}
          className="flex items-center gap-2 btn-secondary text-xs px-3 py-2"
        >
          {uploading
            ? <><span className="w-3.5 h-3.5 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" /> Parsing...</>
            : <><Ico.upload /> {uploadedFile ? <span className="text-lime-400 font-mono truncate max-w-[120px]">{uploadedFile}</span> : 'Import .docx'}</>}
        </button>
        <input id="builder-docx-input" type="file" accept=".docx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportDocx(f); e.currentTarget.value = ''; }}
        />

        {/* Add block buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {BLOCK_TYPES.map((bt) => (
            <button key={bt.type} onClick={() => addBlock(bt.type)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-700/60 text-zinc-300 text-xs transition-all"
              title={bt.desc}
            >
              <span className="text-zinc-400">{bt.icon}</span>{bt.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* API Key */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
          <input type="text" value={builderApiKey} onChange={(e) => setBuilderApiKey(e.target.value)}
            className="input pl-8 text-xs font-mono w-44 py-2" placeholder="API key" />
        </div>

        {/* Export */}
        <button onClick={exportDocx} disabled={exporting || blocks.length === 0}
          className={`flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl transition-all ${blocks.length > 0 && !exporting ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
          {exporting ? 'Exporting...' : <><Ico.download /> .docx</>}
        </button>
        <button onClick={copyTemplate} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2">
          <Ico.code /> Syntax
        </button>
      </div>

      {/* ── Main two-column area ─────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[1fr_380px] gap-4 min-h-0">

        {/* Left: Document Editor */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">Document Editor</h2>
            <span className="text-xs text-zinc-600">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-zinc-700">· drag to reorder · click to edit</span>
          </div>

          {/* Paper canvas */}
          <div className="card flex-1 overflow-y-auto p-3" style={{ minHeight: '420px' }}>
            <div className="bg-white rounded-lg shadow-xl mx-auto" style={{ maxWidth: '680px', minHeight: '100%', padding: '48px 56px' }}>
              {blocks.length === 0 && (
                <p className="text-zinc-400 text-sm text-center py-16">No blocks yet — use the toolbar above to add content.</p>
              )}
              <div className="space-y-3">
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => handleDragStart(b.id)}
                    onDragEnter={() => handleDragEnterBlock(b.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => setSelected(b.id === selected ? null : b.id)}
                    className={`group relative rounded-lg transition-all cursor-pointer px-2 py-1.5 ${
                      selected === b.id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-zinc-50 hover:ring-1 hover:ring-zinc-200'
                    }`}
                  >
                    {/* Drag handle */}
                    <span className="absolute left-[-18px] top-1/2 -translate-y-1/2 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Ico.drag />
                    </span>
                    {renderBlockInCanvas(b)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inline properties panel (shown when a block is selected) */}
          {selBlock && (
            <div className="card p-3 flex items-end gap-3 flex-wrap animate-fade-up">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-500 uppercase">
                  {selBlock.type}
                </span>
              </div>
              {selBlock.type !== 'divider' && (
                <div className="flex-1 min-w-[160px]">
                  <label className="field-label">Content</label>
                  <input
                    type="text"
                    value={selBlock.content}
                    onChange={(e) => updateBlock(selBlock.id, { content: e.target.value })}
                    className="input text-sm"
                  />
                </div>
              )}
              {(selBlock.type === 'field' || selBlock.type === 'image' || selBlock.type === 'table') && (
                <div className="flex-1 min-w-[140px]">
                  <label className="field-label">Label</label>
                  <input
                    type="text"
                    value={selBlock.label || ''}
                    onChange={(e) => updateBlock(selBlock.id, { label: e.target.value })}
                    className="input text-sm"
                    placeholder="Human-readable label"
                  />
                </div>
              )}
              <button
                onClick={() => removeBlock(selBlock.id)}
                className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/20 rounded-xl px-3 py-2.5 hover:bg-red-500/10 transition-colors"
              >
                <Ico.trash /> Remove
              </button>
            </div>
          )}
        </div>

        {/* Right: PDF Preview */}
        <div className="flex flex-col gap-3 min-h-0">
          <h2 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">PDF Preview</h2>

          {/* Sample data inputs */}
          <div className="card">
            <p className="card-title mb-3">Sample Data</p>
            {fieldBlocks.length === 0 ? (
              <p className="text-xs text-zinc-600 font-mono">Add {'{field}'} blocks to fill sample values.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {fieldBlocks.map((b) => (
                  <div key={b.id}>
                    <label className="field-label">{b.label || b.content}</label>
                    <input
                      type="text"
                      value={sampleData[b.content] ?? ''}
                      onChange={(e) => setSampleData((prev) => ({ ...prev, [b.content]: e.target.value }))}
                      className="input text-sm"
                      placeholder={`[${b.content}]`}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleGeneratePreview}
              disabled={!canPreview}
              className={`mt-4 w-full h-10 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                canPreview
                  ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {previewStatus === 'loading'
                ? <><span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" /> Rendering...</>
                : <><Ico.eye /> Generate Preview</>}
            </button>

            {previewStatus === 'error' && previewError && (
              <p className="mt-2 text-xs text-red-400 font-mono">{previewError}</p>
            )}
          </div>

          {/* PDF viewer */}
          <div className="card flex-1 flex flex-col min-h-0 p-2">
            {previewStatus === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                  <Ico.eye />
                </div>
                <p className="text-xs text-zinc-500">Fill sample data and click<br /><span className="text-lime-400 font-mono">Generate Preview</span> to render the PDF.</p>
              </div>
            )}
            {previewStatus === 'loading' && (
              <div className="flex-1 flex items-center justify-center">
                <span className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {previewStatus === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <p className="text-xs text-red-400 font-mono text-center">Render failed.<br />Check that the API is running and the API key is correct.</p>
                <button onClick={handleGeneratePreview} className="btn-secondary text-xs px-3 py-1.5">Retry</button>
              </div>
            )}
            {previewStatus === 'success' && previewPdfUrl && (
              <div className="flex flex-col gap-2 h-full min-h-0">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-lime-400 font-mono flex items-center gap-1"><Ico.check /> PDF ready</span>
                  <a
                    href={previewPdfUrl}
                    download="preview.pdf"
                    className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1.5"
                  >
                    <Ico.download /> Download
                  </a>
                </div>
                <iframe
                  src={previewPdfUrl}
                  className="flex-1 rounded-xl border border-zinc-700 bg-white"
                  style={{ minHeight: '400px' }}
                  title="PDF Preview"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
