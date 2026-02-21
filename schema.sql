-- =============================================================
-- EZ Compliance Tracker — PostgreSQL Schema
-- PRD v1.0 | Section 7
-- Tables created in foreign-key dependency order:
--   1. compliance_rules   (no FK dependencies)
--   2. companies          (no FK dependencies)
--   3. users              (depends on companies)
--   4. compliance_calendar(depends on companies + compliance_rules)
--   5. audit_log          (standalone — no FK constraints)
-- =============================================================

-- -------------------------------------------------------------
-- Table 1: compliance_rules
-- Stores all pre-loaded compliance rules (≈45 for MVP).
-- Uses PostgreSQL TEXT[] arrays for multi-value filters.
-- -------------------------------------------------------------
CREATE TABLE compliance_rules (
    rule_id           SERIAL        PRIMARY KEY,
    rule_name         VARCHAR(255)  NOT NULL,
    description       TEXT,
    industry_type     TEXT[]        DEFAULT ARRAY['ALL'],
    applicable_states TEXT[]        DEFAULT ARRAY['ALL'],
    company_type      TEXT[]        DEFAULT ARRAY['ALL'],
    min_employees     INT           DEFAULT 0,
    max_employees     INT           DEFAULT 999999,
    frequency_months  INT           NOT NULL,
    document_required BOOLEAN       DEFAULT FALSE,
    penalty_amount    VARCHAR(255),
    penalty_impact    VARCHAR(20)   CHECK (penalty_impact IN ('Imprisonment', 'High', 'Medium', 'Low')),
    -- scope: 'Company' = one upload for all branches | 'Branch' = one upload per branch
    scope             VARCHAR(20)   CHECK (scope IN ('Company', 'Branch')),
    is_active         BOOLEAN       DEFAULT TRUE
);

-- -------------------------------------------------------------
-- Table 2: companies
-- Stores every client company that signs up on the platform.
-- -------------------------------------------------------------
CREATE TABLE companies (
    company_id     SERIAL       PRIMARY KEY,
    company_name   VARCHAR(255) NOT NULL,
    industry_type  TEXT[],
    company_type   TEXT[],
    hq_state       VARCHAR(50),
    branch_states  TEXT[],
    employee_count INT,
    subscription   VARCHAR(20)  CHECK (subscription IN ('Basic', 'Enterprise')),
    created_at     TIMESTAMP    DEFAULT NOW()
);

-- -------------------------------------------------------------
-- Table 3: users
-- Depends on: companies (company_id FK)
-- -------------------------------------------------------------
CREATE TABLE users (
    user_id       SERIAL       PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(20)  CHECK (role IN ('developer', 'company')),
    company_id    INT          REFERENCES companies(company_id),
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- -------------------------------------------------------------
-- Table 4: compliance_calendar
-- Depends on: companies (company_id FK), compliance_rules (rule_id FK)
-- One row per (company × rule × branch_state) combination.
-- -------------------------------------------------------------
CREATE TABLE compliance_calendar (
    calendar_id   SERIAL       PRIMARY KEY,
    company_id    INT          REFERENCES companies(company_id),
    rule_id       INT          REFERENCES compliance_rules(rule_id),
    branch_state  VARCHAR(50),
    due_date      DATE,
    status        VARCHAR(20)  DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'COMPLETED', 'OVERDUE-PASS', 'FAILED')),
    document_url  VARCHAR(500),
    ocr_verified  BOOLEAN      DEFAULT FALSE,
    ocr_result    TEXT,
    verified_at   TIMESTAMP,
    next_due_date DATE
);

-- -------------------------------------------------------------
-- Table 5: audit_log
-- Tracks every ADD / UPDATE / DELETE on compliance rules.
-- rule_id is stored as plain INT (no FK) so deleted rules
-- can still be referenced in historical log entries.
-- -------------------------------------------------------------
CREATE TABLE audit_log (
    log_id     SERIAL      PRIMARY KEY,
    action     VARCHAR(20) CHECK (action IN ('ADD', 'UPDATE', 'DELETE')),
    table_name VARCHAR(50),
    rule_id    INT,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP   DEFAULT NOW(),
    old_value  JSONB,
    new_value  JSONB
);
