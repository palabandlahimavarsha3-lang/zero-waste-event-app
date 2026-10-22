"""
Tests for Waste Prediction Engine
=================================
Verifies rule-based calculation formulas, duration scaling, category breakdowns
(organic, plastic, paper, electronic, other), mitigation measure discounts,
caps, assumptions documentation, and validation.
"""

import unittest
from prediction import (
    BASELINE_RATES_KG_PER_ATTENDEE_HOUR,
    EVENT_CATEGORIES,
    MAX_REDUCTION_CAP,
    REDUCTION_MEASURES,
    WASTE_CATEGORIES,
    calculate_category_retention,
    calculate_effective_duration,
    get_available_measures,
    predict_waste,
    resolve_event_type,
)


class TestWastePrediction(unittest.TestCase):
    def test_all_waste_categories_present(self):
        expected_categories = {"organic", "plastic", "paper", "electronic", "other"}
        self.assertEqual(set(WASTE_CATEGORIES), expected_categories)

    def test_baseline_rates_coverage(self):
        for event_type in EVENT_CATEGORIES:
            self.assertIn(event_type, BASELINE_RATES_KG_PER_ATTENDEE_HOUR)
            rates = BASELINE_RATES_KG_PER_ATTENDEE_HOUR[event_type]
            for cat in WASTE_CATEGORIES:
                self.assertIn(cat, rates)
                self.assertGreater(rates[cat], 0, f"{event_type} {cat} rate must be > 0")

    def test_effective_duration_formula(self):
        # <= 4 hours is linear
        self.assertEqual(calculate_effective_duration(1.0), 1.0)
        self.assertEqual(calculate_effective_duration(2.5), 2.5)
        self.assertEqual(calculate_effective_duration(4.0), 4.0)

        # > 4 hours uses 4 + (H - 4) * 0.75
        self.assertEqual(calculate_effective_duration(6.0), 4.0 + 2.0 * 0.75)  # 5.5
        self.assertEqual(calculate_effective_duration(8.0), 4.0 + 4.0 * 0.75)  # 7.0
        self.assertEqual(calculate_effective_duration(12.0), 4.0 + 8.0 * 0.75)  # 10.0

        # Boundary / zero
        self.assertEqual(calculate_effective_duration(0.0), 0.0)
        self.assertEqual(calculate_effective_duration(-2.0), 0.0)

    def test_zero_attendees(self):
        result = predict_waste("Technical", 0, 4.0)
        self.assertEqual(result["predicted_total_kg"], 0.0)
        self.assertEqual(result["predicted_organic_kg"], 0.0)
        self.assertEqual(result["predicted_plastic_kg"], 0.0)
        self.assertEqual(result["predicted_paper_kg"], 0.0)
        self.assertEqual(result["predicted_electronic_kg"], 0.0)
        self.assertEqual(result["predicted_other_kg"], 0.0)

    def test_category_breakdown_and_total_sum(self):
        attendees = 250
        duration = 5.0
        result = predict_waste("Cultural", attendees, duration)

        # Verify all 5 categories are in result
        self.assertIn("predicted_organic_kg", result)
        self.assertIn("predicted_plastic_kg", result)
        self.assertIn("predicted_paper_kg", result)
        self.assertIn("predicted_electronic_kg", result)
        self.assertIn("predicted_other_kg", result)

        breakdown = result["category_breakdown"]
        computed_sum = round(
            breakdown["organic"]
            + breakdown["plastic"]
            + breakdown["paper"]
            + breakdown["electronic"]
            + breakdown["other"],
            2,
        )
        self.assertEqual(result["predicted_total_kg"], computed_sum)

    def test_transparent_calculation_manual_verification(self):
        # Food Fest: 100 attendees, 2 hours (effective duration = 2.0)
        # Rates for Food:
        # organic: 0.065, plastic: 0.025, paper: 0.018, electronic: 0.001, other: 0.011
        # No reduction measures:
        # organic: 100 * 2.0 * 0.065 = 13.0 kg
        # plastic: 100 * 2.0 * 0.025 = 5.0 kg
        # paper: 100 * 2.0 * 0.018 = 3.6 kg
        # electronic: 100 * 2.0 * 0.001 = 0.2 kg
        # other: 100 * 2.0 * 0.011 = 2.2 kg
        # Total: 13.0 + 5.0 + 3.6 + 0.2 + 2.2 = 24.0 kg
        result = predict_waste("Food", 100, 2.0, planned_measures=[])

        self.assertEqual(result["predicted_organic_kg"], 13.0)
        self.assertEqual(result["predicted_plastic_kg"], 5.0)
        self.assertEqual(result["predicted_paper_kg"], 3.6)
        self.assertEqual(result["predicted_electronic_kg"], 0.2)
        self.assertEqual(result["predicted_other_kg"], 2.2)
        self.assertEqual(result["predicted_total_kg"], 24.0)
        self.assertEqual(result["unmitigated_total_kg"], 24.0)
        self.assertEqual(result["avoided_total_kg"], 0.0)

    def test_single_reduction_measure_discount(self):
        # Digital passes cuts paper by 75%
        baseline = predict_waste("Technical", 100, 4.0, planned_measures=[])
        mitigated = predict_waste(
            "Technical", 100, 4.0, planned_measures=["digital_ticketing_materials"]
        )

        expected_paper = round(baseline["predicted_paper_kg"] * (1.0 - 0.75), 2)
        self.assertAlmostEqual(mitigated["predicted_paper_kg"], expected_paper, places=2)

        # Other categories shouldn't be affected by digital ticketing
        self.assertEqual(mitigated["predicted_organic_kg"], baseline["predicted_organic_kg"])
        self.assertEqual(mitigated["predicted_plastic_kg"], baseline["predicted_plastic_kg"])
        self.assertEqual(mitigated["predicted_electronic_kg"], baseline["predicted_electronic_kg"])

        # Avoided amount matches difference
        self.assertGreater(mitigated["avoided_total_kg"], 0)
        self.assertAlmostEqual(
            mitigated["avoided_total_kg"],
            round(baseline["predicted_total_kg"] - mitigated["predicted_total_kg"], 2),
            places=2,
        )

    def test_stacking_multiple_measures(self):
        # Both reusable_cutlery (55% plastic reduction) and water_refill_stations (50% plastic reduction)
        # Expected plastic retention: (1 - 0.55) * (1 - 0.50) = 0.45 * 0.50 = 0.225 (77.5% reduction)
        baseline = predict_waste("Campus", 200, 4.0, planned_measures=[])
        mitigated = predict_waste(
            "Campus",
            200,
            4.0,
            planned_measures=["reusable_cutlery", "water_refill_stations"],
        )

        expected_plastic = round(baseline["predicted_plastic_kg"] * 0.225, 2)
        self.assertAlmostEqual(mitigated["predicted_plastic_kg"], expected_plastic, places=2)
        self.assertLess(mitigated["predicted_plastic_kg"], baseline["predicted_plastic_kg"])

    def test_max_reduction_cap(self):
        # Retention must not drop below (1 - MAX_REDUCTION_CAP) = 0.10
        retention, _ = calculate_category_retention(
            "plastic",
            ["reusable_cutlery", "water_refill_stations", "zero_single_use_plastic_policy"],
        )
        # (1 - 0.55) * (1 - 0.50) * (1 - 0.40) = 0.45 * 0.5 * 0.6 = 0.135 > 0.10
        self.assertGreaterEqual(retention, 1.0 - MAX_REDUCTION_CAP)

    def test_estimate_label_and_disclaimer(self):
        result = predict_waste("Awareness", 150, 3.0)
        self.assertTrue(result["is_estimate"])
        self.assertIn("ESTIMATE ONLY", result["disclaimer"])
        self.assertIn("not represent actual weighed measurements", result["disclaimer"])

    def test_assumptions_documented(self):
        result = predict_waste("Sports", 300, 4.0, planned_measures=["water_refill_stations"])
        assumptions = result["assumptions"]
        self.assertIn("model_name", assumptions)
        self.assertIn("duration_curve", assumptions)
        self.assertIn("baseline_rates_kg_per_person_hr", assumptions)
        self.assertIn("category_traces", assumptions)

    def test_legacy_category_mapping(self):
        result = predict_waste("Student Club", 100, 4.0)
        self.assertEqual(result["predicted_compost_kg"], result["predicted_organic_kg"])
        expected_recyclable = round(
            result["predicted_plastic_kg"]
            + result["predicted_paper_kg"]
            + result["predicted_electronic_kg"],
            2,
        )
        self.assertEqual(result["predicted_recyclable_kg"], expected_recyclable)
        self.assertEqual(result["predicted_landfill_kg"], result["predicted_other_kg"])

    def test_case_insensitivity_and_resolution(self):
        self.assertEqual(resolve_event_type("technical"), "Technical")
        self.assertEqual(resolve_event_type("FOOD"), "Food")
        self.assertEqual(resolve_event_type("unknown_nonexistent"), "Campus")

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            predict_waste("Technical", -5, 4.0)
        with self.assertRaises(ValueError):
            predict_waste("Technical", 100, 0.0)
        with self.assertRaises(ValueError):
            predict_waste("Technical", 100, -2.0)

    def test_available_measures_catalog(self):
        measures = get_available_measures()
        self.assertGreaterEqual(len(measures), 5)
        for m in measures:
            self.assertIn("id", m)
            self.assertIn("name", m)
            self.assertIn("description", m)
            self.assertIn("reductions", m)


if __name__ == "__main__":
    unittest.main()
