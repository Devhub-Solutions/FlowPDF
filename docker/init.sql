-- Document Automation System — MySQL Schema
-- Auto-runs on first docker-compose up

CREATE DATABASE IF NOT EXISTS doc_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE doc_automation;

-- ═══ Templates ═══
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    template_path VARCHAR(500) DEFAULT NULL,
    status ENUM('draft', 'published') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ═══ Template Mappings ═══
CREATE TABLE IF NOT EXISTS template_mappings (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL,
    mapping_type ENUM('paragraph', 'table_cell', 'table_loop') NOT NULL DEFAULT 'paragraph',
    label VARCHAR(100) DEFAULT NULL,
    paragraph_index INT DEFAULT NULL,
    table_index INT DEFAULT NULL,
    row_index INT DEFAULT NULL,
    col_index INT DEFAULT NULL,
    original_text TEXT DEFAULT NULL,
    required TINYINT(1) DEFAULT 1,
    field_type VARCHAR(50) DEFAULT 'string',
    -- table_loop specific
    data_row_index INT DEFAULT NULL,
    loop_variable VARCHAR(100) DEFAULT NULL,
    cell_labels JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    INDEX idx_template (template_id),
    INDEX idx_type (mapping_type)
) ENGINE=InnoDB;

-- ═══ Rendered Documents ═══
CREATE TABLE IF NOT EXISTS rendered_documents (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL,
    data JSON DEFAULT NULL,
    docx_path VARCHAR(500) DEFAULT NULL,
    pdf_path VARCHAR(500) DEFAULT NULL,
    status ENUM('pending', 'completed', 'docx_only', 'failed') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    INDEX idx_template (template_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ═══ Activity Logs ═══
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) DEFAULT NULL,
    entity_id VARCHAR(36) DEFAULT NULL,
    details JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;
