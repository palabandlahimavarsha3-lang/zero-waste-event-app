"""
Tests for Eco-Friendly Alternatives Module
===========================================
Verifies that alternatives are dynamically recommended and prioritized
based on predicted waste, and that all required core examples are present.
"""

import unittest
from app import app
from database import init_db


class TestRecommendations(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = app.test_client()

    def test_all_five_required_examples_present(self):
        response = self.client.get("/api/recommendations")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        recs = data.get("recommendations", [])
        self.assertGreaterEqual(len(recs), 5)

        # Check for the 5 required examples
        instead_ofs = [r["insteadOf"].lower() for r in recs]
        uses = [r["use"].lower() for r in recs]

        # 1. Plastic cups -> reusable steel cups
        has_steel_cups = any(
            "plastic cup" in inst and "steel cup" in u
            for inst, u in zip(instead_ofs, uses)
        )
        self.assertTrue(has_steel_cups, "Missing alternative: Plastic cups -> reusable steel cups")

        # 2. Paper waste -> digital certificates and invitations
        has_digital_cert = any(
            "paper" in inst and ("certificate" in u or "invitation" in u)
            for inst, u in zip(instead_ofs, uses)
        )
        self.assertTrue(has_digital_cert, "Missing alternative: Paper waste -> digital certificates and invitations")

        # 3. Disposable decorations -> reusable decorations
        has_reusable_decor = any(
            "decoration" in inst and "reusable decoration" in u
            for inst, u in zip(instead_ofs, uses)
        )
        self.assertTrue(has_reusable_decor, "Missing alternative: Disposable decorations -> reusable decorations")

        # 4. Food waste -> improved catering and portion planning
        has_portion_planning = any(
            "food waste" in inst and ("portion planning" in u or "catering" in u)
            for inst, u in zip(instead_ofs, uses)
        )
        self.assertTrue(has_portion_planning, "Missing alternative: Food waste -> improved catering and portion planning")

        # 5. E-waste -> authorized collection and recycling
        has_ewaste_recycling = any(
            "e-waste" in inst and ("collection" in u and "recycling" in u)
            for inst, u in zip(instead_ofs, uses)
        )
        self.assertTrue(has_ewaste_recycling, "Missing alternative: E-waste -> authorized collection and recycling")

    def test_recommendations_prioritized_by_predicted_waste(self):
        # When organic waste dominates (e.g. 80kg organic, 5kg plastic)
        payload = {
            "predicted_breakdown": {
                "organic": 80.0,
                "plastic": 5.0,
                "paper": 2.0,
                "electronic": 1.0,
                "other": 3.0,
            }
        }
        res = self.client.post("/api/recommendations", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        top_rec = data["recommendations"][0]
        self.assertEqual(top_rec["wasteStream"], "organic")
        self.assertEqual(top_rec["priority"], "High Priority")
        self.assertEqual(top_rec["predictedStreamKg"], 80.0)

    def test_stream_filter(self):
        res = self.client.get("/api/recommendations?waste_stream=electronic")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        for r in data["recommendations"]:
            self.assertEqual(r["wasteStream"], "electronic")


if __name__ == "__main__":
    unittest.main()
