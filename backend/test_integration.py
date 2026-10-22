"""
Full End-to-End Integration Test Suite
======================================
Tests all Flask REST API endpoints and CRUD workflows:
1. Health check (/api/health)
2. Summary statistics (/api/summary)
3. Event-wise and monthly reports (/api/reports)
4. Events CRUD (/api/events - create, view, update, delete)
5. Actual waste logs (/api/events/<id>/waste and /api/waste-reports)
6. Waste predictions (/api/predictions)
7. Eco-friendly alternatives (/api/recommendations)
8. Feedback submissions and listing (/api/feedback)
"""

import json
import unittest
from app import app
from database import init_db


class TestIntegrationSuite(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = app.test_client()

    def test_health(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'ok')

    def test_summary_and_reports(self):
        res_summary = self.client.get('/api/summary')
        self.assertEqual(res_summary.status_code, 200)
        summary = res_summary.get_json()
        self.assertIn('total_kg', summary)
        self.assertIn('diverted_kg', summary)
        self.assertIn('diversion_rate', summary)
        self.assertIn('event_count', summary)

        res_reports = self.client.get('/api/reports')
        self.assertEqual(res_reports.status_code, 200)
        reports = res_reports.get_json()
        self.assertIn('events', reports)
        self.assertIn('monthly', reports)

    def test_events_full_crud_and_waste_logging(self):
        # 1. CREATE
        new_event_payload = {
            'name': 'SRIT Robotics Expo 2026',
            'venue': 'Main Auditorium',
            'event_date': '2026-11-25',
            'attendees': 450,
            'duration_hours': 6.0,
            'category': 'Technical',
            'status': 'Planning',
        }
        res_create = self.client.post('/api/events', json=new_event_payload)
        self.assertEqual(res_create.status_code, 201)
        created_event = res_create.get_json()
        event_id = created_event['id']
        self.assertEqual(created_event['name'], 'SRIT Robotics Expo 2026')
        self.assertEqual(created_event['attendees'], 450)

        # 2. VIEW
        res_view = self.client.get(f'/api/events/{event_id}')
        self.assertEqual(res_view.status_code, 200)
        viewed_event = res_view.get_json()
        self.assertEqual(viewed_event['id'], event_id)

        # 3. UPDATE / EDIT
        update_payload = {
            'name': 'SRIT Robotics Expo 2026 (Updated)',
            'status': 'Upcoming',
            'attendees': 500,
        }
        res_update = self.client.put(f'/api/events/{event_id}', json=update_payload)
        self.assertEqual(res_update.status_code, 200)
        updated_event = res_update.get_json()
        self.assertEqual(updated_event['name'], 'SRIT Robotics Expo 2026 (Updated)')
        self.assertEqual(updated_event['attendees'], 500)
        self.assertEqual(updated_event['status'], 'Upcoming')

        # 4. LOG WASTE
        waste_payload = {
            'category': 'recyclable',
            'amount_kg': 15.5,
            'notes': 'Cardboard and PET bottles',
            'reported_by': 'Eco Club Volunteer',
        }
        res_waste = self.client.post(f'/api/events/{event_id}/waste', json=waste_payload)
        self.assertEqual(res_waste.status_code, 201)
        waste_log = res_waste.get_json()
        self.assertEqual(waste_log['amount_kg'], 15.5)

        # 5. ACTUAL WASTE REPORTS LIST
        res_reports = self.client.get(f'/api/waste-reports?event_id={event_id}')
        self.assertEqual(res_reports.status_code, 200)
        logs = res_reports.get_json()
        self.assertTrue(any(l['amount_kg'] == 15.5 for l in logs))

        # 6. DELETE EVENT
        res_delete = self.client.delete(f'/api/events/{event_id}')
        self.assertEqual(res_delete.status_code, 200)
        delete_data = res_delete.get_json()
        self.assertTrue(delete_data.get('deleted'))

        # Verify not found after delete
        res_after = self.client.get(f'/api/events/{event_id}')
        self.assertEqual(res_after.status_code, 404)

    def test_predictions_and_recommendations_flow(self):
        # 1. CREATE PREDICTION
        pred_payload = {
            'event_type': 'Cultural',
            'attendees': 600,
            'duration_hours': 6.0,
            'planned_measures': [
                'reusable_cutlery',
                'water_refill_stations',
                'zero_single_use_plastic_policy',
            ],
        }
        res_pred = self.client.post('/api/predictions', json=pred_payload)
        self.assertEqual(res_pred.status_code, 201)
        pred = res_pred.get_json()
        pred_id = pred['id']
        self.assertTrue(pred.get('is_estimate'))
        self.assertIn('ESTIMATE ONLY', pred.get('disclaimer'))
        self.assertIn('category_breakdown', pred)
        self.assertGreater(pred['predicted_total_kg'], 0)
        self.assertGreater(pred['avoided_total_kg'], 0)

        # 2. LIST PREDICTIONS
        res_list = self.client.get('/api/predictions')
        self.assertEqual(res_list.status_code, 200)
        all_preds = res_list.get_json()
        self.assertTrue(any(p['id'] == pred_id for p in all_preds))

        # 3. GET RECOMMENDATIONS TAILORED TO PREDICTION
        res_recs = self.client.get(f'/api/recommendations?prediction_id={pred_id}')
        self.assertEqual(res_recs.status_code, 200)
        recs_data = res_recs.get_json()
        self.assertIn('recommendations', recs_data)
        recs = recs_data['recommendations']
        self.assertGreaterEqual(len(recs), 5)
        # Verify priority is assigned
        self.assertIn('priority', recs[0])

    def test_feedback_flow(self):
        fb_payload = {
            'name': 'Kavya Raman',
            'role': 'Student',
            'event': 'Green Campus Drive',
            'rating': 5,
            'message': 'Segregation stations were well positioned near the canteen.',
        }
        res_post = self.client.post('/api/feedback', json=fb_payload)
        self.assertEqual(res_post.status_code, 201)
        created_fb = res_post.get_json()
        self.assertEqual(created_fb['name'], 'Kavya Raman')

        res_list = self.client.get('/api/feedback')
        self.assertEqual(res_list.status_code, 200)
        feedbacks = res_list.get_json()
        self.assertTrue(any(f['name'] == 'Kavya Raman' for f in feedbacks))


if __name__ == '__main__':
    unittest.main()
