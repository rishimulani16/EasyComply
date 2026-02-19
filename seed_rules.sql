-- =============================================================
-- EZ Compliance Tracker — Seed Data: compliance_rules
-- 15 rules broken into 4 categories:
--   Rules  1–5  : ALL industries, ALL states (common rules)
--   Rules  6–9  : AI / IT industry only
--   Rules 10–13 : Transport industry only
--   Rules 14–15 : Gujarat state specifically
-- =============================================================

INSERT INTO compliance_rules
    (rule_name, description, industry_type, applicable_states, company_type,
     min_employees, max_employees, frequency_months,
     document_required, penalty_amount, penalty_impact, scope, is_active)
VALUES

-- =============================================================
-- BLOCK 1 — Common rules (ALL industries, ALL states)
-- =============================================================

(
    'GST Monthly Return (GSTR-3B)',
    'Every GST-registered business must file GSTR-3B monthly, summarising outward/inward supplies and net tax liability.',
    ARRAY['ALL'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 1,
    TRUE, 'Up to ₹10,000 per month (late fee) + 18% interest p.a.', 'Medium',
    'Company', TRUE
),

(
    'Provident Fund (PF) Monthly Contribution',
    'Employers with 20+ employees must deposit EPF contributions (employer 12% + employee 12%) by the 15th of each month.',
    ARRAY['ALL'], ARRAY['ALL'], ARRAY['ALL'],
    20, 999999, 1,
    TRUE, 'Interest at 12% p.a. + damages up to 25% of arrears', 'High',
    'Company', TRUE
),

(
    'ESI Monthly Contribution',
    'Employers with 10+ employees (wages ≤ ₹21,000/month) must deposit ESI contributions by the 15th of each month.',
    ARRAY['ALL'], ARRAY['ALL'], ARRAY['ALL'],
    10, 999999, 1,
    TRUE, 'Interest at 12% p.a. + prosecution under ESI Act', 'High',
    'Company', TRUE
),

(
    'Annual TDS Return (Form 24Q / 26Q)',
    'Annual reconciliation of TDS deducted and deposited — mandatory for all entities deducting tax at source.',
    ARRAY['ALL'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, '₹200 per day late fee + penalty up to TDS amount', 'High',
    'Company', TRUE
),

(
    'Income Tax Annual Filing (ITR)',
    'All companies must file their income-tax return for the relevant assessment year by the due date (usually 31 Oct for audited entities).',
    ARRAY['ALL'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Penalty up to ₹10,000 + interest u/s 234A/B/C', 'High',
    'Company', TRUE
),

-- =============================================================
-- BLOCK 2 — AI / IT industry rules
-- =============================================================

(
    'DPDP Annual Privacy Audit',
    'Under the Digital Personal Data Protection Act 2023, AI/IT firms processing personal data must conduct and document an annual privacy audit.',
    ARRAY['AI', 'IT'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Up to ₹250 Crore per violation', 'Imprisonment',
    'Company', TRUE
),

(
    'IT Act Section 43A — Reasonable Security Practices',
    'Companies handling sensitive personal data must implement and certify reasonable security practices (ISO 27001 or equivalent) annually.',
    ARRAY['AI', 'IT'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Compensation liability up to actual loss suffered by individual', 'High',
    'Company', TRUE
),

(
    'Software Export Annual Return (STPI / SEZ)',
    'AI/IT companies registered under STPI or SEZ must file the Annual Performance Report (APR) with their respective authority.',
    ARRAY['AI', 'IT'], ARRAY['ALL'], ARRAY['Pvt Ltd', 'Public Ltd'],
    0, 999999, 12,
    TRUE, 'Penalty up to ₹5 Lakh + cancellation of STPI registration', 'Medium',
    'Company', TRUE
),

(
    'Professional Tax — IT Employees (Monthly)',
    'AI/IT companies must deduct and deposit Professional Tax from employee salaries monthly as prescribed by the respective state slab.',
    ARRAY['AI', 'IT'], ARRAY['ALL'], ARRAY['ALL'],
    1, 999999, 1,
    TRUE, 'Penalty up to ₹5,000 + arrears with interest', 'Low',
    'Company', TRUE
),

-- =============================================================
-- BLOCK 3 — Transport industry rules
-- =============================================================

(
    'Vehicle Fitness Certificate Renewal',
    'Every commercial vehicle must hold a valid fitness certificate issued by the RTO. Renewal is required every 12 months (new vehicles: 2 years).',
    ARRAY['Transport'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Vehicle detention + fine up to ₹10,000 per vehicle', 'High',
    'Branch', TRUE
),

(
    'Commercial Vehicle Road Permit (Inter-State)',
    'Transport operators running vehicles across state borders must hold a valid national or multi-state permits under the Motor Vehicles Act.',
    ARRAY['Transport'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Fine up to ₹10,000 + vehicle seizure', 'High',
    'Branch', TRUE
),

(
    'Motor Third-Party Insurance (Annual)',
    'All commercial vehicles must maintain valid third-party motor insurance as mandated under the Motor Vehicles Act, 1988.',
    ARRAY['Transport'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Fine up to ₹2,000 + vehicle impoundment', 'Medium',
    'Branch', TRUE
),

(
    'Driver Medical Fitness Certificate (Annual)',
    'All commercial vehicle drivers must obtain an annual medical fitness certificate from a registered physician confirming fitness to drive.',
    ARRAY['Transport'], ARRAY['ALL'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'License suspension + fine up to ₹5,000', 'Medium',
    'Branch', TRUE
),

-- =============================================================
-- BLOCK 4 — Gujarat state-specific rules
-- =============================================================

(
    'Gujarat Shops and Establishments Act — Annual Renewal',
    'All commercial establishments in Gujarat must renew their Shops & Establishments registration certificate annually with the Labour Commissioner.',
    ARRAY['ALL'], ARRAY['Gujarat'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Fine up to ₹20,000 + closure notice', 'Medium',
    'Branch', TRUE
),

(
    'Gujarat Professional Tax Enrollment Certificate (PTEC)',
    'Every employer and self-employed professional in Gujarat must obtain and annually renew the Professional Tax Enrollment Certificate from the Gujarat Commercial Tax Dept.',
    ARRAY['ALL'], ARRAY['Gujarat'], ARRAY['ALL'],
    0, 999999, 12,
    TRUE, 'Penalty up to ₹2,000 per year of default', 'Low',
    'Company', TRUE
);
