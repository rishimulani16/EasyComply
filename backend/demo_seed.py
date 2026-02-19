"""
demo_seed.py — EZ Compliance Tracker demo data seeder
======================================================
Run from the /backend directory:
    python demo_seed.py

Uses psycopg2 directly (bypasses SQLAlchemy text() colon-escaping
issues with PostgreSQL :: cast syntax).

Inserts:
  • 1 developer user (admin@ezcompliance.in / Admin@1234)
  • 2 company admins + their companies
  • compliance_calendar rows auto-matched from compliance_rules
    with realistic COMPLETED / PENDING / OVERDUE spread (30/40/30 %)

Safe to re-run — every insert is guarded by an existence check.
"""

import os
import random
from datetime import date, datetime, timedelta, timezone

import psycopg2
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://rishi@localhost:5432/ez_compliance",
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Company definitions ─────────────────────────────────────────────────────

COMPANIES = [
    {
        "name":          "TechAI Solutions Pvt Ltd",
        "industry":      ["AI"],
        "company_type":  ["Pvt Ltd"],
        "hq_state":      "Gujarat",
        "branch_states": [],
        "employees":     35,
        "subscription":  "Basic",
        "email":         "demo_ai@test.com",
        "password":      "Demo@1234",
    },
    {
        "name":          "FastMove Logistics Pvt Ltd",
        "industry":      ["Transport"],
        "company_type":  ["Pvt Ltd"],
        "hq_state":      "Maharashtra",
        "branch_states": ["Goa"],
        "employees":     120,
        "subscription":  "Enterprise",
        "email":         "demo_transport@test.com",
        "password":      "Demo@1234",
    },
]

# ── Auto-match SQL — pure SQL, no SQLAlchemy text() ──────────────────────────
# Uses %s-style psycopg2 placeholders + ::TEXT[] cast (no conflict)

AUTO_MATCH_SQL = """
    SELECT rule_id, frequency_months, document_required
    FROM compliance_rules
    WHERE
        (industry_type && %s::TEXT[] OR 'ALL' = ANY(industry_type))
        AND (applicable_states && %s::TEXT[] OR 'ALL' = ANY(applicable_states))
        AND (company_type && %s::TEXT[] OR 'ALL' = ANY(company_type))
        AND min_employees <= %s
        AND max_employees >= %s
        AND is_active = TRUE
"""

# ── Helper: parse DATABASE_URL for psycopg2 ──────────────────────────────────

def _parse_url(url: str) -> dict:
    """Convert postgresql://user:pass@host:port/dbname to psycopg2 kwargs."""
    from urllib.parse import urlparse
    r = urlparse(url)
    return {
        "dbname":   r.path.lstrip("/"),
        "user":     r.username or "",
        "password": r.password or "",
        "host":     r.hostname or "localhost",
        "port":     r.port or 5432,
    }


# ── Helper: random demo status for a calendar row ────────────────────────────

def _random_status_row(company_id: int, rule_id: int, freq_months: int, branch_state):
    today = date.today()
    roll = random.random()

    row = {
        "company_id":    company_id,
        "rule_id":       rule_id,
        "branch_state":  branch_state,
        "due_date":      None,
        "status":        "PENDING",
        "document_url":  None,
        "ocr_verified":  False,
        "ocr_result":    None,
        "verified_at":   None,
        "next_due_date": None,
    }

    if roll < 0.30:          # 30 % — COMPLETED
        past_due = today - timedelta(days=random.randint(5, 30))
        row.update({
            "status":        "COMPLETED",
            "due_date":      past_due,
            "ocr_verified":  True,
            "document_url":  "demo_doc.pdf",
            "verified_at":   datetime.now(timezone.utc) - timedelta(days=5),
            "next_due_date": past_due + relativedelta(months=freq_months),
        })
    elif roll < 0.70:        # 40 % — PENDING
        row.update({
            "status":   "PENDING",
            "due_date": today + timedelta(days=random.randint(1, 30)),
        })
    else:                    # 30 % — OVERDUE
        row.update({
            "status":   "OVERDUE",
            "due_date": today - timedelta(days=random.randint(1, 20)),
        })

    return row


# ── Main seeder ──────────────────────────────────────────────────────────────

def main():
    conn_kwargs = _parse_url(DATABASE_URL)
    conn = psycopg2.connect(**conn_kwargs)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # ── 1. Developer user ────────────────────────────────────────────────
        dev_email = "admin@ezcompliance.in"
        cur.execute("SELECT user_id FROM users WHERE email = %s", (dev_email,))
        if cur.fetchone() is None:
            cur.execute(
                "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, 'developer')",
                (dev_email, pwd_ctx.hash("Admin@1234")),
            )
            conn.commit()
            print(f"  ✅  Developer inserted: {dev_email}")
        else:
            print(f"  ⏭   Developer already exists: {dev_email}")

        # ── 2. Companies ─────────────────────────────────────────────────────
        results = []

        for cfg in COMPANIES:
            cur.execute("SELECT company_id FROM companies WHERE company_name = %s", (cfg["name"],))
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    "SELECT COUNT(*) FROM compliance_calendar WHERE company_id = %s",
                    (existing[0],)
                )
                count = cur.fetchone()[0]
                print(f"  ⏭   Already exists: {cfg['name']} ({count} calendar rows)")
                results.append((cfg["email"], count))
                continue

            # Insert company
            cur.execute(
                """INSERT INTO companies
                       (company_name, industry_type, company_type, hq_state,
                        branch_states, employee_count, subscription)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   RETURNING company_id""",
                (
                    cfg["name"],
                    cfg["industry"],          # psycopg2 maps Python list → TEXT[]
                    cfg["company_type"],
                    cfg["hq_state"],
                    cfg["branch_states"],
                    cfg["employees"],
                    cfg["subscription"],
                ),
            )
            company_id = cur.fetchone()[0]

            # Insert admin user
            cur.execute("SELECT user_id FROM users WHERE email = %s", (cfg["email"],))
            if cur.fetchone() is None:
                cur.execute(
                    "INSERT INTO users (email, password_hash, role, company_id) VALUES (%s, %s, 'company', %s)",
                    (cfg["email"], pwd_ctx.hash(cfg["password"]), company_id),
                )

            conn.commit()

            # Auto-match compliance rules
            all_states = [cfg["hq_state"]] + cfg["branch_states"]
            cur.execute(
                AUTO_MATCH_SQL,
                (
                    cfg["industry"],    # %s::TEXT[] — psycopg2 passes as {AI}
                    all_states,
                    cfg["company_type"],
                    cfg["employees"],
                    cfg["employees"],
                ),
            )
            matched_rules = cur.fetchall()  # [(rule_id, freq_months, doc_required), ...]

            # Build calendar rows
            cal_count = 0
            for rule_id, freq_months, _doc_req in matched_rules:
                # Enterprise: one row per branch_state too (None = HQ/company-level)
                states_for_rule = [None]
                if cfg["subscription"] == "Enterprise" and cfg["branch_states"]:
                    states_for_rule = [None] + cfg["branch_states"]

                for branch_state in states_for_rule:
                    row = _random_status_row(company_id, rule_id, freq_months, branch_state)
                    cur.execute(
                        """INSERT INTO compliance_calendar
                               (company_id, rule_id, branch_state, due_date, status,
                                document_url, ocr_verified, ocr_result,
                                verified_at, next_due_date)
                           VALUES
                               (%(company_id)s, %(rule_id)s, %(branch_state)s,
                                %(due_date)s, %(status)s, %(document_url)s,
                                %(ocr_verified)s, %(ocr_result)s,
                                %(verified_at)s, %(next_due_date)s)""",
                        row,
                    )
                    cal_count += 1

            conn.commit()
            print(f"  ✅  {cfg['name']}: {len(matched_rules)} rules matched → {cal_count} calendar rows")
            results.append((cfg["email"], cal_count))

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "─" * 58)
    print("Demo seed complete!")
    print(f"  Developer : admin@ezcompliance.in  /  Admin@1234")
    for (email, count), cfg in zip(results, COMPANIES):
        label = cfg["name"][:32]
        print(f"  {label:<32}: {email}  ({count} rules)")
    print("─" * 58)


if __name__ == "__main__":
    main()
