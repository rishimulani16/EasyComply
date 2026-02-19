"""
demo_seed.py — EZ Compliance Tracker demo data seeder
======================================================
Run from the /backend directory:
    python demo_seed.py

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

from dotenv import load_dotenv
from passlib.context import CryptContext
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/ez_compliance",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Auto-matching SQL (mirrors routers/company.py) ─────────────────────────

AUTO_MATCH_SQL = text("""
    SELECT rule_id, frequency_months, document_required
    FROM compliance_rules
    WHERE
        (industry_type && :industries::TEXT[] OR 'ALL' = ANY(industry_type))
        AND (applicable_states && :states::TEXT[]     OR 'ALL' = ANY(applicable_states))
        AND (company_type && :comp_types::TEXT[]       OR 'ALL' = ANY(company_type))
        AND min_employees <= :emp_count
        AND max_employees >= :emp_count
        AND is_active = TRUE
""")

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


# ── Helper: assign a random demo status ────────────────────────────────────

def _random_status_row(company_id: int, rule_id: int, branch_state: str | None):
    """Return a dict of compliance_calendar column values with a random demo status."""
    roll = random.random()
    today = date.today()

    base = {
        "company_id":   company_id,
        "rule_id":      rule_id,
        "branch_state": branch_state,
        "document_url": None,
        "ocr_verified": False,
        "ocr_result":   None,
        "verified_at":  None,
        "next_due_date": None,
    }

    if roll < 0.30:  # 30 % — COMPLETED
        base.update({
            "status":       "COMPLETED",
            "due_date":     today - timedelta(days=random.randint(5, 30)),
            "ocr_verified": True,
            "document_url": "demo_doc.pdf",
            "verified_at":  datetime.now(timezone.utc) - timedelta(days=5),
        })
    elif roll < 0.70:  # 40 % — PENDING
        base.update({
            "status":   "PENDING",
            "due_date": today + timedelta(days=random.randint(1, 30)),
        })
    else:  # 30 % — OVERDUE
        base.update({
            "status":   "OVERDUE",
            "due_date": today - timedelta(days=random.randint(1, 20)),
        })

    return base


# ── Main seeder ─────────────────────────────────────────────────────────────

def main():
    db = Session()
    try:
        # ── 1. Developer user ────────────────────────────────────────────
        dev_email = "admin@ezcompliance.in"
        exists = db.execute(
            text("SELECT user_id FROM users WHERE email = :e"), {"e": dev_email}
        ).fetchone()

        if not exists:
            db.execute(
                text("""
                    INSERT INTO users (email, password_hash, role, company_id)
                    VALUES (:email, :pw, 'developer', NULL)
                """),
                {"email": dev_email, "pw": pwd_ctx.hash("Admin@1234")},
            )
            db.commit()
            print(f"  ✅  Developer inserted: {dev_email}")
        else:
            print(f"  ⏭   Developer already exists: {dev_email}")

        # ── 2. Companies ─────────────────────────────────────────────────
        results = []  # (email, rules_matched)

        for cfg in COMPANIES:
            # Check if company already seeded
            c_row = db.execute(
                text("SELECT company_id FROM companies WHERE company_name = :n"),
                {"n": cfg["name"]},
            ).fetchone()

            if c_row:
                # Just count existing calendar rows
                count = db.execute(
                    text("SELECT COUNT(*) FROM compliance_calendar WHERE company_id = :cid"),
                    {"cid": c_row[0]},
                ).scalar()
                print(f"  ⏭   Company already exists: {cfg['name']} ({count} calendar rows)")
                results.append((cfg["email"], count))
                continue

            # Insert company
            company_id = db.execute(
                text("""
                    INSERT INTO companies
                        (company_name, industry_type, company_type, hq_state,
                         branch_states, employee_count, subscription)
                    VALUES
                        (:name, :industry::TEXT[], :ctype::TEXT[], :hq,
                         :branches::TEXT[], :emp, :sub)
                    RETURNING company_id
                """),
                {
                    "name":     cfg["name"],
                    "industry": "{" + ",".join(cfg["industry"]) + "}",
                    "ctype":    "{" + ",".join(cfg["company_type"]) + "}",
                    "hq":       cfg["hq_state"],
                    "branches": "{" + ",".join(cfg["branch_states"]) + "}",
                    "emp":      cfg["employees"],
                    "sub":      cfg["subscription"],
                },
            ).scalar()

            # Insert admin user
            user_exists = db.execute(
                text("SELECT user_id FROM users WHERE email = :e"), {"e": cfg["email"]}
            ).fetchone()
            if not user_exists:
                db.execute(
                    text("""
                        INSERT INTO users (email, password_hash, role, company_id)
                        VALUES (:email, :pw, 'company', :cid)
                    """),
                    {
                        "email": cfg["email"],
                        "pw":    pwd_ctx.hash(cfg["password"]),
                        "cid":   company_id,
                    },
                )

            db.commit()

            # Auto-match rules
            all_states = [cfg["hq_state"]] + cfg["branch_states"]
            rows = db.execute(
                AUTO_MATCH_SQL,
                {
                    "industries": "{" + ",".join(cfg["industry"]) + "}",
                    "states":     "{" + ",".join(all_states) + "}",
                    "comp_types": "{" + ",".join(cfg["company_type"]) + "}",
                    "emp_count":  cfg["employees"],
                },
            ).fetchall()

            # Insert calendar rows with random demo statuses
            cal_rows_inserted = 0
            for rule_row in rows:
                rule_id, freq_months, _ = rule_row

                # For Enterprise with branches, create one row per relevant state.
                # For Basic, create one row per matched rule (no branch split here).
                states_for_rule = [None]  # None = company-level / HQ
                if cfg["subscription"] == "Enterprise" and cfg["branch_states"]:
                    states_for_rule = [None] + cfg["branch_states"]

                for branch_state in states_for_rule:
                    payload = _random_status_row(company_id, rule_id, branch_state)

                    # Compute next_due_date if completed
                    if payload["status"] == "COMPLETED" and payload["due_date"]:
                        from dateutil.relativedelta import relativedelta
                        payload["next_due_date"] = payload["due_date"] + relativedelta(months=freq_months)

                    db.execute(
                        text("""
                            INSERT INTO compliance_calendar
                                (company_id, rule_id, branch_state, due_date, status,
                                 document_url, ocr_verified, ocr_result,
                                 verified_at, next_due_date)
                            VALUES
                                (:company_id, :rule_id, :branch_state, :due_date, :status,
                                 :document_url, :ocr_verified, :ocr_result,
                                 :verified_at, :next_due_date)
                        """),
                        payload,
                    )
                    cal_rows_inserted += 1

            db.commit()
            print(f"  ✅  {cfg['name']}: {len(rows)} rules matched → {cal_rows_inserted} calendar rows")
            results.append((cfg["email"], cal_rows_inserted))

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    # ── Summary ──────────────────────────────────────────────────────────
    print("\n" + "─" * 55)
    print("Demo seed complete!")
    print(f"  Developer  : admin@ezcompliance.in  / Admin@1234")
    for (email, count), cfg in zip(results, COMPANIES):
        print(f"  {cfg['name'][:30]:<30}: {email} / Demo@1234  ({count} rules)")
    print("─" * 55)


if __name__ == "__main__":
    main()
