# Zero Waste Event App for SRIT Campus
**A Full-Stack Campus Waste Forecasting, Event Tracking & Mitigation System**

[![Backend Tests](https://img.shields.io/badge/pytest-28%20passed-brightgreen)](#testing-procedure)
[![Frontend Build](https://img.shields.io/badge/vite-production%20ready-blue)](#frontend-production-build)
[![Database](https://img.shields.io/badge/database-Neon%20Postgres%20%7C%20SQLite-brightgreen)](#database-design)
[![Python](https://img.shields.io/badge/python-3.14-yellow)](#technology-stack)
[![React](https://img.shields.io/badge/react-19-cyan)](#technology-stack)

---

## 1. Project Overview

College campus events (technical symposiums, cultural fests, food carnivals, sports meets, and student orientations) are major generators of unsegregated solid waste. Common problems include massive overflow of single-use disposable plastics, excessive food waste from catering mismanagement, printed promotional paper waste, discarded electronic accessories, and low landfill diversion rates.

The **Zero Waste Event App** is an engineering solution designed specifically for campus sustainability committees, student organizers (e.g., NSS, Eco Clubs), and faculty administrators at SRIT. It bridges the gap between **pre-event planning** and **post-event accountability** by:
1. **Forecasting waste** using a transparent, rule-based formula before the event takes place.
2. **Recommending targeted, factual green swaps** tailored to the event's highest forecasted waste streams.
3. **Tracking actual certified scale weights** across recyclable, compostable, and landfill streams.
4. **Visualizing live landfill diversion trends** on an interactive real-time dashboard.
5. **Collecting community and volunteer segregation feedback** to drive continuous circularity improvements.

---

## 2. Project Objectives

- **Scientific Pre-Event Forecasting**: Estimate waste generation in kilograms across 5 material streams (Organic, Plastic, Paper, Electronic, Other) based on expected attendees, duration, and event category.
- **Empirical Mitigation Modeling**: Model the mathematical impact of planned green policies (e.g., reusable dining ware, water refill kiosks, digital passes) with realistic diminishing-returns retention.
- **Transparent Planning vs. Actual Auditing**: Clearly distinguish pre-event mathematical estimates from verified post-event scale measurements.
- **Targeted Eco-Friendly Recommendations**: Deliver prioritized, actionable green swaps (e.g., plastic cups $\rightarrow$ stainless steel cups, paper badges $\rightarrow$ QR codes) without fabricated environmental statistics.
- **Persistent Data Store & Analytics**: Store all events, prediction models, verified weigh-ins, and volunteer feedback in a permanent Neon PostgreSQL database (with local SQLite fallback).
- **Data-Driven Decision Making**: Equip campus authorities with monthly diversion rate trajectories, stream-wise breakdowns, and event-by-event waste audits.

---

## 3. Technology Stack

| Layer | Technologies & Libraries | Key Responsibilities |
|---|---|---|
| **Frontend UI** | React 19, React Router v7, Recharts 3, Vanilla CSS | Single Page Application (SPA), interactive charts (Pie, Bar, Area, Line), responsive forms, filter pills, formula transparency drawer |
| **Backend REST API** | Python 3, Flask, Flask-CORS, Gunicorn | RESTful routing, input sanitization, data serialization, HTTP error handling, calculation engine |
| **Database** | Neon Serverless Postgres (`psycopg2-binary`) / SQLite3 fallback | ACID-compliant relational persistence, zero-disk deployment on Render, automatic migrations |
| **Prediction Engine** | Python rule-based mathematical model | Empirical baseline calculation, non-linear duration scaling, multiplicative measure retention |
| **Build & Quality** | Vite 8, oxlint, pytest 9, PowerShell | Production bundling, static analysis, automated unit and integration testing |

---

## 4. Installation & Setup Guide

### Prerequisites
- **Python 3.10+** (verified on Python 3.14)
- **Node.js 18+** and **npm**
- **Windows PowerShell** (or Linux/macOS bash)

---

### Step 1: Clone or Navigate to the Repository
```powershell
cd c:\zero-waste-event-app
```

---

### Step 2: Set Up and Start the Flask Backend

1. Open a PowerShell terminal:
   ```powershell
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
   *(If script execution is disabled on your system, run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`)*

3. Install backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Start the Flask server:
   ```powershell
   python app.py
   ```
   *The Flask REST API will start at **http://127.0.0.1:5000**.*  
   *The SQLite database `zero_waste.db` is initialized and seeded automatically.*

---

### Step 3: Set Up and Start the React Frontend

1. Open a **second** PowerShell terminal:
   ```powershell
   cd c:\zero-waste-event-app\frontend
   ```

2. Install frontend dependencies:
   ```powershell
   npm.cmd install
   ```

3. Start the Vite development server:
   ```powershell
   npm.cmd run dev
   ```
   *The web application is live at **http://localhost:5173**.*  
   *(Vite is preconfigured to reverse-proxy all `/api` requests directly to `http://127.0.0.1:5000`)*.

---

### Step 4: Frontend Production Build

To validate or create the minified production distribution:
```powershell
cd c:\zero-waste-event-app\frontend
npm.cmd run build
```
The compiled output is generated in `frontend/dist/`.

---

### Step 5: Neon Serverless Postgres Setup (Permanent Storage)

For live cloud deployments on Render, the backend connects to **Neon Serverless PostgreSQL** via the `DATABASE_URL` environment variable:

1. **Sign up**: Create a free account at [https://neon.tech](https://neon.tech) (no credit card needed).
2. **Create Project**: Name it `zero-waste-db` with Postgres 16.
3. **Copy Connection URI**: In Neon Dashboard, copy the connection URI:
   ```text
   postgresql://username:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. **Set on Render**: In Render Dashboard $\rightarrow$ Web Service (`zero-waste-event-app`) $\rightarrow$ **Environment**, add:
   * **Key**: `DATABASE_URL`
   * **Value**: *[Your Neon Connection URI]*
5. **Zero Disk Required**: The repo includes `render.yaml` with `disk: false` so no persistent paid disk is needed on Render.
6. **Detailed Walkthrough**: See [NEON_SETUP.md](file:///c:/zero-waste-event-app/NEON_SETUP.md) for full screenshots and verification steps.

---

## 5. Database Design & Relational Schema

The application features a **dual-engine persistence layer**:
* **Production**: Neon Serverless PostgreSQL (via `psycopg2-binary` and `DATABASE_URL`).
* **Local & Testing**: SQLite3 (`backend/instance/zerowaste.db`), enabled automatically whenever `DATABASE_URL` is omitted.


```mermaid
erDiagram
    EVENTS ||--o{ WASTE_REPORTS : "logs verified weights for"
    EVENTS ||--o{ WASTE_PREDICTIONS : "has planning models for"
    CAMPUS_PRACTICES ||--o{ RECOMMENDATIONS : "prioritized against"
    
    EVENTS {
        INTEGER id PK
        TEXT name
        TEXT venue
        TEXT event_date
        INTEGER attendees
        TEXT category
        TEXT status
        REAL duration_hours
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    WASTE_REPORTS {
        INTEGER id PK
        INTEGER event_id FK
        TEXT category
        REAL amount_kg
        TEXT notes
        TEXT reported_by
        TIMESTAMP created_at
    }

    WASTE_PREDICTIONS {
        INTEGER id PK
        INTEGER event_id FK
        TEXT event_type
        INTEGER attendees
        REAL duration_hours
        TEXT reduction_measures
        REAL predicted_organic_kg
        REAL predicted_plastic_kg
        REAL predicted_paper_kg
        REAL predicted_electronic_kg
        REAL predicted_other_kg
        REAL predicted_total_kg
        REAL predicted_recyclable_kg
        REAL predicted_compost_kg
        REAL predicted_landfill_kg
        TEXT assumptions
        TIMESTAMP created_at
    }

    CAMPUS_PRACTICES {
        INTEGER id PK
        TEXT title
        TEXT instead_of
        TEXT recommended_use
        TEXT impact
        TEXT tip
        TEXT category
        TEXT waste_stream
    }

    FEEDBACK {
        INTEGER id PK
        TEXT name
        TEXT role
        TEXT event
        INTEGER rating
        TEXT message
        TIMESTAMP created_at
    }
```

### Table Specifications

1. **`events`**:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `name`: TEXT NOT NULL (Event title)
   - `venue`: TEXT NOT NULL (Campus hall or grounds)
   - `event_date`: TEXT NOT NULL (YYYY-MM-DD)
   - `attendees`: INTEGER NOT NULL (Expected or registered attendees)
   - `category`: TEXT NOT NULL (`Technical`, `Cultural`, `Food`, `Awareness`, `Sports`, `Student Club`, `Campus`)
   - `status`: TEXT NOT NULL (`Planning`, `Upcoming`, `Completed`)
   - `duration_hours`: REAL NOT NULL (Event duration between 0.5 and 24 hours)
   - `created_at` / `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

2. **`waste_reports`**:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `event_id`: INTEGER NOT NULL, FOREIGN KEY REFERENCES `events(id)` ON DELETE CASCADE
   - `category`: TEXT NOT NULL (`recyclable`, `compost`, `landfill`)
   - `amount_kg`: REAL NOT NULL (Certified scale weight in kilograms)
   - `notes`: TEXT (Specific weighing point or material notes)
   - `reported_by`: TEXT (Name of green club volunteer or auditor)
   - `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

3. **`waste_predictions`**:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `event_id`: INTEGER, FOREIGN KEY REFERENCES `events(id)` ON DELETE SET NULL
   - `event_type`: TEXT NOT NULL
   - `attendees`: INTEGER NOT NULL
   - `duration_hours`: REAL NOT NULL
   - `reduction_measures`: TEXT (JSON array of selected policy IDs)
   - `predicted_organic_kg`, `predicted_plastic_kg`, `predicted_paper_kg`, `predicted_electronic_kg`, `predicted_other_kg`: REAL NOT NULL
   - `predicted_total_kg`: REAL NOT NULL (Sum of the 5 streams)
   - `predicted_recyclable_kg`, `predicted_compost_kg`, `predicted_landfill_kg`: REAL (Mapped streams for diversion modeling)
   - `assumptions`: TEXT (JSON object recording calculation assumptions)
   - `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

4. **`campus_practices`**:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `title`: TEXT NOT NULL (Name of eco-friendly practice)
   - `instead_of`: TEXT NOT NULL (Conventional single-use item to eliminate)
   - `recommended_use`: TEXT NOT NULL (Green sustainable alternative)
   - `impact`: TEXT NOT NULL (Factual operational benefit)
   - `tip`: TEXT NOT NULL (Campus execution advice)
   - `category`: TEXT NOT NULL
   - `waste_stream`: TEXT NOT NULL (`plastic`, `paper`, `organic`, `electronic`, `other`)

5. **`feedback`**:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `name`: TEXT NOT NULL (Reviewer name)
   - `role`: TEXT NOT NULL (`Student`, `Volunteer`, `Faculty`, `Event organiser`)
   - `event`: TEXT NOT NULL (Associated campus event)
   - `rating`: INTEGER NOT NULL (1 to 5 stars)
   - `message`: TEXT NOT NULL (Detailed observations)
   - `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## 6. Waste Prediction Formula & Assumptions

### Material Stream Breakdown
The model estimates waste across **five distinct material streams**:
1. **Organic**: Food scraps, dining hall leftovers, tea/coffee grounds, floral decorations.
2. **Plastic**: Polypropylene cups, PET water bottles, cling wraps, disposable cutlery, snack sachets.
3. **Paper**: Registration forms, brochures, program flyers, name tags, cardboard delivery cartons.
4. **Electronic**: Cut patch cables, discarded button/AA batteries, damaged demo PCB boards, presentation adapters.
5. **Other**: Stage props, composite laminates, PVC adhesives, double-sided tape, unsegregated sweepings.

---

### Step-by-Step Calculation Formula

#### 1. Effective Duration Curve
Waste accumulation is non-linear over extended hours. Initial hours exhibit peak turnover (registration, meals, welcoming kits), after which hourly generation attenuates:

$$\text{Effective Duration } H_{\text{eff}} = \begin{cases} H & \text{if } H \le 4 \\ 4 + (H - 4) \times 0.75 & \text{if } H > 4 \end{cases}$$

#### 2. Unmitigated Baseline Waste
For each material stream $c \in \{\text{organic, plastic, paper, electronic, other}\}$:

$$\text{Baseline Waste}_c \text{ (kg)} = \text{Attendees} \times H_{\text{eff}} \times \text{Baseline Rate}_{c,\text{type}}$$

#### Empirical Baseline Rates ($kg / \text{attendee} \cdot \text{hour}$):

| Event Category | Organic | Plastic | Paper | Electronic | Other | Total / Attendee-Hour |
|---|---|---|---|---|---|---|
| **Technical** | 0.015 | 0.016 | 0.012 | 0.006 | 0.006 | 0.055 kg |
| **Cultural** | 0.028 | 0.022 | 0.014 | 0.002 | 0.014 | 0.080 kg |
| **Food Carnivals** | 0.065 | 0.025 | 0.018 | 0.001 | 0.011 | 0.120 kg |
| **Awareness / Seminars** | 0.008 | 0.009 | 0.013 | 0.001 | 0.004 | 0.035 kg |
| **Sports Meets** | 0.016 | 0.032 | 0.005 | 0.001 | 0.011 | 0.065 kg |
| **Student Club** | 0.012 | 0.012 | 0.012 | 0.003 | 0.006 | 0.045 kg |
| **Campus General** | 0.016 | 0.015 | 0.010 | 0.002 | 0.007 | 0.050 kg |

#### 3. Mitigation Measure Retention (Diminishing Returns)
When multiple reduction measures impact the same stream (e.g., both water refill stations and reusable cups target plastic), discounts stack multiplicatively rather than additively, bounded by a **90% maximum reduction cap** (10% unavoidable physical residual):

$$\text{Retention}_c = \max\left(1.0 - 0.90, \prod_{i \in M_c} (1.0 - d_{i,c})\right)$$

Where $d_{i,c}$ is the documented reduction fraction for measure $i$ on category $c$.

#### Registered Mitigation Policies:
- **Reusable Dining Ware & Cutlery**: $-55\%$ Plastic, $-35\%$ Other
- **Water Refill Stations & BYOB**: $-50\%$ Plastic
- **100% Digital Passes & Collateral**: $-75\%$ Paper
- **Portion Planning & RSVP Catering**: $-45\%$ Organic
- **Electronic Recycling & Return Booth**: $-70\%$ Electronic
- **Reusable Signage & Stage Decor**: $-65\%$ Other, $-25\%$ Paper

#### 4. Final Predicted & Avoided Waste
$$\text{Predicted Waste}_c \text{ (kg)} = \text{Baseline Waste}_c \times \text{Retention}_c$$
$$\text{Avoided Waste}_c \text{ (kg)} = \text{Baseline Waste}_c - \text{Predicted Waste}_c$$
$$\text{Total Predicted (kg)} = \sum_{c} \text{Predicted Waste}_c$$

> [!IMPORTANT]
> **Planning Estimate Disclaimer**: All predictions are explicitly labeled as model-based planning estimates and not certified scale weights. They are designed for bin allocation, catering procurement, and sustainability goal-setting prior to the event.

---

## 7. REST API Reference

All endpoints return JSON responses. Errors return appropriate HTTP status codes with an `{"error": "<descriptive message>"}` payload.

### Core Endpoints

| Method | Endpoint | Description | Request Body / Parameters | Status Codes |
|---|---|---|---|---|
| `GET` | `/api/health` | Healthcheck and project identification | None | `200` |
| `GET` | `/api/summary` | Campus totals: event count, weighed waste, diversion rate | None | `200` |
| `GET` | `/api/reports` | Event-wise summaries and monthly stream totals | None | `200` |
| `GET` | `/api/events` | List all campus events | Query: `status`, `category` | `200` |
| `POST` | `/api/events` | Create a new campus event | `{ name, venue, event_date, attendees, category, status, duration_hours }` | `201`, `400` |
| `GET` | `/api/events/<id>` | Retrieve a single event with logged waste sum | None | `200`, `404` |
| `PUT` | `/api/events/<id>` | Update event details | Any fields to update | `200`, `400`, `404` |
| `DELETE` | `/api/events/<id>` | Delete event and cascade associated logs | None | `200`, `404` |
| `POST` | `/api/events/<id>/waste` | Log certified waste weight for an event | `{ category, amount_kg, notes, reported_by }` | `201`, `400`, `404` |
| `GET` | `/api/waste-reports` | List all verified waste audit logs | Query: `event_id`, `category` | `200` |
| `POST` | `/api/waste-reports` | Create verified waste audit log | `{ event_id, category, amount_kg, notes, reported_by }` | `201`, `400` |
| `POST` | `/api/predictions` | Calculate and store a waste prediction | `{ event_type, attendees, duration_hours, planned_measures, event_id }` | `201`, `400` |
| `GET` | `/api/predictions` | List historical waste predictions | None | `200` |
| `GET` | `/api/predictions/measures` | List registered reduction measures catalog | None | `200` |
| `GET` | `/api/recommendations` | Get green swaps prioritized by predicted stream weight | Query: `prediction_id`, `event_id`, `waste_stream` | `200`, `400` |
| `POST` | `/api/recommendations` | Get prioritized green swaps from custom breakdown | `{ predicted_breakdown, event_type, stream_filter }` | `200`, `400` |
| `GET` | `/api/feedback` | List community observations and ratings | Query: `event` | `200` |
| `POST` | `/api/feedback` | Submit attendee/volunteer feedback | `{ name, role, event, rating, message }` | `201`, `400` |

---

## 8. Testing Procedure & Verification Results

All automated tests were directly executed in the development environment.

### A. Backend Pytest Suite
Execute all unit and integration tests:
```powershell
cd c:\zero-waste-event-app\backend
.\venv\Scripts\pytest -v
```

**Executed Test Results (23 passed in 0.43s)**:
- `backend/test_prediction.py`:
  - `test_all_waste_categories_present`: Verifies Organic, Plastic, Paper, Electronic, and Other streams exist.
  - `test_assumptions_documented`: Verifies transparency assumptions dictionary is returned.
  - `test_available_measures_catalog`: Verifies reduction measures dictionary.
  - `test_baseline_rates_coverage`: Verifies all event categories have defined baseline rates.
  - `test_case_insensitivity_and_resolution`: Verifies case-insensitive event type handling.
  - `test_category_breakdown_and_total_sum`: Verifies sum of 5 streams equals total predicted kg.
  - `test_effective_duration_formula`: Verifies non-linear 4-hour inflection curve.
  - `test_estimate_label_and_disclaimer`: Verifies disclaimer and `is_estimate=True` flag.
  - `test_invalid_inputs`: Verifies exception handling for negative attendees or negative duration.
  - `test_legacy_category_mapping`: Verifies recyclable/compost/landfill grouping consistency.
  - `test_max_reduction_cap`: Verifies retention does not breach the 90% reduction ceiling.
  - `test_single_reduction_measure_discount`: Verifies exact mathematical discounting for single measures.
  - `test_stacking_multiple_measures`: Verifies multiplicative diminishing-returns stacking.
  - `test_transparent_calculation_manual_verification`: Verifies hand-calculated sample match.
  - `test_zero_attendees`: Verifies zero attendees produces zero kilograms.
- `backend/test_recommendations.py`:
  - `test_all_five_required_examples_present`: Verifies reusable steel cups, digital certificates, reusable decor, portion planning, and authorized e-waste collection.
  - `test_recommendations_prioritized_by_predicted_waste`: Verifies alternatives addressing larger predicted streams receive highest priority.
  - `test_stream_filter`: Verifies stream-specific filtering.
- `backend/test_integration.py`:
  - `test_events_full_crud_and_waste_logging`: Verifies event creation, viewing, editing, waste logging, and deletion.
  - `test_feedback_flow`: Verifies submission and listing of community feedback.
  - `test_health`: Verifies `/api/health` 200 OK.
  - `test_predictions_and_recommendations_flow`: Verifies end-to-end forecasting and recommendation linking.
  - `test_summary_and_reports`: Verifies diversion metrics and monthly aggregations.

---

### B. End-to-End REST Integration Suite (`verify_e2e.py`)
Run the end-to-end integration script through the Vite proxy and Flask:
```powershell
cd c:\zero-waste-event-app\backend
.\venv\Scripts\python verify_e2e.py
```

**Executed Test Results (7/7 Passed)**:
1. Dashboard Summary: Verified `event_count`, `total_kg`, and `diversion_rate`.
2. Event CRUD: Successfully created Event #15, retrieved single view, updated attendees to 320, logged 14.5 kg recyclable waste, deleted event, and confirmed 404 response.
3. Waste Prediction & Estimates: Generated Prediction #9 (88.2 kg total, Organic: 42.0 kg, Plastic: 10.08 kg, Paper: 8.4 kg, Electronic: 16.8 kg, Other: 10.92 kg), confirmed `is_estimate: True` and disclaimer banner.
4. Eco-Alternatives Prioritization: Verified alternatives addressing organic (42.0 kg) and electronic (16.8 kg) ranked as *High Priority*.
5. Actual Waste Reports: Submitted report #27, verified monthly and event-wise aggregation.
6. Community Feedback: Submitted feedback from Student "Vikram Rathore" (Rating: 5★) and retrieved from SQLite.
7. Validation & Error Handlers: Verified HTTP 400 Bad Request on missing venue, negative waste amount, and missing event type.

---

### C. SQLite Persistence Across Application Restart Verification
To prove data persistence across application restarts:
```powershell
# Step 1: Insert test records
python test_persistence_step1.py

# Step 2: Terminate Flask backend process completely, then restart
python app.py

# Step 3: Run post-restart verification script
python test_persistence_step2.py
```

**Executed Test Results**:
- `[OK]` Event #18 persisted: `"SRIT Clean Campus Conclave 2026"` (Venue: Sir M. Visvesvaraya Auditorium, Attendees: 450)
- `[OK]` Waste Prediction #12 persisted: `77.95 kg` total, `is_estimate=True`, 5-stream breakdown intact.
- `[OK]` Actual Waste Report #30 persisted: `26.4 kg` recyclable for event #18.
- `[OK]` Feedback #8 persisted: `"Outstanding waste segregation audit. Pre-restart persistence check verified."` by Prof. Rajesh K. (Rating: 5/5).

---

### D. Frontend Production Build & Code Quality
```powershell
cd c:\zero-waste-event-app\frontend
npm.cmd run build
npm.cmd run lint
```
**Results**:
- `vite build`: Transformed 611 modules, compiled in 2.28s with **0 errors**.
- `oxlint`: Analyzed 17 files across 104 linting rules with **0 errors**.

---

## 9. Suggested Screenshots & Diagrams for Project Report

When preparing your college mini-project documentation, include the following visual assets:

### A. Recommended Diagrams
1. **Three-Tier Architecture Diagram**:
   - Presentation Layer: React 19 SPA (Vite dev/production, Recharts dashboard, React Router).
   - Application / Business Logic Layer: Flask REST API, rule-based Prediction Engine, Eco-Alternatives Prioritization Engine.
   - Persistence Layer: SQLite3 database (`zero_waste.db`) storing relational tables.
2. **Entity-Relationship (ER) Diagram**:
   - Showing `events`, `waste_predictions`, `waste_reports`, `campus_practices`, and `feedback` with primary keys, foreign keys, cardinality ($1:N$), and cascade rules.
3. **Data Flow Diagram (DFD Level 0 & Level 1)**:
   - Level 0 (Context Level): Event Organizer & Volunteer $\leftrightarrow$ Zero Waste System $\leftrightarrow$ Campus Database.
   - Level 1: Processes for (1.0) Event Management, (2.0) Waste Forecasting, (3.0) Mitigation Recommendation, (4.0) Certified Weigh-in Auditing, and (5.0) Feedback Collection.
4. **Activity Diagram / Flowchart for Waste Prediction**:
   - User inputs parameters $\rightarrow$ Validation $\rightarrow$ Effective Duration calculation $\rightarrow$ Baseline rates multiplication $\rightarrow$ Mitigation discount stacking $\rightarrow$ 90% cap check $\rightarrow$ Save to SQLite $\rightarrow$ Dynamic Eco Alternatives prioritization.

---

### B. Recommended UI Screenshots with Captions
1. **Figure 1: Executive Dashboard**:
   - *Caption*: "Figure 1: Real-time Campus Dashboard displaying live metrics (Total Events, Weighed Waste, Landfill Diversion Rate, Forecasted Waste), Actual Waste Mix donut chart, monthly diversion trend area chart, and upcoming events list."
2. **Figure 2: Event Registration & Management**:
   - *Caption*: "Figure 2: Campus Event Management interface with search bar, status filters (Planning, Upcoming, Completed), event registration form, inline edit mode, and Log Actual Waste action buttons."
3. **Figure 3: Waste Prediction & Mitigation Engine**:
   - *Caption*: "Figure 3: Interactive Waste Forecasting form featuring duration and attendee preset pills, planned mitigation policy checkboxes, prominent Planning Estimate Disclaimer banner, and 5-stream breakdown cards (Organic, Plastic, Paper, Electronic, Other)."
4. **Figure 4: Prediction Analytics & Formula Transparency Drawer**:
   - *Caption*: "Figure 4: Visual Recharts comparison of unmitigated baseline vs. predicted waste, alongside the formula transparency drawer documenting mathematical assumptions and effective duration inflection."
5. **Figure 5: Eco-Friendly Alternatives Module**:
   - *Caption*: "Figure 5: Eco-Friendly Alternatives catalog dynamically prioritized by predicted stream weight, featuring core green swaps (steel cups, digital certificates, reusable stage decor, catering portion planning, authorized e-waste recycling) and action checklist."
6. **Figure 6: Actual Waste Reports & Audit Logging**:
   - *Caption*: "Figure 6: Verified Waste Reports page with scale weight entry form, monthly stacked stream bar chart, multi-stream trajectory lines, and chronological audit trail table."
7. **Figure 7: Volunteer & Attendee Community Feedback**:
   - *Caption*: "Figure 7: Campus Feedback portal showing 5-star rating submission form with role selector and live community observations feed."

---

## 10. Future Enhancements

1. **IoT Smart Scale Integration**:
   - Connect digital industrial hanging scales and platform load-cells via ESP32 / Raspberry Pi microcontrollers using MQTT/WebSockets for automated weight ingestion without manual entry.
2. **Computer Vision & OCR Catering Audit**:
   - Enable organizers to photograph catering delivery receipts or discarded bins; utilize lightweight edge AI models (e.g., YOLOv8-waste) to classify bin contamination in real time.
3. **Multi-Campus Consortium Benchmarking**:
   - Extend the SQLite architecture to PostgreSQL with multi-tenancy, allowing inter-collegiate green ranking leagues and automated NAAC / Green Campus audit PDF report generation.
4. **Automated Volunteer Certificate Generation**:
   - Automatically generate digital cryptographic certificates of appreciation for student volunteers logging verified hours at campus waste segregation booths.
5. **QR-Based Attendee Hydration Tracking**:
   - Allow attendees to scan refill kiosks with their mobile phones to quantify the exact count of single-use PET bottles averted during conferences.

---

## 11. Authors & Acknowledgments

- **Institution**: SRIT Campus, Department of Computer Science & Engineering
- **Project Type**: College Mini-Project / Campus Sustainability Initiative
- **Inspiration**: United Nations Sustainable Development Goals (SDG 12: Responsible Consumption and Production & SDG 13: Climate Action)
