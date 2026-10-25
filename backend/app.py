import json
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from database import calculate_prediction, get_db, init_db
from prediction import (
    ESTIMATE_DISCLAIMER,
    get_available_measures,
    predict_waste,
)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

EVENT_STATUSES = {"Upcoming", "Planning", "Completed"}
EVENT_CATEGORIES = {
    "Technical",
    "Cultural",
    "Awareness",
    "Sports",
    "Food",
    "Student Club",
    "Campus",
}
WASTE_CATEGORIES = {"recyclable", "compost", "landfill"}
FEEDBACK_ROLES = {"Student", "Volunteer", "Faculty", "Event organiser"}
MONTH_LABELS = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
}

EVENT_SELECT = """
    SELECT
        e.id,
        e.name,
        e.venue,
        e.event_date,
        e.attendees,
        e.category,
        e.status,
        e.duration_hours,
        e.created_at,
        e.updated_at,
        ROUND(COALESCE(SUM(w.amount_kg), 0), 2) AS total_waste_kg
    FROM events e
    LEFT JOIN waste_reports w ON w.event_id = e.id
"""


class APIError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


@app.errorhandler(APIError)
def handle_api_error(error):
    return jsonify({"error": error.message}), error.status


@app.errorhandler(404)
def handle_not_found(_error):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def handle_method_not_allowed(_error):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(sqlite3.Error)
def handle_database_error(_error):
    return jsonify({"error": "Database error"}), 500


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    if isinstance(error, APIError):
        return handle_api_error(error)
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code
    return jsonify({"error": "Internal server error"}), 500


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise APIError("JSON body is required")
    return data


def required_text(data, field, max_length=200):
    value = data.get(field)
    if value is None:
        raise APIError(f"{field} is required")
    text = str(value).strip()
    if not text:
        raise APIError(f"{field} is required")
    if len(text) > max_length:
        raise APIError(f"{field} must be at most {max_length} characters")
    return text


def optional_text(data, field, default="", max_length=500):
    value = data.get(field, default)
    if value is None:
        return default
    text = str(value).strip()
    if len(text) > max_length:
        raise APIError(f"{field} must be at most {max_length} characters")
    return text


def parse_int(value, field, min_value=None, max_value=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise APIError(f"{field} must be a number") from None
    if min_value is not None and number < min_value:
        raise APIError(f"{field} must be at least {min_value}")
    if max_value is not None and number > max_value:
        raise APIError(f"{field} must be at most {max_value}")
    return number


def parse_float(value, field, min_value=None, max_value=None):
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise APIError(f"{field} must be a number") from None
    if min_value is not None and number < min_value:
        raise APIError(f"{field} must be at least {min_value}")
    if max_value is not None and number > max_value:
        raise APIError(f"{field} must be at most {max_value}")
    return number


def parse_date(value, field):
    text = str(value or "").strip()
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        raise APIError(f"{field} must be a valid date in YYYY-MM-DD format") from None
    return text


def serialize_event(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "venue": row["venue"],
        "event_date": row["event_date"],
        "attendees": row["attendees"] or 0,
        "category": row["category"] or "Campus",
        "status": row["status"] or "Upcoming",
        "duration_hours": row["duration_hours"] or 4,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "total_waste_kg": round(row["total_waste_kg"] or 0, 2),
    }


def serialize_prediction(row):
    keys = row.keys() if hasattr(row, "keys") else []
    reduction_measures = []
    if "reduction_measures" in keys and row["reduction_measures"]:
        try:
            reduction_measures = json.loads(row["reduction_measures"])
        except Exception:
            reduction_measures = []

    assumptions = {}
    if "assumptions" in keys and row["assumptions"]:
        try:
            assumptions = json.loads(row["assumptions"])
        except Exception:
            assumptions = {}

    organic_kg = round(float(row["predicted_organic_kg"] if "predicted_organic_kg" in keys and row["predicted_organic_kg"] is not None else row["predicted_compost_kg"]), 2)
    plastic_kg = round(float(row["predicted_plastic_kg"] if "predicted_plastic_kg" in keys and row["predicted_plastic_kg"] is not None else 0.0), 2)
    paper_kg = round(float(row["predicted_paper_kg"] if "predicted_paper_kg" in keys and row["predicted_paper_kg"] is not None else 0.0), 2)
    electronic_kg = round(float(row["predicted_electronic_kg"] if "predicted_electronic_kg" in keys and row["predicted_electronic_kg"] is not None else 0.0), 2)
    other_kg = round(float(row["predicted_other_kg"] if "predicted_other_kg" in keys and row["predicted_other_kg"] is not None else row["predicted_landfill_kg"]), 2)
    total_kg = round(float(row["predicted_total_kg"]), 2)

    return {
        "id": row["id"],
        "event_id": row["event_id"],
        "event_name": row["event_name"] if "event_name" in keys else None,
        "event_type": row["event_type"],
        "attendees": row["attendees"],
        "duration_hours": row["duration_hours"],
        "reduction_measures": reduction_measures,
        "is_estimate": True,
        "disclaimer": ESTIMATE_DISCLAIMER,
        "predicted_organic_kg": organic_kg,
        "predicted_plastic_kg": plastic_kg,
        "predicted_paper_kg": paper_kg,
        "predicted_electronic_kg": electronic_kg,
        "predicted_other_kg": other_kg,
        "predicted_total_kg": total_kg,
        "category_breakdown": {
            "organic": organic_kg,
            "plastic": plastic_kg,
            "paper": paper_kg,
            "electronic": electronic_kg,
            "other": other_kg,
        },
        "predicted_recyclable_kg": round(float(row["predicted_recyclable_kg"]), 2) if "predicted_recyclable_kg" in keys else round(plastic_kg + paper_kg + electronic_kg, 2),
        "predicted_compost_kg": round(float(row["predicted_compost_kg"]), 2) if "predicted_compost_kg" in keys else organic_kg,
        "predicted_landfill_kg": round(float(row["predicted_landfill_kg"]), 2) if "predicted_landfill_kg" in keys else other_kg,
        "diverted_kg": round(organic_kg + plastic_kg + paper_kg + electronic_kg, 2),
        "assumptions": assumptions,
        "created_at": row["created_at"],
    }


def serialize_report(row):
    return {
        "id": row["id"],
        "event_id": row["event_id"],
        "event_name": row["event_name"] if "event_name" in row.keys() else None,
        "category": row["category"],
        "amount_kg": row["amount_kg"],
        "notes": row["notes"] or "",
        "reported_by": row["reported_by"] or "",
        "created_at": row["created_at"],
    }


def serialize_practice(row):
    keys = row.keys() if hasattr(row, "keys") else []
    return {
        "id": row["id"],
        "title": row["title"],
        "insteadOf": row["instead_of"],
        "use": row["recommended_use"],
        "impact": row["impact"],
        "tip": row["tip"],
        "category": row["category"],
        "wasteStream": row["waste_stream"] if "waste_stream" in keys else "other",
    }


def fetch_event_row(connection, event_id):
    return connection.execute(
        EVENT_SELECT + " WHERE e.id = ? GROUP BY e.id",
        (event_id,),
    ).fetchone()


def require_event(connection, event_id):
    row = fetch_event_row(connection, event_id)
    if row is None:
        raise APIError("Event not found", 404)
    return row


def parse_event_payload(data, partial=False):
    payload = {}
    if not partial or "name" in data:
        payload["name"] = required_text(data, "name", 120)
    if not partial or "venue" in data:
        payload["venue"] = required_text(data, "venue", 120)
    if not partial or "event_date" in data:
        payload["event_date"] = parse_date(data.get("event_date"), "event_date")
    if not partial or "attendees" in data:
        payload["attendees"] = parse_int(data.get("attendees", 0), "attendees", min_value=0)
    if not partial or "category" in data:
        category = optional_text(data, "category", "Campus", 40)
        if category not in EVENT_CATEGORIES:
            raise APIError("invalid category")
        payload["category"] = category
    if not partial or "status" in data:
        status = optional_text(data, "status", "Planning", 40)
        if status not in EVENT_STATUSES:
            raise APIError("status must be Upcoming, Planning, or Completed")
        payload["status"] = status
    if not partial or "duration_hours" in data:
        payload["duration_hours"] = parse_float(
            data.get("duration_hours", 4),
            "duration_hours",
            min_value=0.5,
            max_value=24,
        )
    return payload


def insert_waste_report(connection, event_id, data):
    require_event(connection, event_id)
    category = required_text(data, "category", 20).lower()
    if category not in WASTE_CATEGORIES:
        raise APIError("category must be recyclable, compost, or landfill")
    amount_kg = parse_float(data.get("amount_kg"), "amount_kg", min_value=0)
    notes = optional_text(data, "notes", "", 300)
    reported_by = optional_text(data, "reported_by", "", 80)

    cursor = connection.execute(
        """
        INSERT INTO waste_reports (event_id, category, amount_kg, notes, reported_by)
        VALUES (?, ?, ?, ?, ?)
        """,
        (event_id, category, amount_kg, notes, reported_by),
    )
    return {
        "id": cursor.lastrowid,
        "event_id": event_id,
        "category": category,
        "amount_kg": amount_kg,
        "notes": notes,
        "reported_by": reported_by,
    }


@app.get("/api/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "project": "Zero Waste Event App for SRIT Campus",
        }
    )


@app.get("/api/events")
def list_events():
    with get_db() as connection:
        rows = connection.execute(
            EVENT_SELECT + " GROUP BY e.id ORDER BY e.event_date DESC"
        ).fetchall()
    return jsonify([serialize_event(row) for row in rows])


@app.post("/api/events")
def create_event():
    payload = parse_event_payload(json_body())
    with get_db() as connection:
        cursor = connection.execute(
            """
            INSERT INTO events
                (name, venue, event_date, attendees, category, status, duration_hours, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                payload["name"],
                payload["venue"],
                payload["event_date"],
                payload["attendees"],
                payload["category"],
                payload["status"],
                payload["duration_hours"],
            ),
        )
        event = fetch_event_row(connection, cursor.lastrowid)
    return jsonify(serialize_event(event)), 201


@app.get("/api/events/<int:event_id>")
def get_event(event_id):
    with get_db() as connection:
        event = require_event(connection, event_id)
    return jsonify(serialize_event(event))


@app.put("/api/events/<int:event_id>")
@app.patch("/api/events/<int:event_id>")
def update_event(event_id):
    payload = parse_event_payload(json_body(), partial=True)
    if not payload:
        raise APIError("No fields to update")

    allowed_columns = (
        "name",
        "venue",
        "event_date",
        "attendees",
        "category",
        "status",
        "duration_hours",
    )
    assignments = ", ".join(f"{column} = ?" for column in allowed_columns if column in payload)
    values = [payload[column] for column in allowed_columns if column in payload]
    values.append(event_id)

    with get_db() as connection:
        require_event(connection, event_id)
        connection.execute(
            f"UPDATE events SET {assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
        event = fetch_event_row(connection, event_id)
    return jsonify(serialize_event(event))


@app.delete("/api/events/<int:event_id>")
def delete_event(event_id):
    with get_db() as connection:
        require_event(connection, event_id)
        connection.execute("DELETE FROM events WHERE id = ?", (event_id,))
    return jsonify({"deleted": True, "id": event_id})


@app.get("/api/events/<int:event_id>/waste")
def list_waste(event_id):
    with get_db() as connection:
        require_event(connection, event_id)
        rows = connection.execute(
            """
            SELECT w.id, w.event_id, e.name AS event_name, w.category, w.amount_kg,
                   w.notes, w.reported_by, w.created_at
            FROM waste_reports w
            JOIN events e ON e.id = w.event_id
            WHERE w.event_id = ?
            ORDER BY w.created_at DESC
            """,
            (event_id,),
        ).fetchall()
    return jsonify([serialize_report(row) for row in rows])


@app.post("/api/events/<int:event_id>/waste")
def add_waste(event_id):
    with get_db() as connection:
        report = insert_waste_report(connection, event_id, json_body())
    return jsonify(report), 201


@app.get("/api/waste-reports")
def list_waste_reports():
    event_id = request.args.get("event_id")
    query = """
        SELECT w.id, w.event_id, e.name AS event_name, w.category, w.amount_kg,
               w.notes, w.reported_by, w.created_at
        FROM waste_reports w
        JOIN events e ON e.id = w.event_id
    """
    params = []
    if event_id is not None:
        query += " WHERE w.event_id = ?"
        params.append(parse_int(event_id, "event_id", min_value=1))
    query += " ORDER BY w.created_at DESC"

    with get_db() as connection:
        rows = connection.execute(query, params).fetchall()
    return jsonify([serialize_report(row) for row in rows])


@app.post("/api/waste-reports")
def create_waste_report():
    data = json_body()
    event_id = parse_int(data.get("event_id"), "event_id", min_value=1)
    with get_db() as connection:
        report = insert_waste_report(connection, event_id, data)
    return jsonify(report), 201


@app.get("/api/predictions/measures")
def list_prediction_measures():
    return jsonify(get_available_measures())


@app.post("/api/predictions")
@app.post("/api/events/<int:event_id>/predictions")
def generate_prediction(event_id=None):
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise APIError("JSON body must be an object")

    if event_id is None and data.get("event_id") is not None:
        event_id = parse_int(data.get("event_id"), "event_id", min_value=1)

    with get_db() as connection:
        event = require_event(connection, event_id) if event_id else None
        event_type = optional_text(
            data,
            "event_type",
            event["category"] if event else "",
            40,
        )
        if not event_type:
            event_type = required_text(data, "event_type", 40)
        if event_type not in EVENT_CATEGORIES:
            raise APIError("invalid event_type")

        attendees = parse_int(
            data.get("attendees", event["attendees"] if event else None),
            "attendees",
            min_value=0,
        )
        duration_hours = parse_float(
            data.get("duration_hours", event["duration_hours"] if event else None),
            "duration_hours",
            min_value=0.5,
            max_value=24,
        )

        planned_measures = data.get("planned_measures") or data.get("reduction_measures") or []
        if isinstance(planned_measures, str):
            planned_measures = [m.strip() for m in planned_measures.split(",") if m.strip()]
        elif not isinstance(planned_measures, list):
            planned_measures = []

        forecast = predict_waste(event_type, attendees, duration_hours, planned_measures)
        cursor = connection.execute(
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
                event_id,
                event_type,
                attendees,
                duration_hours,
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
        row = connection.execute(
            """
            SELECT p.*, e.name AS event_name
            FROM waste_predictions p
            LEFT JOIN events e ON e.id = p.event_id
            WHERE p.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    result = serialize_prediction(row)
    result["unmitigated_breakdown"] = forecast["unmitigated_breakdown"]
    result["unmitigated_total_kg"] = forecast["unmitigated_total_kg"]
    result["avoided_breakdown"] = forecast["avoided_breakdown"]
    result["avoided_total_kg"] = forecast["avoided_total_kg"]
    result["avoidance_rate_pct"] = forecast["avoidance_rate_pct"]
    return jsonify(result), 201


@app.get("/api/predictions")
def list_predictions():
    event_id = request.args.get("event_id")
    query = """
        SELECT p.*, e.name AS event_name
        FROM waste_predictions p
        LEFT JOIN events e ON e.id = p.event_id
    """
    params = []
    if event_id is not None:
        query += " WHERE p.event_id = ?"
        params.append(parse_int(event_id, "event_id", min_value=1))
    query += " ORDER BY p.created_at DESC"

    with get_db() as connection:
        rows = connection.execute(query, params).fetchall()
    return jsonify([serialize_prediction(row) for row in rows])


@app.route("/api/recommendations", methods=["GET", "POST"])
def recommendations():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = request.args.to_dict()

    prediction_id = data.get("prediction_id")
    event_id = data.get("event_id")
    event_type = (data.get("event_type") or "").strip()
    stream_filter = (data.get("waste_stream") or "").strip().lower()

    predicted_breakdown = {}
    prediction_info = None

    with get_db() as connection:
        if prediction_id is not None:
            p_id = parse_int(prediction_id, "prediction_id", min_value=1)
            pred_row = connection.execute(
                """
                SELECT p.*, e.name AS event_name
                FROM waste_predictions p
                LEFT JOIN events e ON e.id = p.event_id
                WHERE p.id = ?
                """,
                (p_id,),
            ).fetchone()
            if pred_row:
                prediction_info = serialize_prediction(pred_row)
                predicted_breakdown = prediction_info["category_breakdown"]
                event_type = event_type or pred_row["event_type"]

        elif event_id is not None:
            e_id = parse_int(event_id, "event_id", min_value=1)
            event = require_event(connection, e_id)
            event_type = event_type or event["category"]
            pred_row = connection.execute(
                """
                SELECT p.*, e.name AS event_name
                FROM waste_predictions p
                LEFT JOIN events e ON e.id = p.event_id
                WHERE p.event_id = ?
                ORDER BY p.created_at DESC
                LIMIT 1
                """,
                (e_id,),
            ).fetchone()
            if pred_row:
                prediction_info = serialize_prediction(pred_row)
                predicted_breakdown = prediction_info["category_breakdown"]

        # Also support raw predicted breakdown in body
        if not predicted_breakdown and isinstance(data.get("predicted_breakdown"), dict):
            predicted_breakdown = {
                k: round(float(v), 2) for k, v in data["predicted_breakdown"].items()
            }

        query = """
            SELECT id, title, instead_of, recommended_use, impact, tip, category, waste_stream
            FROM campus_practices
        """
        params = []
        if stream_filter:
            query += " WHERE LOWER(waste_stream) = ?"
            params.append(stream_filter)
        query += " ORDER BY id"

        raw_practices = connection.execute(query, params).fetchall()

    total_predicted = sum(predicted_breakdown.values()) if predicted_breakdown else 0.0

    recommendations_list = []
    for row in raw_practices:
        item = serialize_practice(row)
        stream = item["wasteStream"]
        stream_kg = predicted_breakdown.get(stream, 0.0) if predicted_breakdown else None

        if stream_kg is not None and total_predicted > 0:
            share_pct = round((stream_kg / total_predicted) * 100, 1)
            item["predictedStreamKg"] = stream_kg
            item["streamSharePct"] = share_pct
            if share_pct >= 25 or stream_kg >= 15:
                item["priority"] = "High Priority"
                item["priorityScore"] = 3
            elif share_pct >= 10 or stream_kg >= 5:
                item["priority"] = "Medium Priority"
                item["priorityScore"] = 2
            elif stream_kg > 0:
                item["priority"] = "Standard Recommendation"
                item["priorityScore"] = 1
            else:
                item["priority"] = "Low Priority"
                item["priorityScore"] = 0
            item["reason"] = f"Addresses {stream_kg} kg predicted {stream} waste ({share_pct}% of event forecast)"
        elif stream_kg is not None and total_predicted == 0:
            item["predictedStreamKg"] = 0.0
            item["streamSharePct"] = 0.0
            item["priority"] = "Standard Recommendation"
            item["priorityScore"] = 1
            item["reason"] = f"Proactive campus recommendation for {stream} reduction"
        else:
            item["predictedStreamKg"] = None
            item["streamSharePct"] = None
            item["priority"] = "Standard Recommendation"
            item["priorityScore"] = 1
            item["reason"] = f"Campus-tested alternative for {stream} reduction"

        recommendations_list.append(item)

    # Sort so alternatives for the largest predicted waste streams appear first
    recommendations_list.sort(
        key=lambda x: (
            x["priorityScore"],
            x["predictedStreamKg"] if x["predictedStreamKg"] is not None else -1,
            -x["id"],
        ),
        reverse=True,
    )

    return jsonify(
        {
            "event_type": event_type or None,
            "prediction_id": prediction_info["id"] if prediction_info else None,
            "prediction_context": prediction_info,
            "predicted_breakdown": predicted_breakdown or None,
            "total_predicted_kg": round(total_predicted, 2) if total_predicted > 0 else None,
            "recommendations": recommendations_list,
        }
    )


@app.get("/api/practices")
def list_practices():
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT id, title, instead_of, recommended_use, impact, tip, category, waste_stream
            FROM campus_practices
            ORDER BY id
            """
        ).fetchall()
    return jsonify([serialize_practice(row) for row in rows])


@app.get("/api/summary")
def summary():
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT category, ROUND(COALESCE(SUM(amount_kg), 0), 2) AS total_kg
            FROM waste_reports
            GROUP BY category
            """
        ).fetchall()
        event_count = connection.execute("SELECT COUNT(*) AS count FROM events").fetchone()["count"]

    totals = {"recyclable": 0, "compost": 0, "landfill": 0}
    for row in rows:
        totals[row["category"]] = row["total_kg"]

    total_waste = round(sum(totals.values()), 2)
    diverted = round(totals["recyclable"] + totals["compost"], 2)
    diversion_rate = round((diverted / total_waste) * 100, 1) if total_waste else 0

    return jsonify(
        {
            **totals,
            "total_kg": total_waste,
            "diverted_kg": diverted,
            "diversion_rate": diversion_rate,
            "event_count": event_count,
        }
    )


@app.get("/api/reports")
def reports():
    with get_db() as connection:
        event_rows = connection.execute(
            """
            SELECT
                e.name AS event,
                ROUND(COALESCE(SUM(CASE WHEN w.category = 'recyclable' THEN w.amount_kg END), 0), 2) AS recyclable,
                ROUND(COALESCE(SUM(CASE WHEN w.category = 'compost' THEN w.amount_kg END), 0), 2) AS compost,
                ROUND(COALESCE(SUM(CASE WHEN w.category = 'landfill' THEN w.amount_kg END), 0), 2) AS landfill
            FROM events e
            LEFT JOIN waste_reports w ON w.event_id = e.id
            GROUP BY e.id
            ORDER BY e.event_date DESC
            """
        ).fetchall()
        month_rows = connection.execute(
            """
            SELECT
                strftime('%m', created_at) AS month_num,
                ROUND(COALESCE(SUM(CASE WHEN category = 'recyclable' THEN amount_kg END), 0), 2) AS recyclable,
                ROUND(COALESCE(SUM(CASE WHEN category = 'compost' THEN amount_kg END), 0), 2) AS compost,
                ROUND(COALESCE(SUM(CASE WHEN category = 'landfill' THEN amount_kg END), 0), 2) AS landfill
            FROM waste_reports
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY strftime('%Y-%m', created_at)
            """
        ).fetchall()

    monthly = []
    for row in month_rows:
        monthly.append(
            {
                "month": MONTH_LABELS.get(row["month_num"], row["month_num"]),
                "recyclable": row["recyclable"],
                "compost": row["compost"],
                "landfill": row["landfill"],
            }
        )

    return jsonify({"events": [dict(row) for row in event_rows], "monthly": monthly})


@app.get("/api/feedback")
def list_feedback():
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT id, name, role, event, rating, message, created_at
            FROM feedback
            ORDER BY created_at DESC
            LIMIT 20
            """
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/feedback")
def create_feedback():
    data = json_body()
    name = required_text(data, "name", 80)
    role = required_text(data, "role", 40)
    event = required_text(data, "event", 120)
    message = required_text(data, "message", 1000)
    rating = parse_int(data.get("rating"), "rating", min_value=1, max_value=5)

    if role not in FEEDBACK_ROLES:
        raise APIError("role must be Student, Volunteer, Faculty, or Event organiser")

    with get_db() as connection:
        cursor = connection.execute(
            """
            INSERT INTO feedback (name, role, event, rating, message)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, role, event, rating, message),
        )
        feedback_id = cursor.lastrowid

    return jsonify(
        {
            "id": feedback_id,
            "name": name,
            "role": role,
            "event": event,
            "rating": rating,
            "message": message,
        }
    ), 201


# -------------------------------------------------------------
# 1. PREDICT WASTE WHEN DEPT REGISTERS
# -------------------------------------------------------------
@app.route("/api/predict-waste", methods=["POST"])
def predict_dept_waste():
    data = request.get_json(silent=True) or {}
    attendees_val = data.get("attendees", 0)
    try:
        attendees = max(0.0, float(attendees_val))
    except (TypeError, ValueError):
        raise APIError("attendees must be a valid number")

    duration_val = data.get("duration", data.get("duration_hours", 4))
    try:
        duration = max(0.1, float(duration_val))
    except (TypeError, ValueError):
        duration = 4.0

    category = str(data.get("category", "Campus")).strip() or "Campus"

    total_kg = round(attendees * 0.35, 2)
    plastic_bottles = round(attendees * 1.2, 1) if (attendees * 1.2) % 1 != 0 else int(attendees * 1.2)
    paper_cups = round(attendees * 0.8, 1) if (attendees * 0.8) % 1 != 0 else int(attendees * 0.8)
    food_plates = round(attendees * 1.0, 1) if (attendees * 1.0) % 1 != 0 else int(attendees * 1.0)
    food_waste = round(attendees * 0.15, 2)
    paper_waste = round(attendees * 0.08, 2)

    return jsonify({
        "attendees": attendees,
        "duration": duration,
        "category": category,
        "total_kg": total_kg,
        "breakup": {
            "Plastic Bottles": f"{plastic_bottles} Count",
            "Paper Cups": f"{paper_cups} Count",
            "Food Plates": f"{food_plates} Count",
            "Food Waste": f"{food_waste} kg",
            "Paper Waste": f"{paper_waste} kg",
        },
        "items": [
            {"item": "Plastic Bottles", "value": plastic_bottles, "unit": "Count", "display": f"{plastic_bottles} Count"},
            {"item": "Paper Cups", "value": paper_cups, "unit": "Count", "display": f"{paper_cups} Count"},
            {"item": "Food Plates", "value": food_plates, "unit": "Count", "display": f"{food_plates} Count"},
            {"item": "Food Waste", "value": food_waste, "unit": "kg", "display": f"{food_waste} kg"},
            {"item": "Paper Waste", "value": paper_waste, "unit": "kg", "display": f"{paper_waste} kg"},
        ],
        "plastic_bottles": plastic_bottles,
        "paper_cups": paper_cups,
        "food_plates": food_plates,
        "food_waste": food_waste,
        "paper_waste": paper_waste,
    })


# -------------------------------------------------------------
# 2. SUGGEST ALTERNATIVES BEFORE EVENT STARTS
# -------------------------------------------------------------
@app.route("/api/get-alternatives", methods=["POST"])
def get_alternatives():
    data = request.get_json(silent=True) or {}
    attendees_val = data.get("attendees", 0)
    try:
        attendees = max(0.0, float(attendees_val))
    except (TypeError, ValueError):
        attendees = 0.0

    bottles_saved_est = round(attendees * 1.2 * 0.8)
    bottles_cost = max(1500, int(attendees * 12))
    tableware_cost = max(800, int(attendees * 6))
    food_cost = max(1200, int(attendees * 10))

    alternatives = [
        {
            "id": "plastic_bottles",
            "item": "Plastic Bottles",
            "action": "Water Dispensers + Steel Glasses",
            "impact": "Save 80%",
            "cost_saved": f"Save ₹{bottles_cost}",
            "details": f"Eliminates ~{bottles_saved_est} single-use PET bottles by installing 20L water carboys & sanitized stainless tumblers."
        },
        {
            "id": "paper_cups_plates",
            "item": "Paper Cups/Plates",
            "action": "Areca Leaf Plates + Clay Kulhads",
            "impact": "100% biodegradable",
            "cost_saved": f"Save ₹{tableware_cost}",
            "details": "Replaces plastic-coated paper dinnerware with natural pressed areca palm leaf plates and traditional earthen kulhads."
        },
        {
            "id": "food_waste",
            "item": "Food Waste",
            "action": "RSVP Form + NGO Donation Tie-up",
            "impact": "Reduce 50%",
            "cost_saved": f"Save ₹{food_cost}",
            "details": "Requires attendee meal RSVPs 24h prior, plus tie-up with local NGO food recovery network for instant evening pickup."
        },
        {
            "id": "paper_banners",
            "item": "Paper Banners",
            "action": "Digital Boards + Cloth Banners",
            "impact": "Zero single-use flex; reusable",
            "cost_saved": "Save ₹2000",
            "details": "Switch from single-use PVC flex hoardings to campus LED digital displays and reusable woven cotton canvas banners."
        }
    ]

    return jsonify({
        "attendees": attendees,
        "alternatives": alternatives
    })


# -------------------------------------------------------------
# 3. POST-EVENT WASTE AUDIT FOR ALL ITEMS (NOT ONLY BOTTLES)
# -------------------------------------------------------------
@app.route("/api/save-audit-items", methods=["POST"])
@app.route("/api/audit-items", methods=["POST"])
def save_audit_items():
    payload = request.get_json(silent=True)
    if payload is None:
        raise APIError("JSON body is required")

    items_to_insert = []
    if isinstance(payload, list):
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            event = str(entry.get("event", "")).strip()
            name = str(entry.get("name", entry.get("item", ""))).strip()
            try:
                qty = float(entry.get("qty", entry.get("quantity", 0)))
            except (TypeError, ValueError):
                qty = 0.0
            unit = str(entry.get("unit", "Count")).strip()
            if event and name and qty >= 0:
                items_to_insert.append((event, name, qty, unit))
    elif isinstance(payload, dict):
        event = str(payload.get("event", "")).strip()
        items_list = payload.get("items")
        if isinstance(items_list, list):
            for item in items_list:
                if not isinstance(item, dict):
                    continue
                item_event = str(item.get("event", event)).strip()
                name = str(item.get("name", item.get("item", ""))).strip()
                try:
                    qty = float(item.get("qty", item.get("quantity", 0)))
                except (TypeError, ValueError):
                    qty = 0.0
                unit = str(item.get("unit", "Count")).strip()
                if item_event and name and qty >= 0:
                    items_to_insert.append((item_event, name, qty, unit))
        else:
            name = str(payload.get("name", payload.get("item", ""))).strip()
            if event and name:
                try:
                    qty = float(payload.get("qty", payload.get("quantity", 0)))
                except (TypeError, ValueError):
                    qty = 0.0
                unit = str(payload.get("unit", "Count")).strip()
                items_to_insert.append((event, name, qty, unit))

    if not items_to_insert:
        raise APIError("No valid audit items provided to save. Event and item name are required.")

    saved_items = []
    with get_db() as connection:
        cursor = connection.cursor()
        for ev, nm, qt, un in items_to_insert:
            cursor.execute(
                """
                INSERT INTO audit_waste (event, name, qty, unit)
                VALUES (?, ?, ?, ?)
                """,
                (ev, nm, qt, un),
            )
            saved_items.append({
                "id": cursor.lastrowid,
                "event": ev,
                "name": nm,
                "qty": qt,
                "unit": un,
            })

    return jsonify({
        "success": True,
        "message": f"Successfully saved {len(saved_items)} audit items.",
        "saved_items": saved_items,
        "count": len(saved_items)
    }), 201


@app.route("/api/get-audit-items", methods=["GET"])
@app.route("/api/audit-items", methods=["GET"])
def get_audit_items():
    event_filter = request.args.get("event")
    with get_db() as connection:
        if event_filter:
            rows = connection.execute(
                """
                SELECT id, event, name, qty, unit, created_at
                FROM audit_waste
                WHERE event = ?
                ORDER BY id DESC
                """,
                (event_filter,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, event, name, qty, unit, created_at
                FROM audit_waste
                ORDER BY id DESC
                """
            ).fetchall()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "event": r["event"],
            "name": r["name"],
            "qty": r["qty"],
            "unit": r["unit"],
            "created_at": r["created_at"],
        })
    return jsonify(results)


@app.route("/api/edit-audit-item/<int:item_id>", methods=["PUT", "DELETE"])
@app.route("/api/audit-items/<int:item_id>", methods=["PUT", "DELETE"])
def edit_or_delete_audit_item(item_id):
    if request.method == "DELETE":
        with get_db() as connection:
            row = connection.execute("SELECT id FROM audit_waste WHERE id = ?", (item_id,)).fetchone()
            if not row:
                raise APIError("Audit item not found", 404)
            connection.execute("DELETE FROM audit_waste WHERE id = ?", (item_id,))
        return jsonify({"success": True, "message": f"Item #{item_id} deleted successfully."})

    # PUT update
    data = json_body()
    name = str(data.get("name", "")).strip()
    qty_val = data.get("qty", data.get("quantity"))
    unit = str(data.get("unit", "Count")).strip()
    event = str(data.get("event", "")).strip() if "event" in data else None

    if not name:
        raise APIError("Item name is required")
    try:
        qty = float(qty_val)
        if qty < 0:
            raise APIError("Quantity must be greater than or equal to 0")
    except (TypeError, ValueError):
        raise APIError("Quantity must be a valid number")

    with get_db() as connection:
        row = connection.execute("SELECT id, event FROM audit_waste WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise APIError("Audit item not found", 404)

        target_event = event or row["event"]
        connection.execute(
            """
            UPDATE audit_waste
            SET event = ?, name = ?, qty = ?, unit = ?
            WHERE id = ?
            """,
            (target_event, name, qty, unit, item_id),
        )

    return jsonify({
        "success": True,
        "id": item_id,
        "event": target_event,
        "name": name,
        "qty": qty,
        "unit": unit
    })


init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
