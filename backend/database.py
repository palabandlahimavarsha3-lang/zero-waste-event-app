import json
import os
import re
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path

from prediction import (
    BASELINE_RATES_KG_PER_ATTENDEE_HOUR,
    REDUCTION_MEASURES,
    WASTE_CATEGORIES,
    predict_waste,
)

PRED_FACTORS = {
    "Technical": 0.05,
    "Cultural": 0.08,
    "Food": 0.12,
    "Awareness": 0.03,
    "Sports": 0.07,
    "Student Club": 0.04,
    "Campus": 0.05,
}

# --- Database Connection and Configuration ---

def get_database_url():
    """Returns normalized Postgres connection URL if configured, otherwise None."""
    url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or os.environ.get("NEON_DATABASE_URL")
    )
    if url and (url.startswith("postgres://") or url.startswith("postgresql://")):
        # SQLAlchemy / psycopg2 compatibility: replace postgres:// with postgresql://
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        # Ensure sslmode=require for Neon serverless Postgres
        if "sslmode=" not in url:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}sslmode=require"
        return url
    return None


def is_postgres():
    return get_database_url() is not None


# SQLite Fallback Configuration
def _resolve_initial_db_path():
    env_path = os.environ.get("DATABASE_PATH")
    if env_path:
        return Path(env_path).resolve()
    instance_dir = Path(__file__).resolve().parent / "instance"
    os.makedirs(instance_dir, exist_ok=True)
    return (instance_dir / "zerowaste.db").resolve()

DB_PATH = _resolve_initial_db_path()

def _ensure_sqlite_file_copied():
    global DB_PATH
    if is_postgres():
        return
    os.makedirs(DB_PATH.parent, exist_ok=True)
    legacy_candidates = [
        Path(__file__).resolve().parent / "zerowaste.db",
        Path(__file__).resolve().parent / "zero_waste.db",
    ]
    if not DB_PATH.exists() or DB_PATH.stat().st_size == 0:
        for legacy in legacy_candidates:
            if legacy.exists() and legacy.resolve() != DB_PATH.resolve() and legacy.stat().st_size > 0:
                try:
                    shutil.copyfile(legacy, DB_PATH)
                    break
                except Exception:
                    pass

def set_db_path(new_path):
    global DB_PATH
    DB_PATH = Path(new_path).resolve()
    os.makedirs(DB_PATH.parent, exist_ok=True)
    _ensure_sqlite_file_copied()

_ensure_sqlite_file_copied()


# --- SQL Query Adapter for Postgres ---

def adapt_sql_for_postgres(sql):
    adapted = sql.replace('?', '%s')
    adapted = adapted.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    adapted = adapted.replace("strftime('%m', created_at)", "to_char(created_at::timestamp, 'MM')")
    adapted = adapted.replace("strftime('%Y-%m', created_at)", "to_char(created_at::timestamp, 'YYYY-MM')")
    adapted = adapted.replace("datetime('now')", "CURRENT_TIMESTAMP")
    # Cast SUM/COALESCE inside ROUND to numeric for Postgres float handling
    adapted = re.sub(
        r"ROUND\((COALESCE\(SUM\([^)]+\),\s*0\)),\s*2\)",
        r"ROUND((\1)::numeric, 2)",
        adapted,
        flags=re.IGNORECASE,
    )
    return adapted


def _format_pg_row(row):
    if row is None:
        return None
    # RealDictRow is a dict subclass. Ensure datetime/date objects are formatted as strings
    # for 100% parity with SQLite row responses
    formatted = dict(row)
    for k, v in formatted.items():
        if isinstance(v, (datetime, date)):
            formatted[k] = v.strftime("%Y-%m-%d %H:%M:%S")
    return formatted


class PostgresCursorWrapper:
    def __init__(self, raw_cursor):
        self._cursor = raw_cursor
        self.lastrowid = None

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description

    def execute(self, query, params=None):
        adapted = adapt_sql_for_postgres(query)
        is_insert = adapted.strip().upper().startswith("INSERT INTO")
        has_returning = "RETURNING" in adapted.upper()

        if is_insert and not has_returning:
            adapted = f"{adapted} RETURNING id"
            self._cursor.execute(adapted, params or ())
            try:
                row = self._cursor.fetchone()
                if row:
                    self.lastrowid = row["id"] if isinstance(row, dict) else row[0]
            except Exception:
                self.lastrowid = None
            return self

        self._cursor.execute(adapted, params or ())
        return self

    def executemany(self, query, params_list):
        adapted = adapt_sql_for_postgres(query)
        self._cursor.executemany(adapted, params_list)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        return _format_pg_row(row)

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [_format_pg_row(r) for r in rows]

    def close(self):
        self._cursor.close()

    def __iter__(self):
        for row in self._cursor:
            yield _format_pg_row(row)


class PostgresConnectionWrapper:
    def __init__(self, raw_connection):
        self._conn = raw_connection

    def cursor(self):
        import psycopg2.extras
        raw_cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return PostgresCursorWrapper(raw_cur)

    def execute(self, query, params=None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def get_connection():
    db_url = get_database_url()
    if db_url:
        import psycopg2
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        return PostgresConnectionWrapper(conn)
    else:
        os.makedirs(DB_PATH.parent, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn


@contextmanager
def get_db():
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _add_column_if_missing(cursor, table, column, definition):
    if is_postgres():
        row = cursor.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
            (table.lower(), column.lower()),
        ).fetchone()
        if not row:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}")
    else:
        existing = {row[1] for row in cursor.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _table_exists(cursor, name):
    if is_postgres():
        row = cursor.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_name = ? AND table_schema = 'public'",
            (name.lower(),),
        ).fetchone()
        return row is not None
    else:
        row = cursor.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            (name,),
        ).fetchone()
        return row is not None


def init_db():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            venue TEXT NOT NULL,
            event_date TEXT NOT NULL,
            attendees INTEGER NOT NULL DEFAULT 0,
            category TEXT NOT NULL DEFAULT 'Campus',
            status TEXT NOT NULL DEFAULT 'Upcoming',
            duration_hours REAL NOT NULL DEFAULT 4,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    if _table_exists(cursor, "waste_logs") and not _table_exists(cursor, "waste_reports"):
        cursor.execute("ALTER TABLE waste_logs RENAME TO waste_reports")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS waste_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            category TEXT NOT NULL CHECK (
                category IN ('recyclable', 'compost', 'landfill')
            ),
            amount_kg REAL NOT NULL CHECK (amount_kg >= 0),
            notes TEXT,
            reported_by TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS waste_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            event_type TEXT NOT NULL,
            attendees INTEGER NOT NULL CHECK (attendees >= 0),
            duration_hours REAL NOT NULL CHECK (duration_hours > 0),
            reduction_measures TEXT NOT NULL DEFAULT '[]',
            predicted_organic_kg REAL NOT NULL DEFAULT 0.0,
            predicted_plastic_kg REAL NOT NULL DEFAULT 0.0,
            predicted_paper_kg REAL NOT NULL DEFAULT 0.0,
            predicted_electronic_kg REAL NOT NULL DEFAULT 0.0,
            predicted_other_kg REAL NOT NULL DEFAULT 0.0,
            predicted_total_kg REAL NOT NULL,
            predicted_recyclable_kg REAL NOT NULL DEFAULT 0.0,
            predicted_compost_kg REAL NOT NULL DEFAULT 0.0,
            predicted_landfill_kg REAL NOT NULL DEFAULT 0.0,
            assumptions TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            event TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            message TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS campus_practices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            instead_of TEXT NOT NULL,
            recommended_use TEXT NOT NULL,
            impact TEXT NOT NULL,
            tip TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_waste (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            name TEXT NOT NULL,
            qty REAL NOT NULL,
            unit TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    _add_column_if_missing(cursor, "events", "attendees", "INTEGER NOT NULL DEFAULT 0")
    _add_column_if_missing(cursor, "events", "category", "TEXT NOT NULL DEFAULT 'Campus'")
    _add_column_if_missing(cursor, "events", "status", "TEXT NOT NULL DEFAULT 'Upcoming'")
    _add_column_if_missing(cursor, "events", "duration_hours", "REAL NOT NULL DEFAULT 4")
    _add_column_if_missing(cursor, "events", "updated_at", "TIMESTAMP")
    cursor.execute(
        """
        UPDATE events
        SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP)
        WHERE updated_at IS NULL OR updated_at = ''
        """
    )
    _add_column_if_missing(cursor, "waste_reports", "reported_by", "TEXT")

    # Migrations for waste_predictions
    _add_column_if_missing(cursor, "waste_predictions", "reduction_measures", "TEXT NOT NULL DEFAULT '[]'")
    _add_column_if_missing(cursor, "waste_predictions", "predicted_organic_kg", "REAL NOT NULL DEFAULT 0.0")
    _add_column_if_missing(cursor, "waste_predictions", "predicted_plastic_kg", "REAL NOT NULL DEFAULT 0.0")
    _add_column_if_missing(cursor, "waste_predictions", "predicted_paper_kg", "REAL NOT NULL DEFAULT 0.0")
    _add_column_if_missing(cursor, "waste_predictions", "predicted_electronic_kg", "REAL NOT NULL DEFAULT 0.0")
    _add_column_if_missing(cursor, "waste_predictions", "predicted_other_kg", "REAL NOT NULL DEFAULT 0.0")
    _add_column_if_missing(cursor, "waste_predictions", "assumptions", "TEXT NOT NULL DEFAULT '{}'")

    # Migrations for campus_practices
    _add_column_if_missing(cursor, "campus_practices", "waste_stream", "TEXT NOT NULL DEFAULT 'other'")

    # Backfill missing category breakdown on any legacy rows
    cursor.execute(
        """
        UPDATE waste_predictions
        SET predicted_organic_kg = predicted_compost_kg,
            predicted_plastic_kg = ROUND(predicted_recyclable_kg * 0.58, 2),
            predicted_paper_kg = ROUND(predicted_recyclable_kg * 0.36, 2),
            predicted_electronic_kg = ROUND(predicted_recyclable_kg * 0.06, 2),
            predicted_other_kg = predicted_landfill_kg
        WHERE (predicted_organic_kg IS NULL OR predicted_organic_kg = 0)
          AND (predicted_total_kg > 0)
        """
    )

    _seed_events(cursor)
    _seed_waste_reports(cursor)
    _seed_practices(cursor)
    _seed_predictions(cursor)
    _seed_audit_waste(cursor)

    connection.commit()
    connection.close()


def calculate_prediction(event_type, attendees, duration_hours, planned_measures=None):
    return predict_waste(event_type, attendees, duration_hours, planned_measures)


def _seed_events(cursor):
    sample_events = [
        ("SRIT Tech Fest", "Main Auditorium", "2026-10-15", 850, "Technical", "Upcoming", 8),
        ("Green Campus Drive", "Central Lawn", "2026-10-22", 220, "Awareness", "Upcoming", 3),
        ("Cultural Night", "Open Air Theatre", "2026-11-05", 1100, "Cultural", "Planning", 5),
        ("NSS Orientation", "Seminar Hall A", "2026-09-12", 180, "Student Club", "Completed", 3),
        ("Department Symposium", "CSE Block", "2026-08-28", 340, "Technical", "Completed", 6),
        ("Food Fest", "Canteen Lawn", "2026-08-04", 640, "Food", "Completed", 6),
    ]
    for event in sample_events:
        found = cursor.execute("SELECT id FROM events WHERE name = ?", (event[0],)).fetchone()
        if found is None:
            cursor.execute(
                """
                INSERT INTO events
                    (name, venue, event_date, attendees, category, status, duration_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                event,
            )
        else:
            cursor.execute(
                """
                UPDATE events
                SET attendees = CASE WHEN attendees = 0 THEN ? ELSE attendees END,
                    category = CASE WHEN category = 'Campus' THEN ? ELSE category END,
                    status = CASE WHEN status = 'Upcoming' AND ? != 'Upcoming' THEN ? ELSE status END
                WHERE id = ?
                """,
                (event[3], event[4], event[5], event[5], found["id"]),
            )


def _seed_waste_reports(cursor):
    waste_count = cursor.execute("SELECT COUNT(*) AS count FROM waste_reports").fetchone()
    if waste_count["count"] >= 5:
        return

    events_by_name = {
        row["name"]: row["id"]
        for row in cursor.execute("SELECT id, name FROM events").fetchall()
    }
    samples = [
        ("SRIT Tech Fest", "recyclable", 18.0, "Bottles and paper", "Eco Club", "2026-09-18 10:00:00"),
        ("SRIT Tech Fest", "compost", 9.5, "Canteen leftovers", "NSS", "2026-09-18 11:00:00"),
        ("SRIT Tech Fest", "landfill", 6.2, "Mixed stall waste", "Volunteer", "2026-09-18 12:00:00"),
        ("Green Campus Drive", "recyclable", 4.1, "Paper posters", "Eco Club", "2026-09-22 09:00:00"),
        ("Green Campus Drive", "compost", 2.8, "Garden clippings", "NSS", "2026-09-22 10:00:00"),
        ("Green Campus Drive", "landfill", 1.3, "Glove wrappers", "Volunteer", "2026-09-22 11:00:00"),
        ("NSS Orientation", "recyclable", 3.1, "Registration forms", "NSS", "2026-09-12 14:00:00"),
        ("NSS Orientation", "compost", 2.0, "Fruit peels", "Canteen", "2026-09-12 15:00:00"),
        ("NSS Orientation", "landfill", 1.3, "Snack packets", "Volunteer", "2026-09-12 16:00:00"),
        ("Department Symposium", "recyclable", 11.0, "Badges and paper", "CSE Dept", "2026-08-28 10:00:00"),
        ("Department Symposium", "compost", 4.6, "Lunch leftovers", "Canteen", "2026-08-28 13:00:00"),
        ("Department Symposium", "landfill", 4.2, "Decor scraps", "Volunteer", "2026-08-28 17:00:00"),
        ("Food Fest", "recyclable", 18.2, "Cans and bottles", "Eco Club", "2026-08-04 11:00:00"),
        ("Food Fest", "compost", 21.4, "Food waste", "Canteen", "2026-08-04 14:00:00"),
        ("Food Fest", "landfill", 8.5, "Plastic cutlery", "Volunteer", "2026-08-04 18:00:00"),
        ("Cultural Night", "recyclable", 8.4, "Rehearsal bottles", "Cultural Club", "2026-07-20 19:00:00"),
        ("Cultural Night", "compost", 3.2, "Snack waste", "Canteen", "2026-07-20 20:00:00"),
        ("Cultural Night", "landfill", 2.6, "Tape and craft bits", "Volunteer", "2026-07-20 21:00:00"),
    ]
    for name, category, amount, notes, reported_by, created_at in samples:
        event_id = events_by_name.get(name)
        if event_id is None:
            continue
        cursor.execute(
            """
            INSERT INTO waste_reports
                (event_id, category, amount_kg, notes, reported_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (event_id, category, amount, notes, reported_by, created_at),
        )


def _seed_practices(cursor):
    practices = [
        (
            "Plastic-Free Registration Kits",
            "PVC badge pouches, plastic ballpoint pens, synthetic lanyards",
            "Digital QR check-in, seed paper ID tags, cotton lanyards, recycled paper pens",
            "Eliminates up to 0.12 kg of single-use plastic per registered participant.",
            "Mandate digital check-in via SRIT portal; issue stamped reusable fabric wristbands.",
            "Technical",
            "plastic",
        ),
        (
            "Bulk Beverage Refill Dispensers",
            "Single-use 250ml/500ml PET water bottles and canned soft drinks",
            "20L bubble top refill dispensers + copper/stainless-steel reusable water carafes",
            "Diverts ~0.08 kg of PET bottle waste per attendee per 4-hour session.",
            "Station volunteer water monitors at 3 campus quadrangle hydration booths.",
            "Food",
            "plastic",
        ),
        (
            "Areca Leaf & Bagasse Compostable Crockery",
            "Single-use thermocol plates, laminated paper cups, polystyrene bowls",
            "Natural pressed areca palm leaf plates and sugarcane bagasse clamshell containers",
            "Converts ~0.25 kg of non-biodegradable food service trash into nutrient compost.",
            "Tie up with SRIT Agricultural/NSS compost pits for 45-day on-campus breakdown.",
            "Food",
            "organic",
        ),
        (
            "Paperless Digital Agendas & Certificates",
            "Multi-page glossy brochures, printed schedules, paper participation certificates",
            "Interactive mobile schedule web-app and downloadable cryptographic e-certificates",
            "Saves ~0.05 kg of premium pulp paper per attendee.",
            "Generate digitally verifiable PDF certificates with student QR codes; distribute invitations via campus portal.",
            "Technical",
            "paper",
        ),
        (
            "Reusable Event Decorations",
            "Disposable decorations (single-use flex banners, balloons, thermocol props)",
            "Reusable decorations (cloth banners, modular backdrops, potted plants)",
            "Prevents non-recyclable PVC flex scraps, broken thermocol bits, and plastic balloon litter.",
            "Use department cloth banners with interchangeable Velcro lettering and borrow live potted plants from campus gardens.",
            "Cultural",
            "other",
        ),
        (
            "Portion Planning & Smart Catering",
            "Food waste (over-catering, buffet excess, unconsumed meals)",
            "Improved catering and portion planning with RSVP counts",
            "Directly reduces kitchen preparation surplus and plate waste before disposal.",
            "Collect attendee RSVP confirmation 48 hours prior, serve measured initial portions with seconds available, and partner with local NGOs for untouched food rescue.",
            "Food",
            "organic",
        ),
        (
            "Authorized E-Waste Collection & Recycling",
            "E-waste (discarded jumper cables, dead batteries, damaged demo electronics)",
            "Authorized collection and certified campus recycling",
            "Safely diverts hazardous heavy metals and reclaims copper wiring and recyclable circuit boards.",
            "Provide a secure, clearly marked e-waste drop station at the event venue and transfer to authorized campus recycling vendors.",
            "Technical",
            "electronic",
        ),
        (
            "Refill water instead of bottles",
            "Single-use plastic water bottles",
            "Chilled refill stations and BYOB steel bottles",
            "Eliminates 200ml and 500ml single-use PET bottles across venues.",
            "Place 20-litre water stations near the auditorium, seminar halls, and canteen entrance.",
            "Food",
            "plastic",
        ),
        (
            "Reusable serving ware",
            "Disposable plastic plates and cutlery",
            "Areca palm / washable steel crockery and metal cutlery",
            "Cuts single-use landfill waste generated by food stalls and banquets.",
            "Ask catering stalls to serve on washable or areca plates with a returnable deposit.",
            "Food",
            "plastic",
        ),
        (
            "Digital event communication",
            "Printed event schedules and registration forms",
            "QR codes, campus app, and digital agenda screens",
            "Saves sheets of paper used for event schedules, registration, and announcements.",
            "Place large QR code display boards at registration desks for instant schedule download.",
            "Technical",
            "paper",
        ),
        (
            "Compost leftover meals",
            "Dumping food scraps in landfill bins",
            "Canteen compost collection and campus compost pits",
            "Converts unavoidable organic plate scraps into nutrient-rich campus compost.",
            "Place clearly labelled green compost bins next to every food stall and dining hall.",
            "Food",
            "organic",
        ),
        (
            "Returnable ID badges",
            "Single-use plastic badge pouches and clips",
            "Reusable fabric lanyards and recycled paper inserts",
            "Eliminates single-use PVC plastic badge sleeves.",
            "Collect lanyards at the exit gates and reuse them across technical fests.",
            "Technical",
            "paper",
        ),
    ]

    for p in practices:
        existing = cursor.execute("SELECT id FROM campus_practices WHERE title = ?", (p[0],)).fetchone()
        if existing:
            cursor.execute(
                """
                UPDATE campus_practices
                SET instead_of = ?, recommended_use = ?, impact = ?, tip = ?, category = ?, waste_stream = ?
                WHERE id = ?
                """,
                (p[1], p[2], p[3], p[4], p[5], p[6], existing["id"]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO campus_practices
                    (title, instead_of, recommended_use, impact, tip, category, waste_stream)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                p,
            )


def _seed_predictions(cursor):
    pred_count = cursor.execute("SELECT COUNT(*) AS count FROM waste_predictions").fetchone()
    if pred_count["count"] > 0:
        return

    events_by_name = {
        row["name"]: row
        for row in cursor.execute("SELECT id, name, category, attendees, duration_hours FROM events").fetchall()
    }

    sample_predictions = [
        (
            "SRIT Tech Fest",
            ["reusable_cutlery", "water_refill_stations", "digital_ticketing_materials"],
        ),
        (
            "Green Campus Drive",
            ["water_refill_stations", "food_waste_management", "zero_single_use_plastic_policy"],
        ),
        (
            "Cultural Night",
            ["reusable_cutlery", "zero_single_use_plastic_policy"],
        ),
    ]

    for event_name, measures in sample_predictions:
        event = events_by_name.get(event_name)
        if not event:
            continue
        forecast = predict_waste(
            event["category"],
            event["attendees"],
            event["duration_hours"],
            measures,
        )
        cursor.execute(
            """
            INSERT INTO waste_predictions (
                event_id, event_type, attendees, duration_hours,
                reduction_measures,
                predicted_organic_kg, predicted_plastic_kg, predicted_paper_kg,
                predicted_electronic_kg, predicted_other_kg, predicted_total_kg,
                predicted_recyclable_kg, predicted_compost_kg, predicted_landfill_kg,
                assumptions
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["id"],
                forecast["event_type"],
                forecast["attendees"],
                forecast["duration_hours"],
                json.dumps(forecast["planned_measures"]),
                forecast["predicted_organic_kg"],
                forecast["predicted_plastic_kg"],
                forecast["predicted_paper_kg"],
                forecast["predicted_electronic_kg"],
                forecast["predicted_other_kg"],
                forecast["predicted_total_kg"],
                forecast["predicted_recyclable_kg"],
                forecast["predicted_compost_kg"],
                forecast["predicted_landfill_kg"],
                json.dumps(forecast["assumptions"]),
            ),
        )


def _seed_audit_waste(cursor):
    count_row = cursor.execute("SELECT COUNT(*) AS count FROM audit_waste").fetchone()
    if count_row and count_row["count"] > 0:
        return

    sample_items = [
        ("Department Symposium", "Cardboard Packaging", 12.5, "kg"),
        ("Department Symposium", "Paper Leaflets", 150.0, "Count"),
        ("Food Fest", "Areca Leaf Plates", 450.0, "Count"),
        ("Food Fest", "Organic Food Leftovers", 35.0, "kg"),
        ("NSS Orientation", "Cloth ID Badges", 180.0, "Count"),
    ]
    cursor.executemany(
        """
        INSERT INTO audit_waste (event, name, qty, unit)
        VALUES (?, ?, ?, ?)
        """,
        sample_items,
    )
