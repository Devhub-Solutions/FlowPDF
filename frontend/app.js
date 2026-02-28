/* ═══════════════════════════════════════════
   Document Automation System — Frontend v2
   - Tables rendered as proper HTML <table>
   - Mappings use original_text (no offsets)
   - Table loop/array selection mode
   ═══════════════════════════════════════════ */

const API_BASE = window.location.origin;
const DESIGNER_API = `${API_BASE}/api/v1/designer`;
const RENDER_API = `${API_BASE}/api/v1/render`;

// ─── State ───
let currentView = "dashboard";
let currentTemplateId = null;
let currentStructure = null;
let currentMappings = [];
// Selection state for mapping
let pendingSelection = null;  // array of { mapping_type, paragraph_index|table_index, original_text, ... }
// Table loop mode
let loopModeActive = false;
let loopTableIndex = null;
let loopSelectedRows = new Set();

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    checkApiHealth();
    loadDashboard();

    document.getElementById("upload-zone").addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") {
            document.getElementById("file-input").click();
        }
    });

    // ── Global text selection handler for designer ──
    document.addEventListener("mouseup", handleGlobalTextSelection);

    // ── Delegated click handler for table row selection in loop mode ──
    document.addEventListener("click", function (event) {
        if (!loopModeActive) return;
        const tr = event.target.closest("tr[data-table][data-row]");
        if (!tr) return;
        const tableIdx = parseInt(tr.dataset.table);
        const rowIdx = parseInt(tr.dataset.row);
        if (loopTableIndex !== tableIdx) return;

        // Don't toggle row if user was selecting text (drag)
        const sel = window.getSelection();
        if (sel && sel.toString().trim().length > 0) return;

        if (loopSelectedRows.has(rowIdx)) {
            loopSelectedRows.delete(rowIdx);
            tr.classList.remove("loop-selected");
        } else {
            loopSelectedRows.add(rowIdx);
            tr.classList.add("loop-selected");
        }
    });
});

// ═══════════════════════════════════════════
// GLOBAL TEXT SELECTION (handles multi-line + table cells)
// ═══════════════════════════════════════════

function handleGlobalTextSelection(event) {
    if (currentView !== "designer" || !currentStructure) return;
    if (event.target.closest("button, input, select, .mapping-form")) return;
    if (loopModeActive) return;

    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (!text || text.length < 1) return;

    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
    const focusEl = sel.focusNode?.nodeType === 3 ? sel.focusNode.parentElement : sel.focusNode;
    if (!anchorEl) return;

    // ── Case 1: Selection in paragraph(s) ──
    const anchorPara = anchorEl.closest("[data-type='paragraph']");
    if (anchorPara) {
        const focusPara = focusEl?.closest("[data-type='paragraph']");

        // Single paragraph selection
        if (!focusPara || anchorPara === focusPara) {
            const paraIdx = parseInt(anchorPara.dataset.paraIdx);
            const para = currentStructure.paragraphs.find(p => p.paragraph_index === paraIdx);
            if (!para) return;
            let selectedText = text;
            if (!para.text.includes(selectedText)) {
                selectedText = findBestMatch(para.text, selectedText);
                if (!selectedText) return;
            }
            pendingSelection = [{
                mapping_type: "paragraph",
                paragraph_index: paraIdx,
                original_text: selectedText
            }];
            showMappingForm(pendingSelection);
            return;
        }

        // Multi-paragraph: find ALL paragraph elements between anchor and focus
        const allParaEls = Array.from(document.querySelectorAll("[data-type='paragraph']"));
        const anchorIdx = allParaEls.indexOf(anchorPara);
        const focusIdx = allParaEls.indexOf(focusPara);
        if (anchorIdx === -1 || focusIdx === -1) return;

        const startIdx = Math.min(anchorIdx, focusIdx);
        const endIdx = Math.max(anchorIdx, focusIdx);
        const selections = [];

        for (let i = startIdx; i <= endIdx; i++) {
            const el = allParaEls[i];
            const pIdx = parseInt(el.dataset.paraIdx);
            const para = currentStructure.paragraphs.find(p => p.paragraph_index === pIdx);
            if (!para || !para.text.trim()) continue;
            selections.push({
                mapping_type: "paragraph",
                paragraph_index: pIdx,
                original_text: para.text
            });
        }
        if (selections.length === 0) return;
        pendingSelection = selections;
        showMappingForm(pendingSelection);
        return;
    }

    // ── Case 2: Selection in table cell ──
    const tdEl = anchorEl.closest("td[data-col]");
    if (tdEl) {
        const trEl = tdEl.closest("tr[data-table]");
        if (!trEl) return;
        const tableIdx = parseInt(trEl.dataset.table);
        const rowIdx = parseInt(trEl.dataset.row);
        const colIdx = parseInt(tdEl.dataset.col);

        const table = currentStructure.tables.find(t => t.table_index === tableIdx);
        if (!table) return;
        const row = table.rows.find(r => r.row_index === rowIdx);
        if (!row) return;
        const cell = row.cells.find(c => c.col_index === colIdx);
        if (!cell) return;

        let selectedText = text;
        if (!cell.text.includes(selectedText)) {
            selectedText = findBestMatch(cell.text, selectedText);
            if (!selectedText) return;
        }
        pendingSelection = [{
            mapping_type: "table_cell",
            table_index: tableIdx,
            row_index: rowIdx,
            col_index: colIdx,
            original_text: selectedText
        }];
        showMappingForm(pendingSelection);
        return;
    }
}

/**
 * When user selects across paragraphs, the selected text may contain text
 * from multiple elements. Find the longest portion that matches the source.
 */
function findBestMatch(sourceText, selectedText) {
    // First try: exact match
    if (sourceText.includes(selectedText)) return selectedText;

    // Second try: selected text is a superset — find the overlapping part
    // Check if the beginning of selected text matches end of source
    for (let len = Math.min(selectedText.length, sourceText.length); len > 2; len--) {
        const sub = selectedText.substring(0, len);
        if (sourceText.includes(sub)) return sub;
    }

    // Third try: check if end of selected text matches beginning of source
    for (let len = Math.min(selectedText.length, sourceText.length); len > 2; len--) {
        const sub = selectedText.substring(selectedText.length - len);
        if (sourceText.includes(sub)) return sub;
    }

    return null; // no match
}

// (onTableRowClick handled by delegated click handler in DOMContentLoaded)

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

function initNavigation() {
    document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
        btn.addEventListener("click", () => navigateTo(btn.dataset.view));
    });
}

function navigateTo(viewName) {
    currentView = viewName;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === viewName));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${viewName}`)?.classList.add("active");
    if (viewName === "dashboard") loadDashboard();
    if (viewName === "render") loadRenderView();
}

// ═══════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════

function getAuthHeaders() {
    const h = {};
    const token = localStorage.getItem("access_token");
    if (token) {
        h["Authorization"] = `Bearer ${token}`;
    } else {
        // If no JWT token, include API key for local/dev access
        const apiKey = (window && window.__API_KEY) ? window.__API_KEY : null;
        if (apiKey) h["X-API-Key"] = apiKey;
    }
    return h;
}
function handle401(r) {
    if (r.status === 401) {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
        throw new Error("Session expired");
    }
}
async function apiGet(path) {
    const r = await fetch(`${DESIGNER_API}${path}`, { headers: getAuthHeaders(), credentials: "include" });
    handle401(r);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || r.statusText); }
    return r.json();
}
async function apiPost(path, body, isForm = false) {
    const opts = { method: "POST", headers: { ...getAuthHeaders() }, credentials: "include" };
    if (isForm) { opts.body = body; } else { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    const r = await fetch(`${DESIGNER_API}${path}`, opts);
    handle401(r);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || r.statusText); }
    return r.json();
}
async function apiDelete(path) {
    const r = await fetch(`${DESIGNER_API}${path}`, { method: "DELETE", headers: getAuthHeaders(), credentials: "include" });
    handle401(r);
    if (!r.ok) throw new Error("API Error");
    return r.json();
}
async function checkApiHealth() {
    const el = document.getElementById("api-status");
    try {
        const r = await fetch(`${API_BASE}/health`);
        if (r.ok) { el.className = "api-status connected"; el.querySelector(".status-text").textContent = "API Connected"; }
    } catch { el.className = "api-status error"; el.querySelector(".status-text").textContent = "API Offline"; }
}

function logout() {
    localStorage.removeItem("access_token");
    fetch(`${API_BASE}/api/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => { });
    window.location.href = "/login";
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════

async function loadDashboard() {
    try {
        const data = await apiGet("/");
        const templates = data.templates || [];
        renderTemplatesList(templates);
        document.getElementById("stat-total").textContent = templates.length;
        document.getElementById("stat-draft").textContent = templates.filter(t => t.status === "draft").length;
        document.getElementById("stat-published").textContent = templates.filter(t => t.status === "published").length;
        fetch(`${API_BASE}/api/v1/files/list`).then(r => r.json()).then(d => document.getElementById("stat-files").textContent = d.files?.length || 0).catch(() => { });
    } catch (e) {
        showToast("Failed to load templates", "error");
        // Log chi tiết lỗi ra console để debug
        console.error("[loadDashboard] Error loading templates:", e);
    }
}

function renderTemplatesList(templates) {
    const c = document.getElementById("templates-list");
    if (!templates.length) {
        c.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h3>No templates yet</h3><p>Upload a DOCX file to get started</p></div>`;
        return;
    }
    c.innerHTML = templates.map(t => `
        <div class="template-item" onclick="openDesigner('${t.id}')">
            <div class="template-info">
                <div class="template-icon">${t.status === "published" ? "✅" : "📝"}</div>
                <div class="template-details">
                    <h3>${esc(t.name)}</h3>
                    <div class="template-meta">
                        <span class="badge ${t.status === 'published' ? 'green' : 'amber'}">${t.status}</span>
                        <span>${t.mappings_count || 0} mappings</span>
                    </div>
                </div>
            </div>
            <div class="template-actions">
                ${t.status === "published" ? `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openRender('${t.id}')">Render</button>` : ""}
                <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); deleteTemplateConfirm('${t.id}','${esc(t.name)}')">🗑</button>
            </div>
        </div>`).join("");
}

// ═══════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════

function showUploadModal() { document.getElementById("upload-modal").style.display = "flex"; document.getElementById("upload-progress").style.display = "none"; }
function hideUploadModal() { document.getElementById("upload-modal").style.display = "none"; }
function handleDrop(e) { e.preventDefault(); e.currentTarget.classList.remove("dragover"); if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); }
function handleFileSelect(e) { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value = ""; }

async function uploadFile(file) {
    if (!file.name.endsWith(".docx")) { showToast("Only .docx files supported", "error"); return; }
    const pEl = document.getElementById("upload-progress"), pFill = document.getElementById("progress-fill"), pText = document.getElementById("upload-status");
    pEl.style.display = "block"; pFill.style.width = "40%"; pText.textContent = `Uploading ${file.name}...`;
    try {
        const fd = new FormData(); fd.append("file", file);
        pFill.style.width = "70%";
        const data = await apiPost("/raw", fd, true);
        pFill.style.width = "100%"; pText.textContent = "Done!";
        showToast(`"${file.name}" uploaded`, "success");
        setTimeout(() => { hideUploadModal(); loadDashboard(); openDesigner(data.template_id); }, 400);
    } catch (e) { pText.textContent = `Error: ${e.message}`; showToast("Upload failed", "error"); }
}

// ═══════════════════════════════════════════
// DESIGNER
// ═══════════════════════════════════════════

async function openDesigner(templateId) {
    currentTemplateId = templateId;
    loopModeActive = false;
    loopSelectedRows.clear();
    pendingSelection = null;
    navigateTo("designer");

    try {
        const template = await apiGet(`/${templateId}`);
        document.getElementById("designer-title").textContent = `Designing: ${template.name}`;
        document.getElementById("designer-subtitle").textContent = `Status: ${template.status}`;
        const isPublished = template.status === "published";
        document.getElementById("btn-publish").style.display = isPublished ? "none" : "flex";

        currentStructure = await apiGet(`/${templateId}/structure`);
        const mpData = await apiGet(`/${templateId}/mappings`);
        currentMappings = mpData.mappings || [];

        const totalElements = currentStructure.total_paragraphs + currentStructure.tables.reduce((s, t) => s + t.num_rows * t.num_cols, 0);
        document.getElementById("element-count").textContent = `${totalElements} elements`;
        document.getElementById("mapping-count").textContent = `${currentMappings.length} mappings`;

        renderDocPreview(isPublished);
        renderMappingsList(isPublished);
        updateSteps(currentMappings.length > 0 ? (isPublished ? 3 : 2) : 1);
    } catch (e) { showToast(`Failed: ${e.message}`, "error"); }
}

// ─── Document Preview ───

function renderDocPreview(isPublished) {
    const c = document.getElementById("doc-preview-content");
    const { paragraphs, tables } = currentStructure;
    let html = "";

    // Render paragraphs (inserted between/around tables based on document order)
    // For simplicity, render all paragraphs first, then tables
    // A more advanced version would interleave based on XML position

    // Paragraphs
    paragraphs.forEach(p => {
        if (!p.text && !p.is_heading) return; // skip empty

        const cls = p.is_heading ? "doc-element heading" : "doc-element paragraph";
        const displayText = highlightMappedText(p.text, "paragraph", p.paragraph_index);

        html += `<div class="${cls}" data-type="paragraph" data-para-idx="${p.paragraph_index}">
                    ${displayText || '<span style="opacity:0.3">(trống)</span>'}
                    <span class="element-tag">P${p.paragraph_index}</span>
                 </div>`;
    });

    // Tables
    tables.forEach(table => {
        const loopMapping = currentMappings.find(m => m.mapping_type === "table_loop" && m.table_index === table.table_index);

        html += `<div class="doc-table-wrapper" data-table-idx="${table.table_index}">
            <div class="doc-table-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Bảng ${table.table_index + 1} (${table.num_rows}×${table.num_cols})
                ${!isPublished ? `<button class="btn btn-sm btn-outline" onclick="startLoopMode(${table.table_index})" style="margin-left:auto">🔄 Chọn Loop Array</button>` : ""}
                ${loopMapping ? `<span class="badge green" style="margin-left:8px">Loop: ${loopMapping.loop_variable}</span>` : ""}
            </div>
            <table class="doc-table" id="doc-table-${table.table_index}">`;

        // For large tables, collapse empty data rows
        const MAX_VISIBLE_ROWS = 5;
        const hasLotsOfRows = table.rows.length > MAX_VISIBLE_ROWS && !_expandedTables.has(table.table_index);
        let collapsedCount = 0;

        table.rows.forEach((row, rowDisplayIdx) => {
            const isLoopRow = loopMapping && row.row_index === loopMapping.data_row_index;
            const rowCls = isLoopRow ? "loop-row" : "";
            const isHeaderRow = row.row_index === 0;
            const filledCells = row.cells.filter(c => c.text && c.text.trim() && c.text.trim() !== '—').length;
            const isMostlyEmpty = filledCells <= Math.ceil(row.cells.length / 2);

            // For large tables: show header + first few data rows + rows with content
            if (hasLotsOfRows && !isHeaderRow && row.row_index > 3 && isMostlyEmpty && !isLoopRow) {
                collapsedCount++;
                // Show collapse indicator after the visible rows
                if (collapsedCount === 1) {
                    html += `<tr class="collapsed-row" data-table="${table.table_index}">
                        <td colspan="${table.num_cols}" style="text-align:center;padding:8px;opacity:0.5;font-size:0.8rem;cursor:pointer"
                            onclick="expandTable(${table.table_index})">
                            ⋯ ${table.num_rows - 4} hàng trống ẩn — click để hiện ⋯
                        </td>
                    </tr>`;
                }
                return; // skip rendering this row
            }

            html += `<tr class="${rowCls}" data-table="${table.table_index}" data-row="${row.row_index}">`;

            row.cells.forEach(cell => {
                const cellText = highlightMappedTextCell(cell.text, table.table_index, row.row_index, cell.col_index);
                html += `<td data-col="${cell.col_index}">
                            ${cellText || '<span style="opacity:0.3">—</span>'}
                         </td>`;
            });
            html += `</tr>`;
        });

        html += `</table></div>`;
    });

    c.innerHTML = html;
}

// Track which tables are expanded
const _expandedTables = new Set();
function expandTable(tableIdx) {
    _expandedTables.add(tableIdx);
    // Re-render the preview
    if (currentStructure) renderDocPreview(currentStructure);
}

function highlightMappedText(text, type, paraIdx) {
    if (!text) return "";
    const maps = currentMappings.filter(m =>
        m.mapping_type === "paragraph" && m.paragraph_index === paraIdx
    );
    if (!maps.length) return esc(text);

    let result = text;
    // Sort by position in text (descending) to replace from end
    const sorted = [...maps].sort((a, b) => {
        const posA = result.indexOf(a.original_text);
        const posB = result.indexOf(b.original_text);
        return posB - posA;
    });

    // Build segments
    let segments = [{ text: result, mapped: false }];
    for (const m of maps) {
        const newSegments = [];
        for (const seg of segments) {
            if (seg.mapped) { newSegments.push(seg); continue; }
            const idx = seg.text.indexOf(m.original_text);
            if (idx === -1) { newSegments.push(seg); continue; }
            if (idx > 0) newSegments.push({ text: seg.text.substring(0, idx), mapped: false });
            newSegments.push({ text: m.original_text, mapped: true, label: m.label });
            const after = idx + m.original_text.length;
            if (after < seg.text.length) newSegments.push({ text: seg.text.substring(after), mapped: false });
        }
        segments = newSegments;
    }

    return segments.map(s =>
        s.mapped
            ? `<span class="mapped-highlight" data-label="${esc(s.label)}">${esc(s.text)}</span>`
            : esc(s.text)
    ).join("");
}

function highlightMappedTextCell(text, tableIdx, rowIdx, colIdx) {
    if (!text) return "";
    // Check cell mappings
    const cellMap = currentMappings.find(m =>
        m.mapping_type === "table_cell" && m.table_index === tableIdx &&
        m.row_index === rowIdx && m.col_index === colIdx
    );
    if (cellMap) {
        return `<span class="mapped-highlight" data-label="${esc(cellMap.label)}">${esc(text)}</span>`;
    }
    // Check loop mappings
    const loopMap = currentMappings.find(m =>
        m.mapping_type === "table_loop" && m.table_index === tableIdx &&
        m.data_row_index === rowIdx
    );
    if (loopMap) {
        const cl = loopMap.cell_labels.find(c => c.col_index === colIdx);
        if (cl) {
            return `<span class="mapped-highlight" data-label="item.${esc(cl.label)}">${esc(text)}</span>`;
        }
    }
    return esc(text);
}

// ─── Mappings List ───

function renderMappingsList(isPublished) {
    const c = document.getElementById("mappings-panel");
    if (!currentMappings.length) {
        c.innerHTML = `<div class="empty-state small"><p>${isPublished ? "Template published — locked." : "Select text to create mappings"}</p></div>`;
        return;
    }

    c.innerHTML = currentMappings.map(m => {
        if (m.mapping_type === "table_loop") {
            const labels = (m.cell_labels || []).map(cl => cl.label).join(", ");
            return `<div class="mapping-item loop">
                <div class="mapping-item-info">
                    <span class="mapping-label">🔄 {% for item in ${esc(m.loop_variable)} %}</span>
                    <span class="mapping-original">Cols: ${labels}</span>
                </div>
                <div class="mapping-badges">
                    <span class="badge purple">array</span>
                    ${!isPublished ? `<button class="btn btn-sm btn-ghost" onclick="deleteMapping('${m.id}')">🗑</button>` : ""}
                </div>
            </div>`;
        }
        const typeLabel = m.mapping_type === "table_cell" ? "[cell]" : "";
        return `<div class="mapping-item">
            <div class="mapping-item-info">
                <span class="mapping-label">{{${esc(m.label)}}} ${typeLabel}</span>
                <span class="mapping-original">"${esc(m.original_text)}"</span>
            </div>
            <div class="mapping-badges">
                <span class="badge ${getTypeBadge(m.field_type)}">${m.field_type}</span>
                ${m.required ? '<span class="badge blue">req</span>' : ""}
                ${!isPublished ? `<button class="btn btn-sm btn-ghost" onclick="deleteMapping('${m.id}')">🗑</button>` : ""}
            </div>
        </div>`;
    }).join("");
}

function getTypeBadge(t) { return { string: "", number: "blue", currency: "amber", date: "purple", array: "purple" }[t] || ""; }

function updateSteps(step) {
    document.querySelectorAll("#steps-bar .step").forEach((s, i) => {
        s.classList.remove("active", "completed");
        if (i + 1 < step) s.classList.add("completed");
        else if (i + 1 === step) s.classList.add("active");
    });
    document.querySelectorAll("#steps-bar .step-line").forEach((l, i) => l.classList.toggle("active", i + 1 < step));
}

// (Text selection is handled by handleGlobalTextSelection via document mouseup)

// ─── Mapping Form ───

function showMappingForm(selections) {
    // selections is always an array of mapping objects
    document.getElementById("mapping-form").style.display = "block";
    document.getElementById("loop-form").style.display = "none";

    const displayEl = document.getElementById("selected-text-display");
    if (selections.length === 1) {
        displayEl.textContent = `"${selections[0].original_text}"`;
    } else {
        displayEl.innerHTML = `<strong>${selections.length} dòng:</strong><br>` +
            selections.map((s, i) => `${i + 1}. "${esc(s.original_text)}"`).join("<br>");
    }

    document.getElementById("mapping-label").value = "";
    document.getElementById("mapping-label").focus();
}

function cancelMapping() {
    document.getElementById("mapping-form").style.display = "none";
    pendingSelection = null;
}

async function saveMapping() {
    if (!pendingSelection || !pendingSelection.length) return;
    const label = document.getElementById("mapping-label").value.trim();
    if (!label) { showToast("Enter a label", "error"); return; }
    if (!/^[a-z_][a-z0-9_]*$/.test(label)) { showToast("Label: lowercase + underscores only", "error"); return; }

    const fieldType = document.getElementById("mapping-type").value;
    const required = document.getElementById("mapping-required").checked;

    try {
        // POST each mapping separately (same label for multi-line)
        for (const sel of pendingSelection) {
            const body = { ...sel, label, field_type: fieldType, required };
            await apiPost(`/${currentTemplateId}/mappings`, body);
        }
        const suffix = pendingSelection.length > 1 ? ` (${pendingSelection.length} dòng)` : "";
        showToast(`Mapped → {{${label}}}${suffix}`, "success");
        cancelMapping();
        openDesigner(currentTemplateId);
    } catch (e) { showToast(`Error: ${e.message}`, "error"); }
}

// ═══════════════════════════════════════════
// TABLE LOOP MODE
// ═══════════════════════════════════════════

function startLoopMode(tableIdx) {
    loopModeActive = true;
    loopTableIndex = tableIdx;
    loopSelectedRows.clear();

    document.getElementById("mapping-form").style.display = "none";
    document.getElementById("loop-form").style.display = "block";

    const table = currentStructure.tables.find(t => t.table_index === tableIdx);
    if (!table || table.rows.length < 2) { showToast("Table needs at least 2 rows", "error"); cancelLoopMode(); return; }

    // Build row selector dropdowns
    const rowOptions = table.rows.map(r => {
        const preview = r.cells.map(c => c.text || "—").join(" | ").substring(0, 80);
        return `<option value="${r.row_index}">Row ${r.row_index}: ${esc(preview)}</option>`;
    }).join("");

    let configHtml = `
        <div class="loop-config">
            <div class="form-row">
                <div class="form-group">
                    <label>Header Row</label>
                    <select id="loop-header-row" class="input" onchange="updateLoopCellLabels(${tableIdx})">
                        ${rowOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Data Template Row</label>
                    <select id="loop-data-row" class="input" onchange="updateLoopCellLabels(${tableIdx})">
                        ${rowOptions}
                    </select>
                </div>
            </div>
        </div>
        <p class="loop-help">Mỗi cột gán vào 1 <strong>Group</strong> (cùng group = cùng mảng). Để trống group = bỏ qua cột đó.</p>
        <div class="loop-cell-labels" id="loop-cell-labels-inner"></div>`;

    document.getElementById("loop-cell-labels-container").innerHTML = configHtml;

    // Default: header=row 0, data=row 1
    document.getElementById("loop-header-row").value = "0";
    document.getElementById("loop-data-row").value = "1";

    updateLoopCellLabels(tableIdx);

    showToast("Loop mode: assign columns to groups, then save", "info");

    document.querySelectorAll(".doc-table-wrapper").forEach(el => el.classList.remove("loop-active"));
    document.querySelector(`[data-table-idx="${tableIdx}"]`)?.classList.add("loop-active");

    const secondRowEl = document.querySelector(`tr[data-table="${tableIdx}"][data-row="1"]`);
    if (secondRowEl) { loopSelectedRows.add(1); secondRowEl.classList.add("loop-selected"); }
}

function updateLoopCellLabels(tableIdx) {
    const table = currentStructure.tables.find(t => t.table_index === tableIdx);
    if (!table) return;

    const headerRowIdx = parseInt(document.getElementById("loop-header-row").value);
    const dataRowIdx = parseInt(document.getElementById("loop-data-row").value);

    const headerRow = table.rows.find(r => r.row_index === headerRowIdx);
    const dataRow = table.rows.find(r => r.row_index === dataRowIdx);
    if (!headerRow || !dataRow) return;

    // Auto-detect repeating header pattern for smart group suggestion
    const headers = dataRow.cells.map((_, i) => headerRow.cells[i]?.text || `Col ${i}`);
    const headerGroups = autoDetectGroups(headers);

    const container = document.getElementById("loop-cell-labels-inner");
    let html = "";

    dataRow.cells.forEach((cell, i) => {
        const headerText = headers[i];
        const suggested = headerText.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        const groupName = headerGroups[i] || "items";
        html += `
            <div class="loop-cell-row multi-group">
                <span class="loop-cell-header">${esc(headerText)}</span>
                <span class="loop-cell-value">"${esc(cell.text || '—')}"</span>
                <input type="text" class="input loop-group-input" data-col="${cell.col_index}"
                       value="${groupName}" placeholder="group name" title="Loop group (e.g. items1)">
                <input type="text" class="input loop-cell-input" data-col="${cell.col_index}"
                       data-original="${esc(cell.text)}" value="${suggested}" placeholder="field label">
            </div>`;
    });

    container.innerHTML = html;

    // Update visual selection
    document.querySelectorAll(`tr[data-table="${tableIdx}"]`).forEach(el => el.classList.remove("loop-selected"));
    loopSelectedRows.clear();
    loopSelectedRows.add(dataRowIdx);
    const rowEl = document.querySelector(`tr[data-table="${tableIdx}"][data-row="${dataRowIdx}"]`);
    if (rowEl) rowEl.classList.add("loop-selected");
}

function autoDetectGroups(headers) {
    // Detect repeating column patterns like [STT, NAME, YEAR, STT, NAME, YEAR]
    // and assign group1, group2, etc.
    const n = headers.length;
    if (n <= 3) return headers.map(() => "items");

    // Try pattern lengths 2, 3, 4...
    for (let pLen = 2; pLen <= Math.floor(n / 2); pLen++) {
        if (n % pLen !== 0) continue;
        const pattern = headers.slice(0, pLen);
        let matches = true;
        for (let g = 1; g < n / pLen; g++) {
            for (let j = 0; j < pLen; j++) {
                if (headers[g * pLen + j] !== pattern[j]) { matches = false; break; }
            }
            if (!matches) break;
        }
        if (matches) {
            // Found repeating pattern!
            const groups = [];
            const numGroups = n / pLen;
            for (let g = 0; g < numGroups; g++) {
                for (let j = 0; j < pLen; j++) {
                    groups.push(numGroups > 1 ? `items${g + 1}` : "items");
                }
            }
            return groups;
        }
    }
    return headers.map(() => "items");
}

function cancelLoopMode() {
    loopModeActive = false;
    loopTableIndex = null;
    loopSelectedRows.clear();
    document.getElementById("loop-form").style.display = "none";
    document.querySelectorAll(".doc-table-wrapper").forEach(el => el.classList.remove("loop-active"));
    document.querySelectorAll("tr").forEach(el => el.classList.remove("loop-selected"));
}

async function saveLoopMapping() {
    const dataRowIdx = parseInt(document.getElementById("loop-data-row").value);

    // Collect all columns with their group + label
    const rows = document.querySelectorAll(".loop-cell-row.multi-group");
    const columnMap = []; // [{col_index, group, label, original_text}]
    rows.forEach(row => {
        const groupInput = row.querySelector(".loop-group-input");
        const labelInput = row.querySelector(".loop-cell-input");
        const group = groupInput?.value.trim() || "";
        const label = labelInput?.value.trim() || "";
        if (!group || !label) return; // skip columns without group or label

        if (!/^[a-z_][a-z0-9_]*$/.test(group)) { showToast(`Group "${group}": lowercase + underscores only`, "error"); return; }
        if (!/^[a-z_][a-z0-9_]*$/.test(label)) { showToast(`Label "${label}": lowercase + underscores only`, "error"); return; }

        columnMap.push({
            col_index: parseInt(groupInput.dataset.col),
            group: group,
            label: label,
            original_text: labelInput.dataset.original || "",
        });
    });

    if (columnMap.length === 0) { showToast("Assign at least one column to a group", "error"); return; }

    // Group columns by their group name
    const groups = {};
    columnMap.forEach(col => {
        if (!groups[col.group]) groups[col.group] = [];
        groups[col.group].push({ col_index: col.col_index, label: col.label, original_text: col.original_text });
    });

    try {
        const groupNames = Object.keys(groups);
        for (const groupName of groupNames) {
            await apiPost(`/${currentTemplateId}/mappings`, {
                mapping_type: "table_loop",
                table_index: loopTableIndex,
                data_row_index: dataRowIdx,
                loop_variable: groupName,
                cell_labels: groups[groupName],
            });
        }
        showToast(`Loop created: ${groupNames.map(g => g).join(", ")} (${columnMap.length} cols)`, "success");
        cancelLoopMode();
        openDesigner(currentTemplateId);
    } catch (e) { showToast(`Error: ${e.message}`, "error"); }
}

// ═══════════════════════════════════════════
// DELETE MAPPING
// ═══════════════════════════════════════════

async function deleteMapping(id) {
    try { await apiDelete(`/${currentTemplateId}/mappings/${id}`); showToast("Deleted", "info"); openDesigner(currentTemplateId); }
    catch { showToast("Delete failed", "error"); }
}

// ═══════════════════════════════════════════
// PUBLISH
// ═══════════════════════════════════════════

async function publishTemplate() {
    if (!currentTemplateId || !confirm("Publish? Mappings will be locked.")) return;
    try { await apiPost(`/${currentTemplateId}/publish`, {}); showToast("Published! 🚀", "success"); openDesigner(currentTemplateId); loadDashboard(); }
    catch (e) { showToast(`Publish failed: ${e.message}`, "error"); }
}

// ═══════════════════════════════════════════
// RENDER DOCUMENT
// ═══════════════════════════════════════════

let directTempId = null;

async function loadRenderView() {
    try {
        const templatesResp = await apiGet("/list");
        const templates = Array.isArray(templatesResp) ? templatesResp : (templatesResp.templates || []);
        const list = document.getElementById("render-template-list");
        const published = templates.filter(t => t.status === "published");
        if (!published.length) {
            list.innerHTML = `<div class="empty-state small"><p>No published templates available.</p></div>`;
            return;
        }
        list.innerHTML = published.map(t =>
            `<div class="render-template-item" onclick="selectRenderTemplate('${t.id}', this)" title="${t.name}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
                <div class="render-template-name">${esc(t.name)}</div>
            </div>`
        ).join("");
    } catch (e) { showToast("Failed to load templates", "error"); 
        console.error("[loadRenderView] Error loading templates:", e);
    }
}

function openRender(tid) { navigateTo("render"); setTimeout(() => selectRenderTemplate(tid), 300); }

async function selectRenderTemplate(tid, el) {
    document.querySelectorAll(".render-template-item").forEach(e => e.classList.remove("selected"));
    if (el) el.classList.add("selected");
    currentTemplateId = tid;
    directTempId = null;
    try {
        const schema = await apiGet(`/${tid}/schema`);
        buildRenderForm(schema);
        document.getElementById("render-form-card").style.display = "block";
        document.getElementById("render-result-card").style.display = "none";
        // Reset tab
        switchRenderTab("form");
    } catch (e) { showToast("Failed", "error"); }
}

async function uploadDirectTemplate(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.querySelectorAll(".render-template-item").forEach(el => el.classList.remove("selected"));
    currentTemplateId = null;

    const formData = new FormData();
    formData.append("file", file);

    document.getElementById("render-form-card").style.display = "none";
    document.getElementById("render-result-card").style.display = "none";

    try {
        const res = await fetch(`${RENDER_API}/extract`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || "Upload failed");
        }
        const data = await res.json();
        directTempId = data.temp_id;

        buildRenderForm(data.schema);
        document.getElementById("render-form-card").style.display = "block";
        switchRenderTab("form");

        // update api snippet for direct render
        const sampleData = extractSampleDataFromSchema(data.schema);
        const snippet = `curl -X POST ${RENDER_API}/direct/${directTempId} \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(sampleData, null, 2)}'`;
        document.getElementById("api-request-code").textContent = snippet;

        showToast("Extracted fields successfully", "success");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        e.target.value = ""; // reset input
    }
}

function extractSampleDataFromSchema(schema) {
    const sampleData = {};
    schema.fields.forEach(f => {
        if (f.type === "array" && f.sub_fields) {
            const row = {};
            f.sub_fields.forEach(sf => row[sf.name] = `value`);
            sampleData[f.name] = [row];
        } else {
            sampleData[f.name] = `value`;
        }
    });
    return sampleData;
}

function buildRenderForm(schema) {
    document.getElementById("render-form-title").textContent = `Fill Data — ${schema.template_name}`;
    const fc = document.getElementById("render-form-fields");
    let html = "";

    schema.fields.forEach(field => {
        if (field.type === "array" && field.sub_fields) {
            // Array field - show a mini form for adding items
            html += `<div class="form-group array-field" data-field="${field.name}">
                <label>${field.name.replace(/_/g, " ")} <span class="type-badge">array</span> <span style="color:var(--accent-red)">*</span></label>
                <div class="array-items" id="array-items-${field.name}"></div>
                <div class="array-add-row" id="array-add-${field.name}">`;
            field.sub_fields.forEach(sf => {
                html += `<input type="text" class="input input-sm" placeholder="${sf.name}" data-subfield="${sf.name}">`;
            });
            html += `<button type="button" class="btn btn-sm btn-outline" onclick="addArrayItem('${field.name}')">+ Add Row</button>
                </div>
            </div>`;
        } else {
            html += `<div class="form-group">
                <label for="field-${field.name}">${field.name.replace(/_/g, " ")}
                    <span class="type-badge">${field.type}</span>
                    ${field.required ? '<span style="color:var(--accent-red)">*</span>' : ""}
                </label>
                <input type="text" id="field-${field.name}" name="${field.name}" class="input"
                       placeholder="${field.original_text || field.name}" ${field.required ? "required" : ""}>
                ${field.original_text ? `<div class="original-text-hint">Original: "${esc(field.original_text)}"</div>` : ""}
            </div>`;
        }
    });
    fc.innerHTML = html;

    // Generate API Snippet
    const sampleData = extractSampleDataFromSchema(schema);
    const apiPath = directTempId ? `/api/v1/render/direct/${directTempId}` : `/api/v1/designer/${currentTemplateId}/render`;

    const snippet = `curl -X POST ${API_BASE}${apiPath} \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(sampleData, null, 2)}'`;

    document.getElementById("api-request-code").textContent = snippet;
}

// Tab Switching
function switchRenderTab(tab) {
    document.getElementById("tab-btn-form").classList.toggle("active", tab === "form");
    document.getElementById("tab-btn-api").classList.toggle("active", tab === "api");
    document.getElementById("render-tab-form").style.display = tab === "form" ? "block" : "none";
    document.getElementById("render-tab-api").style.display = tab === "api" ? "block" : "none";
}

function copyApiCode() {
    const code = document.getElementById("api-request-code").textContent;
    navigator.clipboard.writeText(code);
    showToast("Copied code to clipboard!", "success");
}

// Array items management
const _arrayData = {};
function addArrayItem(fieldName) {
    const container = document.getElementById(`array-add-${fieldName}`);
    const inputs = container.querySelectorAll("input[data-subfield]");
    const item = {};
    let hasData = false;
    inputs.forEach(inp => {
        if (inp.value.trim()) { item[inp.dataset.subfield] = inp.value.trim(); hasData = true; }
        inp.value = "";
    });
    if (!hasData) { showToast("Enter at least one value", "error"); return; }

    if (!_arrayData[fieldName]) _arrayData[fieldName] = [];
    _arrayData[fieldName].push(item);

    renderArrayItems(fieldName);
    inputs[0]?.focus();
}

function removeArrayItem(fieldName, idx) {
    _arrayData[fieldName]?.splice(idx, 1);
    renderArrayItems(fieldName);
}

function renderArrayItems(fieldName) {
    const c = document.getElementById(`array-items-${fieldName}`);
    const items = _arrayData[fieldName] || [];
    if (!items.length) { c.innerHTML = ""; return; }
    c.innerHTML = `<table class="array-preview-table"><thead><tr>${Object.keys(items[0]).map(k => `<th>${k}</th>`).join("")}<th></th></tr></thead><tbody>` +
        items.map((item, i) =>
            `<tr>${Object.values(item).map(v => `<td>${esc(v)}</td>`).join("")}<td><button class="btn btn-sm btn-ghost" onclick="removeArrayItem('${fieldName}',${i})">✕</button></td></tr>`
        ).join("") + `</tbody></table>`;
}

async function renderDocument(event) {
    event.preventDefault();
    const form = document.getElementById("render-form");
    const formData = new FormData(form);
    const data = {};
    formData.forEach((v, k) => { if (v) data[k] = v; });
    // Add array data
    Object.keys(_arrayData).forEach(k => { if (_arrayData[k]?.length) data[k] = _arrayData[k]; });

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Rendering...';
    try {
        let result;
        if (directTempId) {
            const r = await fetch(`${RENDER_API}/direct/${directTempId}`, {
                method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify(data)
            });
            if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || "Direct Render failed"); }
            result = await r.json();
        } else {
            result = await apiPost(`/${currentTemplateId}/render`, data);
        }

        showRenderResult(result);
        showToast("Rendered! 🎉", "success");
    } catch (e) { showToast(`Render failed: ${e.message}`, "error"); }
    finally { btn.disabled = false; btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Render Document`; }
}

function showRenderResult(result) {
    document.getElementById("render-result-card").style.display = "block";
    document.getElementById("render-result").innerHTML = `
        <div class="result-success">
            <div class="result-row"><label>Doc ID</label><span class="value">${result.document_id}</span></div>
            <div class="result-row"><label>Status</label><span class="badge ${result.status === 'completed' ? 'green' : 'amber'}">${result.status}</span></div>
            <div class="result-row"><label>DOCX</label><span class="value">${result.docx_path ? "✅" : "❌"}</span></div>
            <div class="result-row"><label>PDF</label><span class="value">${result.pdf_path ? "✅" : "⚠️"}</span></div>
            <div class="download-buttons">
                ${result.docx_path ? `<a href="${RENDER_API}/document/${result.document_id}/download" class="btn btn-primary" target="_blank">📄 Download</a>` : ""}
            </div>
        </div>`;
    document.getElementById("render-result-card").scrollIntoView({ behavior: "smooth" });
}

// ═══════════════════════════════════════════
// DELETE TEMPLATE
// ═══════════════════════════════════════════

async function deleteTemplateConfirm(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await apiDelete(`/${id}`); showToast("Deleted", "info"); loadDashboard(); }
    catch { showToast("Failed", "error"); }
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════

function showToast(msg, type = "info") {
    const icons = {
        success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };
    const t = document.createElement("div"); t.className = `toast ${type}`;
    t.innerHTML = `${icons[type] || icons.info}<span class="toast-message">${esc(msg)}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById("toast-container").appendChild(t);
    setTimeout(() => { t.classList.add("removing"); setTimeout(() => t.remove(), 300); }, 4000);
}

// ═══════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════

function esc(t) { if (!t) return ""; const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
