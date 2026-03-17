import { useRef, useState } from 'react';
import PizZip from 'pizzip';
import { analyzePlaceholders } from '../services/api';
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
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [builderApiKey, setBuilderApiKey] = useState('flowpdf_dev_key');
  const [exporting, setExporting] = useState(false);

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

  const exportDocx = async () => {
    setExporting(true);
    try {
      const zip = new PizZip();
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
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
    }
    setExporting(false);
  };

  const renderPreviewBlock = (b: BuilderBlock) => {
    switch (b.type) {
      case 'heading': return <h2 className="text-xl font-bold text-white tracking-wide mb-0">{b.content || 'Heading'}</h2>;
      case 'text': return <p className="text-sm text-zinc-300 leading-relaxed">{b.content || 'Paragraph text...'}</p>;
      case 'field': return <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-lime-400/30 bg-lime-400/5"><span className="text-lime-400 font-mono text-sm">{'{' + b.content + '}'}</span>{b.label && <span className="text-zinc-500 text-xs">({b.label})</span>}</div>;
      case 'image': return <div className="flex items-center gap-2 p-3 rounded-xl border border-blue-400/20 bg-blue-400/5 w-fit"><Ico.img /><span className="text-blue-400 font-mono text-sm">{'{%'+b.content+'}'}</span></div>;
      case 'divider': return <hr className="border-zinc-700 my-1" />;
      case 'table': {
        const cols = (b.content || 'col1,col2').split(',').map((c) => c.trim());
        return <div className="w-full overflow-x-auto"><table className="w-full text-xs border-collapse"><thead><tr>{cols.map((c) => <th key={c} className="border border-zinc-700 px-3 py-1.5 text-left text-zinc-300 bg-zinc-800">{c}</th>)}</tr></thead></table></div>;
      }
      default: return null;
    }
  };

  const selBlock = blocks.find((b) => b.id === selected);

  return (
    <div className="grid grid-cols-[260px_1fr_300px] gap-5 h-full">
      <div className="flex flex-col gap-3">
        <div className="card">
          <p className="card-title mb-3">Import DOCX</p>
          <div className="drop-zone py-5" onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.docx')) handleImportDocx(f); }} onDragOver={(e) => e.preventDefault()} onClick={() => document.getElementById('builder-docx-input')?.click()}>
            {uploading ? <><span className="w-6 h-6 border-2 border-lime-400 border-t-transparent rounded-full animate-spin mb-2" /><p className="text-xs text-zinc-400">Parsing template...</p></> : uploadedFile ? <><div className="w-8 h-8 rounded-lg bg-lime-400/10 border border-lime-400/20 flex items-center justify-center mb-2"><Ico.file /></div><p className="text-xs text-lime-400 font-mono truncate max-w-full px-2">{uploadedFile}</p><p className="text-xs text-zinc-600 mt-1">click to replace</p></> : <><div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center mb-2"><Ico.upload /></div><p className="text-xs font-medium text-white">Drop .docx to import</p></>}
            <input id="builder-docx-input" type="file" accept=".docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportDocx(f); e.currentTarget.value = ''; }} />
          </div>
          <div className="mt-3">
            <label className="field-label">API Key (for analyze)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
              <input type="text" value={builderApiKey} onChange={(e) => setBuilderApiKey(e.target.value)} className="input pl-8 text-xs font-mono" placeholder="flowpdf_dev_key" />
            </div>
          </div>
        </div>

        <div className="card">
          <p className="card-title mb-3">Add Block</p>
          <div className="flex flex-col gap-1.5">
            {BLOCK_TYPES.map((bt) => (
              <button key={bt.type} onClick={() => addBlock(bt.type)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all text-left group">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-400 transition-colors">{bt.icon}</div>
                <div><p className="text-xs font-medium text-zinc-300">{bt.label}</p><p className="text-xs text-zinc-600">{bt.desc}</p></div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500"><Ico.plus /></div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="card-title mb-3">Export</p>
          <button onClick={exportDocx} disabled={exporting || blocks.length === 0} className={`w-full h-10 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2 transition-all mb-2 ${blocks.length > 0 && !exporting ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
            {exporting ? 'Exporting...' : <><Ico.download /> Download .docx</>}
          </button>
          <button onClick={copyTemplate} className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"><Ico.code /> Copy Syntax Only</button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><h2 className="text-sm font-mono font-bold text-zinc-300 uppercase tracking-wider">Canvas</h2><span className="text-xs text-zinc-600">{blocks.length} blocks</span></div>
          <button onClick={() => setPreview((p) => !p)} className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-all border ${preview ? 'bg-lime-400/10 text-lime-400 border-lime-400/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'}`}><Ico.eye /> {preview ? 'Preview ON' : 'Preview OFF'}</button>
        </div>

        <div className="card flex-1 overflow-y-auto" style={{ minHeight: '500px' }}>
          <div className="bg-white rounded-xl p-8 min-h-full shadow-2xl">
            <div className="space-y-4">
              {blocks.map((b) => (
                <div key={b.id} draggable onDragStart={() => handleDragStart(b.id)} onDragEnter={() => handleDragEnterBlock(b.id)} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => setSelected(b.id === selected ? null : b.id)} className={`group relative rounded-lg transition-all cursor-pointer ${selected === b.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-zinc-50'}`} style={{ padding: '6px 8px' }}>
                  {preview ? renderPreviewBlock(b) : <div>{b.type === 'heading' ? <div className="text-xl font-bold text-zinc-800">{b.content}</div> : b.type === 'text' ? <div className="text-sm text-zinc-600">{b.content}</div> : b.type === 'field' ? <div className="text-emerald-600 font-mono text-sm">{'{'+b.content+'}'}</div> : b.type === 'image' ? <div className="text-blue-600 font-mono text-sm">{'{%'+b.content+'}'}</div> : b.type === 'divider' ? <hr className="border-zinc-300" /> : <div className="text-zinc-500">table</div>}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card flex-1">
          <p className="card-title mb-3">Properties</p>
          {!selBlock ? <p className="text-xs text-zinc-600 font-mono">Click a block to edit</p> : (
            <div className="flex flex-col gap-4">
              {selBlock.type !== 'divider' && (
                <input type="text" value={selBlock.content} onChange={(e) => updateBlock(selBlock.id, { content: e.target.value })} className="input text-sm w-full" />
              )}
              {(selBlock.type === 'field' || selBlock.type === 'image' || selBlock.type === 'table') && (
                <input type="text" value={selBlock.label || ''} onChange={(e) => updateBlock(selBlock.id, { label: e.target.value })} className="input text-sm w-full" placeholder="Human-readable label" />
              )}
              <button onClick={() => removeBlock(selBlock.id)} className="flex items-center justify-center gap-2 text-xs text-red-400 border border-red-500/20 rounded-xl py-2.5"><Ico.trash /> Remove Block</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="card-title text-xs">Template Syntax</p>
            <button onClick={copyTemplate} className="text-xs text-zinc-500 hover:text-zinc-300 font-mono flex items-center gap-1 transition-colors"><Ico.code /> copy</button>
          </div>
          <pre className="text-xs font-mono text-zinc-500 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-zinc-950 rounded-lg p-3 border border-zinc-800">{generateTemplate() || '- empty -'}</pre>
        </div>
      </div>
    </div>
  );
}
