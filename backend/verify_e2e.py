import urllib.request
import json
import sys

BASE = 'http://localhost:5173/api'

def call(path, method='GET', payload=None):
    url = f'{BASE}{path}'
    req = urllib.request.Request(url, method=method)
    if payload is not None:
        req.add_header('Content-Type', 'application/json')
        data = json.dumps(payload).encode('utf-8')
    else:
        data = None
    try:
        with urllib.request.urlopen(req, data=data, timeout=8) as res:
            body = res.read().decode('utf-8')
            return res.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'error': body}

def main():
    print('=== 1. TEST DASHBOARD SUMMARY ===')
    status, summary = call('/summary')
    assert status == 200, f'Status was {status}'
    print(f'Dashboard summary OK: {summary}')
    assert 'event_count' in summary
    assert 'total_kg' in summary
    assert 'diversion_rate' in summary

    print('\n=== 2. TEST EVENTS CRUD ===')
    # Create
    create_payload = {
        'name': 'Green Campus Automation Summit',
        'venue': 'APJ Abdul Kalam Seminar Hall',
        'event_date': '2026-11-20',
        'attendees': 250,
        'duration_hours': 5,
        'category': 'Technical',
        'status': 'Planning'
    }
    status, created = call('/events', 'POST', create_payload)
    assert status == 201, f'Create failed: {status}, {created}'
    event_id = created['id']
    print(f'Created event ID {event_id}: {created["name"]}')

    # View single
    status, viewed = call(f'/events/{event_id}')
    assert status == 200, f'View failed: {status}'
    assert viewed['attendees'] == 250
    print(f'Viewed event {event_id} successfully')

    # Edit / Update
    update_payload = {
        'name': 'Green Campus Automation Summit (Updated)',
        'venue': 'APJ Abdul Kalam Seminar Hall',
        'event_date': '2026-11-20',
        'attendees': 320,
        'duration_hours': 6,
        'category': 'Technical',
        'status': 'Upcoming'
    }
    status, updated = call(f'/events/{event_id}', 'PUT', update_payload)
    assert status == 200, f'Update failed: {status}'
    assert updated['attendees'] == 320
    assert updated['name'] == 'Green Campus Automation Summit (Updated)'
    print(f'Updated event {event_id} attendees to 320')

    # Log waste for this event
    waste_payload = {
        'category': 'recyclable',
        'amount_kg': 14.5,
        'reported_by': 'SRIT Green Volunteers',
        'notes': 'Paper cups and flyers collected'
    }
    status, logged_waste = call(f'/events/{event_id}/waste', 'POST', waste_payload)
    assert status == 201, f'Waste log failed: {status}'
    print(f'Logged waste for event {event_id}: {logged_waste}')

    # Delete event
    status, del_resp = call(f'/events/{event_id}', 'DELETE')
    assert status == 200, f'Delete failed: {status}'
    print(f'Deleted event {event_id} successfully')

    # Confirm deletion
    status, check_del = call(f'/events/{event_id}')
    assert status == 404, f'Expected 404 after delete, got {status}'
    print(f'Confirmed event {event_id} is deleted (404)')

    print('\n=== 3. TEST WASTE PREDICTION & ESTIMATES ===')
    pred_payload = {
        'event_type': 'Technical',
        'attendees': 400,
        'duration_hours': 8,
        'planned_measures': ['reusable_cutlery', 'water_refill_stations', 'digital_ticketing_materials']
    }
    status, pred = call('/predictions', 'POST', pred_payload)
    assert status == 201, f'Prediction generation failed: {status}, {pred}'
    pred_id = pred['id']
    print(f'Prediction #{pred_id} created:')
    print(f'  - Is Estimate: {pred.get("is_estimate")}')
    print(f'  - Total Predicted: {pred["predicted_total_kg"]} kg')
    print(f'  - Organic: {pred["predicted_organic_kg"]} kg')
    print(f'  - Plastic: {pred["predicted_plastic_kg"]} kg')
    print(f'  - Paper: {pred["predicted_paper_kg"]} kg')
    print(f'  - Electronic: {pred["predicted_electronic_kg"]} kg')
    print(f'  - Other: {pred["predicted_other_kg"]} kg')
    assert pred.get('is_estimate') is True
    assert 'planning estimate' in pred.get('disclaimer', '').lower()

    # Verify in GET /predictions
    status, pred_list = call('/predictions')
    assert status == 200
    assert any(p['id'] == pred_id for p in pred_list)
    print(f'Verified prediction #{pred_id} is stored in SQLite')

    print('\n=== 4. TEST ECO-FRIENDLY ALTERNATIVES WITH PREDICTION CONTEXT ===')
    status, rec_data = call(f'/recommendations?prediction_id={pred_id}')
    assert status == 200
    recs = rec_data['recommendations']
    print(f'Fetched {len(recs)} prioritized eco-friendly recommendations')
    for r in recs[:3]:
        title = r.get('title') or r.get('practice_name')
        stream = r.get('wasteStream') or r.get('waste_stream')
        kg = r.get('predictedStreamKg', 0)
        print(f'  - [{r.get("priority", "Standard")}] {title}: {stream} ({kg} kg predicted)')

    print('\n=== 5. TEST ACTUAL WASTE REPORTS ===')
    # Get an existing event
    status, all_events = call('/events')
    target_ev = all_events[0]
    report_payload = {
        'event_id': target_ev['id'],
        'category': 'compost',
        'amount_kg': 8.75,
        'reported_by': 'Catering Audit Volunteer',
        'notes': 'Leftover food scraps transferred to campus vermicomposting pit'
    }
    status, report_res = call('/waste-reports', 'POST', report_payload)
    assert status == 201, f'Submit report failed: {status}, {report_res}'
    print(f'Submitted actual waste report #{report_res["id"]} for {target_ev["name"]}')

    # Check /reports aggregated data
    status, reports_data = call('/reports')
    assert status == 200
    assert 'events' in reports_data
    assert 'monthly' in reports_data
    print(f'Reports aggregated successfully: {len(reports_data["events"])} event summaries, {len(reports_data["monthly"])} monthly records')

    print('\n=== 6. TEST COMMUNITY FEEDBACK ===')
    fb_payload = {
        'name': 'Vikram Rathore',
        'role': 'Student',
        'event': target_ev['name'],
        'rating': 5,
        'message': 'Steel cups at the hydration booth made a huge difference! Virtually no plastic bottles found around the lawn.'
    }
    status, fb_res = call('/feedback', 'POST', fb_payload)
    assert status == 201, f'Feedback submission failed: {status}'
    print(f'Submitted feedback: {fb_res}')

    status, fb_list = call('/feedback')
    assert status == 200
    assert any(f['name'] == 'Vikram Rathore' for f in fb_list)
    print(f'Retrieved feedback from SQLite: {len(fb_list)} total entries')

    print('\n=== 7. TEST VALIDATION AND ERROR MESSAGES ===')
    # Invalid event payload (missing required field)
    status, err_resp = call('/events', 'POST', {'name': 'Missing Venue'})
    assert status == 400
    print(f'Event validation error handled: {err_resp}')

    # Invalid waste log amount (negative)
    status, err_resp = call(f'/events/{target_ev["id"]}/waste', 'POST', {'category': 'compost', 'amount_kg': -5})
    assert status == 400
    print(f'Waste validation error handled: {err_resp}')

    # Invalid prediction attendees (negative)
    status, err_resp = call('/predictions', 'POST', {'attendees': -100, 'duration_hours': 4})
    assert status == 400
    print(f'Prediction validation error handled: {err_resp}')

    print('\n>>> ALL 7 END-TO-END REST & FRONTEND INTEGRATION CHECKS PASSED SUCCESSFULLY! <<<')

if __name__ == '__main__':
    main()
