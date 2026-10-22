"""
Waste Prediction Module for Campus Events
=========================================
Rule-based waste forecasting engine providing transparent estimates of
waste generation across five material streams:
  1. Organic (food scraps, catering leftovers, compostable matter, floral decor)
  2. Plastic (single-use bottles, cups, cutlery, snack packaging, wrappers)
  3. Paper (flyers, brochures, registration forms, badges, cardboard boxes)
  4. Electronic (broken cables, discarded batteries, demo PCB scraps, badge tech)
  5. Other (composite laminates, adhesives, stage decor, mixed non-recyclables)

MODEL ASSUMPTIONS & FORMULA DOCUMENTATION:
------------------------------------------
1. Attendees & Duration Baseline:
   Waste generation starts from empirical per-attendee-hour rates for each event
   category. Standard events generate different waste mixes:
     - Food Fest: dominated by organic food waste and disposable service ware.
     - Technical: dominated by packaging, badges, printouts, and small electronics.
     - Cultural: heavy on props, decorations, costume waste, and food/beverages.
     - Sports: heavy on hydration packaging, energy bar wraps, and athletic tape.
     - Awareness / Seminar: low overall volume, predominantly paper handouts.

2. Duration Scaling Curve (Effective Duration):
   Event waste accumulation is not strictly linear across long durations.
   While the first 4 hours exhibit peak consumption (meals, welcomes, registration),
   subsequent hours experience reduced hourly turnover.
   Formula:
     If H <= 4:
       Effective Duration = H
     If H > 4:
       Effective Duration = 4 + (H - 4) * 0.75

3. Unmitigated Baseline Waste:
     Unmitigated_kg[category] = attendees * Effective_Duration * Baseline_Rate[event_type][category]

4. Waste Reduction Measures (Mitigation Discounts):
   Organizers can select one or more planned reduction policies. Each measure targets
   specific waste streams with documented percentage reductions.
   When multiple measures impact the same stream, diminishing-returns retention is applied:
     Retention[category] = max(1 - MAX_REDUCTION_CAP, Product(1 - discount_i))
   where MAX_REDUCTION_CAP = 0.90 (leaving at least 10% unavoidable baseline residual).

5. Net Predicted Waste:
     Predicted_kg[category] = Unmitigated_kg[category] * Retention[category]
     Avoided_kg[category]   = Unmitigated_kg[category] - Predicted_kg[category]
     Total_Predicted_kg     = Sum(Predicted_kg[category] for all categories)

DISCLAIMER:
-----------
All predictions are mathematical model-based planning estimates, NOT certified
actual weigh-scale measurements. Actual values will vary based on attendee behavior,
weather, catering choices, and enforcement.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

ESTIMATE_DISCLAIMER = (
    "ESTIMATE ONLY: These figures are model-based planning estimates calculated from "
    "empirical campus baselines and planned reduction measures. They do not represent "
    "actual weighed measurements."
)

WASTE_CATEGORIES = ("organic", "plastic", "paper", "electronic", "other")

EVENT_CATEGORIES = (
    "Technical",
    "Cultural",
    "Food",
    "Awareness",
    "Sports",
    "Student Club",
    "Campus",
)

# Baseline generation rates in kilograms per attendee per hour (kg / person-hr)
BASELINE_RATES_KG_PER_ATTENDEE_HOUR: Dict[str, Dict[str, float]] = {
    "Technical": {
        "organic": 0.015,
        "plastic": 0.016,
        "paper": 0.012,
        "electronic": 0.006,
        "other": 0.006,
    },
    "Cultural": {
        "organic": 0.028,
        "plastic": 0.022,
        "paper": 0.014,
        "electronic": 0.002,
        "other": 0.014,
    },
    "Food": {
        "organic": 0.065,
        "plastic": 0.025,
        "paper": 0.018,
        "electronic": 0.001,
        "other": 0.011,
    },
    "Awareness": {
        "organic": 0.008,
        "plastic": 0.009,
        "paper": 0.013,
        "electronic": 0.001,
        "other": 0.004,
    },
    "Sports": {
        "organic": 0.016,
        "plastic": 0.032,
        "paper": 0.005,
        "electronic": 0.001,
        "other": 0.011,
    },
    "Student Club": {
        "organic": 0.012,
        "plastic": 0.012,
        "paper": 0.012,
        "electronic": 0.003,
        "other": 0.006,
    },
    "Campus": {
        "organic": 0.016,
        "plastic": 0.015,
        "paper": 0.010,
        "electronic": 0.002,
        "other": 0.007,
    },
}

# Catalog of planned waste-reduction measures with empirical mitigation impacts
REDUCTION_MEASURES: Dict[str, Dict[str, Any]] = {
    "reusable_cutlery": {
        "id": "reusable_cutlery",
        "name": "Reusable Dining Ware & Cutlery",
        "summary": "Switch from single-use plates to washable steel or areca leaf plates",
        "description": "Serve food and refreshments using washable stainless steel or compostable areca plates with metal spoons; eliminates disposable plastic cutlery and thermocol plates.",
        "reductions": {
            "plastic": 0.55,
            "other": 0.35,
        },
        "target_stream": "Plastic & Other",
    },
    "water_refill_stations": {
        "id": "water_refill_stations",
        "name": "Water Refill Stations & BYOB",
        "summary": "Eliminate 200ml/500ml PET water bottles with chilled refill points",
        "description": "Deploy 20-litre dispensers and encourage attendees and guests to Bring Your Own Bottle (BYOB); eliminates single-use disposable bottled water.",
        "reductions": {
            "plastic": 0.50,
        },
        "target_stream": "Plastic",
    },
    "digital_ticketing_materials": {
        "id": "digital_ticketing_materials",
        "name": "100% Digital Passes & Collateral",
        "summary": "Digital QR badges, e-schedules, and softcopy handouts",
        "description": "Replace printed schedules, souvenir brochures, registration slips, and paper badges with QR codes, digital agendas, and web-based schedules.",
        "reductions": {
            "paper": 0.75,
        },
        "target_stream": "Paper",
    },
    "food_waste_management": {
        "id": "food_waste_management",
        "name": "Food Composting & Surplus Rescue",
        "summary": "Campus composting pit for scraps + donation of untouched meals",
        "description": "Segregate food preparation scraps and plate leftovers for the college compost facility, and arrange immediate pickup of surplus untouched catering by local food charities.",
        "reductions": {
            "organic": 0.65,
        },
        "target_stream": "Organic",
    },
    "zero_single_use_plastic_policy": {
        "id": "zero_single_use_plastic_policy",
        "name": "Strict Zero Single-Use Plastic Policy",
        "summary": "Ban flex banners, plastic decor, glitter, and plastic wraps",
        "description": "Enforce cloth/digital LED signage instead of PVC flex banners, ban balloon arches, plastic badge sleeves, and cling wrap across all event stalls.",
        "reductions": {
            "plastic": 0.40,
            "other": 0.25,
        },
        "target_stream": "Plastic & Decor",
    },
    "e_waste_drop_point": {
        "id": "e_waste_drop_point",
        "name": "E-Waste Bin & Hardware Lending",
        "summary": "Loaner cables, rechargeable battery packs, and salvage bin",
        "description": "Provide organizers and participants with shared power strips, loaner HDMI/USB cables, reusable rechargeable batteries, and a dedicated e-waste drop station.",
        "reductions": {
            "electronic": 0.70,
        },
        "target_stream": "Electronic",
    },
}

# Maximum reduction cap per category (preserves 10% unavoidable baseline residual)
MAX_REDUCTION_CAP = 0.90


def get_available_measures() -> List[Dict[str, Any]]:
    """Returns a list of all registered waste reduction measures with metadata."""
    return [
        {
            "id": measure["id"],
            "name": measure["name"],
            "summary": measure["summary"],
            "description": measure["description"],
            "target_stream": measure["target_stream"],
            "reductions": measure["reductions"],
        }
        for measure in REDUCTION_MEASURES.values()
    ]


def calculate_effective_duration(duration_hours: float) -> float:
    """
    Computes effective duration in hours accounting for consumption tapering.

    Assumptions:
      - For duration <= 4 hours, hourly intensity is 1.0 (peak welcome/meals/activity).
      - For duration > 4 hours, each additional hour generates at 0.75 intensity
        as activity settles into sessions and intake intervals widen.
    """
    if duration_hours <= 0:
        return 0.0
    if duration_hours <= 4.0:
        return float(duration_hours)
    return 4.0 + (duration_hours - 4.0) * 0.75


def resolve_event_type(event_type: str) -> str:
    """
    Normalizes and resolves event category name.
    Falls back to 'Campus' if unrecognized.
    """
    cleaned = (event_type or "").strip()
    for cat in EVENT_CATEGORIES:
        if cat.lower() == cleaned.lower():
            return cat
    return "Campus"


def calculate_category_retention(
    category: str,
    selected_measure_ids: List[str],
) -> tuple[float, List[Dict[str, Any]]]:
    """
    Calculates the retention factor (remaining proportion of baseline waste)
    for a given category after applying all relevant selected reduction measures.

    Uses multiplicative combination with diminishing returns:
      Remaining_ratio = Product(1 - discount_i)
      Retention = max(1 - MAX_REDUCTION_CAP, Remaining_ratio)
    """
    remaining_ratio = 1.0
    applied_traces = []

    for measure_id in selected_measure_ids:
        measure = REDUCTION_MEASURES.get(measure_id)
        if not measure:
            continue
        discount = measure["reductions"].get(category, 0.0)
        if discount > 0:
            remaining_ratio *= (1.0 - discount)
            applied_traces.append({
                "measure_id": measure_id,
                "measure_name": measure["name"],
                "discount_pct": round(discount * 100, 1),
            })

    # Floor retention at (1 - MAX_REDUCTION_CAP)
    final_retention = max(1.0 - MAX_REDUCTION_CAP, remaining_ratio)
    return final_retention, applied_traces


def predict_waste(
    event_type: str,
    attendees: int,
    duration_hours: float,
    planned_measures: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Computes rule-based waste predictions across organic, plastic, paper, electronic, and other.

    Args:
        event_type: Category of event (e.g. Technical, Cultural, Food, Awareness, Sports, Student Club, Campus).
        attendees: Expected attendee count (integer >= 0).
        duration_hours: Event duration in hours (number > 0).
        planned_measures: Optional list of planned reduction measure IDs.

    Returns:
        Comprehensive dictionary containing:
          - is_estimate: True (prominent label)
          - disclaimer: warning that this is a model estimate, not a certified measurement
          - category breakdown in kg (predicted_organic_kg, predicted_plastic_kg, etc.)
          - total in kg (predicted_total_kg)
          - unmitigated baseline breakdown and total
          - avoided waste breakdown and total
          - documented assumptions, rates, and effective hours
    """
    if attendees < 0:
        raise ValueError("attendees must be a non-negative integer")
    if duration_hours <= 0:
        raise ValueError("duration_hours must be greater than 0")

    normalized_type = resolve_event_type(event_type)
    rates = BASELINE_RATES_KG_PER_ATTENDEE_HOUR.get(
        normalized_type,
        BASELINE_RATES_KG_PER_ATTENDEE_HOUR["Campus"],
    )

    clean_measures: List[str] = []
    if planned_measures:
        for m in planned_measures:
            m_clean = str(m).strip()
            if m_clean in REDUCTION_MEASURES and m_clean not in clean_measures:
                clean_measures.append(m_clean)

    effective_hours = calculate_effective_duration(duration_hours)

    unmitigated_breakdown: Dict[str, float] = {}
    predicted_breakdown: Dict[str, float] = {}
    avoided_breakdown: Dict[str, float] = {}
    category_retentions: Dict[str, float] = {}
    category_measure_traces: Dict[str, List[Dict[str, Any]]] = {}

    for cat in WASTE_CATEGORIES:
        rate = rates[cat]
        base_waste = attendees * effective_hours * rate
        retention, traces = calculate_category_retention(cat, clean_measures)

        mitigated_waste = base_waste * retention
        avoided_waste = base_waste - mitigated_waste

        unmitigated_breakdown[cat] = round(base_waste, 2)
        predicted_breakdown[cat] = round(mitigated_waste, 2)
        avoided_breakdown[cat] = round(avoided_waste, 2)
        category_retentions[cat] = round(retention, 4)
        category_measure_traces[cat] = traces

    unmitigated_total = round(sum(unmitigated_breakdown.values()), 2)
    predicted_total = round(sum(predicted_breakdown.values()), 2)
    avoided_total = round(max(0.0, unmitigated_total - predicted_total), 2)
    avoidance_rate = (
        round((avoided_total / unmitigated_total) * 100, 1)
        if unmitigated_total > 0
        else 0.0
    )

    # Legacy grouping compatibility
    predicted_recyclable = round(
        predicted_breakdown["plastic"]
        + predicted_breakdown["paper"]
        + predicted_breakdown["electronic"],
        2,
    )
    predicted_compost = predicted_breakdown["organic"]
    predicted_landfill = predicted_breakdown["other"]

    assumptions = {
        "model_name": "Campus Event Waste Prediction Model (v2.0)",
        "duration_curve": (
            "First 4 hours at 100% baseline consumption; hours beyond 4 at 75% intensity."
        ),
        "effective_duration_hours": round(effective_hours, 2),
        "event_type_selected": normalized_type,
        "baseline_rates_kg_per_person_hr": rates,
        "max_reduction_cap_pct": int(MAX_REDUCTION_CAP * 100),
        "measures_applied_count": len(clean_measures),
        "category_traces": category_measure_traces,
    }

    return {
        "is_estimate": True,
        "disclaimer": ESTIMATE_DISCLAIMER,
        "event_type": normalized_type,
        "attendees": attendees,
        "duration_hours": duration_hours,
        "effective_duration_hours": round(effective_hours, 2),
        "planned_measures": clean_measures,
        # Category breakdown in kilograms
        "predicted_organic_kg": predicted_breakdown["organic"],
        "predicted_plastic_kg": predicted_breakdown["plastic"],
        "predicted_paper_kg": predicted_breakdown["paper"],
        "predicted_electronic_kg": predicted_breakdown["electronic"],
        "predicted_other_kg": predicted_breakdown["other"],
        "predicted_total_kg": predicted_total,
        # Breakdown dictionary for clean iteration
        "category_breakdown": predicted_breakdown,
        "unmitigated_breakdown": unmitigated_breakdown,
        "unmitigated_total_kg": unmitigated_total,
        "avoided_breakdown": avoided_breakdown,
        "avoided_total_kg": avoided_total,
        "avoidance_rate_pct": avoidance_rate,
        # Legacy grouping fields
        "predicted_compost_kg": predicted_compost,
        "predicted_recyclable_kg": predicted_recyclable,
        "predicted_landfill_kg": predicted_landfill,
        # Assumptions documentation
        "assumptions": assumptions,
    }
