from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime
import uuid


# ─── Template Models ───

class TemplateBase(BaseModel):
    name: str
    status: str = "draft"  # draft | published

class TemplateCreate(BaseModel):
    name: Optional[str] = None

class TemplateInfo(TemplateBase):
    id: str
    file_path: str
    template_path: Optional[str] = None  # processed template with {{vars}}
    created_at: str
    mappings_count: int = 0


# ─── Document Structure Models ───

class DocumentElement(BaseModel):
    """Represents a parsed element from the DOCX."""
    type: Literal["paragraph", "table_cell", "header", "footer"]
    index: int
    text: str
    # For table cells
    table_index: Optional[int] = None
    row: Optional[int] = None
    col: Optional[int] = None
    # Run-level detail
    runs: Optional[List[Dict[str, Any]]] = None

class DocumentStructure(BaseModel):
    template_id: str
    elements: List[DocumentElement]
    total_paragraphs: int = 0
    total_tables: int = 0


# ─── Mapping Models ───

class MappingLocation(BaseModel):
    """Location of text to replace in the document."""
    type: Literal["paragraph", "table_cell"]
    index: int  # paragraph index or table_cell combined index
    start_offset: int  # character offset within the element text
    end_offset: int  # character offset end
    # For table cells
    table_index: Optional[int] = None
    row: Optional[int] = None
    col: Optional[int] = None

class MappingCreate(BaseModel):
    label: str = Field(..., description="Variable name, e.g. customer_name")
    location: MappingLocation
    required: bool = True
    field_type: str = "string"  # string | number | date | currency

class MappingUpdate(BaseModel):
    label: Optional[str] = None
    required: Optional[bool] = None
    field_type: Optional[str] = None

class MappingInfo(BaseModel):
    id: str
    template_id: str
    label: str
    location: MappingLocation
    original_text: str
    required: bool = True
    field_type: str = "string"


# ─── Schema Models ───

class SchemaField(BaseModel):
    name: str
    type: str
    required: bool
    original_text: Optional[str] = None

class TemplateSchema(BaseModel):
    template_id: str
    template_name: str
    status: str
    fields: List[SchemaField]


# ─── Render Models ───

class RenderRequest(BaseModel):
    data: Dict[str, Any]

class RenderResponse(BaseModel):
    document_id: str
    template_id: str
    docx_path: str
    pdf_path: Optional[str] = None
    status: str
