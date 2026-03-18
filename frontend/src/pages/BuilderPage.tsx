import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import mammoth from 'mammoth';
import PizZip from 'pizzip';
import { previewPdf } from '../services/api';
import { Ico } from '../components/icons/Ico';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_CONTENT = `<h1>CONTRACT AGREEMENT</h1>
<p>Client: <strong>{client_name}</strong></p>
<p>Date: {date}</p>
<p>This agreement is entered into between the parties listed above.</p>
<p>Amount: {amount}</p>
<hr>
<p>{%signature}</p>`;

/** Extract {field_name} placeholders (not image) from HTML */
function extractTextFields(html: string): string[] {
  const matches = [...html.matchAll(/\{([^%<>{}\s][^<>{}]*)\}/g)];
  return [...new Set(matches.map((m) => m[1].trim()))].filter((f) => f.length > 0);
}

/** Extract {%image_key} placeholders from HTML */
function extractImageFields(html: string): string[] {
  const matches = [...html.matchAll(/\{%([^<>{}]+)\}/g)];
  return [...new Set(matches.map((m) => m[1].trim()))].filter((f) => f.length > 0);
}

const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function makeRun(text: string, bold = false, italic = false, color = '333333', size = 24): string {
  const rPr = [bold ? '<w:b/>' : '', italic ? '<w:i/>' : '', `<w:sz w:val="${size}"/>`, `<w:color w:val="${color}"/>`].join('');
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

function processInlineNode(node: Node, bold = false, italic = false): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    const parts = text.split(/(\{%[^}]+\}|\{[^}]+\})/g);
    return parts
      .map((part) => {
        if (/^\{%[^}]+\}$/.test(part)) return makeRun(part, false, false, '1d4ed8');
        if (/^\{[^}]+\}$/.test(part)) return makeRun(part, false, false, '166534');
        return part ? makeRun(part, bold, italic) : '';
      })
      .join('');
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const b = bold || tag === 'strong' || tag === 'b';
    const i = italic || tag === 'em' || tag === 'i';
    return [...el.childNodes].map((c) => processInlineNode(c, b, i)).join('');
  }
  return '';
}

function htmlToDocxXml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.querySelector('div')!;
  const rows: string[] = [];
  const para = (xml: string, style = 'Normal') =>
    `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${xml}</w:p>`;

  for (const child of root.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1') {
      rows.push(para(processInlineNode(el, true), 'Heading1'));
      rows.push(para(''));
    } else if (tag === 'h2') {
      rows.push(para(processInlineNode(el, true), 'Heading2'));
    } else if (tag === 'h3') {
      rows.push(para(processInlineNode(el, true), 'Heading3'));
    } else if (tag === 'p') {
      rows.push(para(processInlineNode(el) || '<w:r><w:t/></w:r>'));
    } else if (tag === 'hr') {
      rows.push(
        '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="cccccc"/></w:pBdr></w:pPr></w:p>',
      );
    } else if (tag === 'ul' || tag === 'ol') {
      let index = 1;
      for (const li of el.querySelectorAll(':scope > li')) {
        const prefix = tag === 'ol' ? `${index}. ` : '\u2022 ';
        rows.push(para(makeRun(`${prefix}${(li.textContent || '').trim()}`)));
        index += 1;
      }
    } else if (tag === 'blockquote') {
      rows.push(para(processInlineNode(el)));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>
${rows.join('\n')}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

function buildDocxBlob(xml: string): Blob {
  const zip = new PizZip();
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}


// ── Component ────────────────────────────────────────────────────────────────

const INSERT_BLOCKS = [
  { type: 'heading', label: 'H1', icon: <span className="font-bold text-xs">H</span>, desc: 'Heading 1' },
  { type: 'text', label: '¶', icon: <span className="text-xs">¶</span>, desc: 'Paragraph' },
  { type: 'field', label: '{}', icon: <span className="font-mono text-xs">{'{}'}</span>, desc: 'Field placeholder {field_name}' },
  { type: 'image', label: '{%}', icon: <Ico.img />, desc: 'Image placeholder {%image_key}' },
  { type: 'divider', label: '─', icon: <span className="text-base leading-none">—</span>, desc: 'Horizontal rule' },
  { type: 'table', label: '[]', icon: <span className="font-mono text-xs">[]</span>, desc: 'Table row' },
] as const;

export default function BuilderPage() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: DEFAULT_CONTENT,
    editorProps: { attributes: { class: 'docx-editor' } },
  });

  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [builderApiKey, setBuilderApiKey] = useState('flowpdf_dev_key');
  const [exporting, setExporting] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<Record<string, string>>({});

  // Revoke old blob URL on change / unmount
  useEffect(() => {
    return () => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); };
  }, [previewPdfUrl]);

  // Derive template fields from the live editor HTML
  const editorHtml = editor?.getHTML() ?? '';
  const textFields = extractTextFields(editorHtml);
  const imageFields = extractImageFields(editorHtml);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleImportDocx = async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      editor.commands.setContent(result.value || '<p>Empty document.</p>');
      setUploadedFile(file.name);
    } catch (e) {
      console.error('Import failed', e);
    }
    setUploading(false);
  };

  const insertBlock = (type: string) => {
    if (!editor) return;
    switch (type) {
      case 'heading':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'text':
        editor.chain().focus().insertContent('<p>Enter paragraph text here…</p>').run();
        break;
      case 'field':
        editor.chain().focus().insertContent('<p>{field_name}</p>').run();
        break;
      case 'image':
        editor.chain().focus().insertContent('<p>{%image_key}</p>').run();
        break;
      case 'divider':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'table':
        editor.chain().focus().insertContent('<p>| col1 | col2 | col3 |</p>').run();
        break;
    }
  };

  const getDocxXml = () => htmlToDocxXml(editor?.getHTML() ?? '');

  const exportDocx = async () => {
    setExporting(true);
    try {
      const blob = buildDocxBlob(getDocxXml());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uploadedFile ? uploadedFile.replace(/\.docx$/i, '') : 'template'}_edited.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
    setExporting(false);
  };

  const copyTemplate = () => {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getText());
  };

  const handleGeneratePreview = async () => {
    if (!editor) return;
    setPreviewStatus('loading');
    setPreviewError(null);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
    try {
      const blob = buildDocxBlob(getDocxXml());
      const docxFile = new File([blob], 'template.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const dataForPreview: Record<string, string> = {};
      textFields.forEach((f) => { dataForPreview[f] = sampleData[f] || `[${f}]`; });
      const base64Pdf = await previewPdf({ template: docxFile, data: dataForPreview, apiKey: builderApiKey });
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

  const canPreview = !!editor && previewStatus !== 'loading';

  // ── Format-toolbar button style helper ────────────────────────────────────
  const fmtBtn = (active: boolean) =>
    `w-7 h-7 rounded font-bold text-xs flex items-center justify-center transition-all ${
      active ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
    }`;

  // ── Render ─────────────────────────────────────────────────────────────────
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
            ? <><span className="w-3.5 h-3.5 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" /> Parsing…</>
            : <><Ico.upload /> {uploadedFile ? <span className="text-lime-400 font-mono truncate max-w-[120px]">{uploadedFile}</span> : 'Import .docx'}</>}
        </button>
        <input
          id="builder-docx-input" type="file" accept=".docx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportDocx(f); e.currentTarget.value = ''; }}
        />

        {/* Insert block buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-zinc-600 font-mono uppercase tracking-wider mr-1">Insert:</span>
          {INSERT_BLOCKS.map((bt) => (
            <button
              key={bt.type} onClick={() => insertBlock(bt.type)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-700/60 text-zinc-300 text-xs transition-all"
              title={bt.desc}
            >
              <span className="text-zinc-400">{bt.icon}</span>{bt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* API Key */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"><Ico.key /></span>
          <input
            type="text" value={builderApiKey} onChange={(e) => setBuilderApiKey(e.target.value)}
            className="input pl-8 text-xs font-mono w-44 py-2" placeholder="API key"
          />
        </div>

        {/* Export */}
        <button
          onClick={exportDocx} disabled={exporting || !editor}
          className={`flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl transition-all ${
            !exporting && editor ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {exporting ? 'Exporting…' : <><Ico.download />{' .docx'}</>}
        </button>
        <button onClick={copyTemplate} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2">
          <Ico.code /> Syntax
        </button>
      </div>

      {/* ── Main two-column area ─────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[1fr_380px] gap-4 min-h-0">

        {/* Left: Rich Text Editor */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">Document Editor</h2>
            {uploadedFile && <span className="text-xs text-lime-400 font-mono truncate max-w-[200px]">{uploadedFile}</span>}
            {(textFields.length + imageFields.length) > 0 && (
              <span className="text-xs text-zinc-600">
                {textFields.length + imageFields.length} field{(textFields.length + imageFields.length) !== 1 ? 's' : ''} detected
              </span>
            )}
          </div>

          {/* Format toolbar */}
          {editor && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800/80 border border-zinc-700 rounded-xl flex-wrap">
              <button onClick={() => editor.chain().focus().toggleBold().run()}
                className={fmtBtn(editor.isActive('bold'))} title="Bold (Ctrl+B)">B</button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()}
                className={fmtBtn(editor.isActive('italic')) + ' italic'} title="Italic (Ctrl+I)">I</button>
              <button onClick={() => editor.chain().focus().toggleStrike().run()}
                className={fmtBtn(editor.isActive('strike')) + ' line-through'} title="Strikethrough">S</button>
              <div className="w-px h-4 bg-zinc-600 mx-1" />
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={fmtBtn(editor.isActive('heading', { level: 1 }))} title="Heading 1">H1</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={fmtBtn(editor.isActive('heading', { level: 2 }))} title="Heading 2">H2</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={fmtBtn(editor.isActive('heading', { level: 3 }))} title="Heading 3">H3</button>
              <div className="w-px h-4 bg-zinc-600 mx-1" />
              <button onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={fmtBtn(editor.isActive('bulletList'))} title="Bullet list">•</button>
              <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={fmtBtn(editor.isActive('orderedList'))} title="Ordered list">1.</button>
              <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={fmtBtn(editor.isActive('blockquote'))} title="Blockquote">"</button>
              <div className="w-px h-4 bg-zinc-600 mx-1" />
              <button onClick={() => editor.chain().focus().undo().run()}
                className="w-7 h-7 rounded text-sm flex items-center justify-center bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-all" title="Undo">↩</button>
              <button onClick={() => editor.chain().focus().redo().run()}
                className="w-7 h-7 rounded text-sm flex items-center justify-center bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-all" title="Redo">↪</button>
            </div>
          )}

          {/* Paper canvas with TipTap editor */}
          <div className="card flex-1 overflow-y-auto p-3" style={{ minHeight: '420px' }}>
            <div className="bg-white rounded-lg shadow-xl mx-auto" style={{ maxWidth: '680px', minHeight: '100%' }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Right: PDF Preview */}
        <div className="flex flex-col gap-3 min-h-0">
          <h2 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">PDF Preview</h2>

          {/* Sample data inputs */}
          <div className="card">
            <p className="card-title mb-3">Sample Data</p>
            {textFields.length === 0 && imageFields.length === 0 ? (
              <p className="text-xs text-zinc-600 font-mono">Type {'{field}'} in the editor to add sample values.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {textFields.map((f) => (
                  <div key={f}>
                    <label className="field-label">{f}</label>
                    <input
                      type="text"
                      value={sampleData[f] ?? ''}
                      onChange={(e) => setSampleData((prev) => ({ ...prev, [f]: e.target.value }))}
                      className="input text-sm"
                      placeholder={`[${f}]`}
                    />
                  </div>
                ))}
                {imageFields.length > 0 && (
                  <p className="text-xs text-zinc-600 font-mono mt-1">
                    Image fields: {imageFields.map((f) => `{%${f}}`).join(', ')}
                  </p>
                )}
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
                ? <><span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" /> Rendering…</>
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
                <p className="text-xs text-zinc-500">
                  Fill sample data and click<br />
                  <span className="text-lime-400 font-mono">Generate Preview</span> to render the PDF.
                </p>
              </div>
            )}
            {previewStatus === 'loading' && (
              <div className="flex-1 flex items-center justify-center">
                <span className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {previewStatus === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <p className="text-xs text-red-400 font-mono text-center">
                  Render failed.<br />Check that the API is running and the API key is correct.
                </p>
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
