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
    print('--- Step 1: Inserting Test Records Before Restart ---')
    # 1. Event
    ev_payload = {
        'name': 'SRIT Clean Campus Conclave 2026',
        'venue': 'Sir M. Visvesvaraya Auditorium',
        'event_date': '2026-12-05',
        'attendees': 450,
        'duration_hours': 6.0,
        'category': 'Technical',
        'status': 'Upcoming'
    }
    status, ev = call('/events', 'POST', ev_payload)
    assert status == 201, f'Event creation failed: {status}, {ev}'
    event_id = ev['id']
    print(f'1. Created Event #{event_id}: {ev["name"]}')

    # 2. Prediction
    pred_payload = {
        'event_id': event_id,
        'event_type': 'Technical',
        'attendees': 450,
        'duration_hours': 6.0,
        'planned_measures': ['reusable_cutlery', 'water_refill_stations', 'digital_ticketing_materials']
    }
    status, pred = call('/predictions', 'POST', pred_payload)
    assert status == 201, f'Prediction creation failed: {status}, {pred}'
    pred_id = pred['id']
    print(f'2. Created Waste Prediction #{pred_id}: Total {pred["predicted_total_kg"]} kg (Organic: {pred["predicted_organic_kg"]}kg, Plastic: {pred["predicted_plastic_kg"]}kg, Paper: {pred["predicted_paper_kg"]}kg, Electronic: {pred["predicted_electronic_kg"]}kg, Other: {pred["predicted_other_kg"]}kg)')

    # 3. Waste Report
    waste_payload = {
        'event_id': event_id,
        'category': 'recyclable',
        'amount_kg': 26.4,
        'reported_by': 'Persistence Audit Team',
        'notes': 'Pre-restart certified scale log at Quadrangle point'
    }
    status, wr = call('/waste-reports', 'POST', waste_payload)
    assert status == 201, f'Waste report failed: {status}, {wr}'
    waste_id = wr['id']
    print(f'3. Created Waste Report #{waste_id}: {wr["amount_kg"]} kg {wr["category"]} for event #{event_id}')

    # 4. Feedback
    fb_payload = {
        'name': 'Prof. Rajesh K.',
        'role': 'Faculty',
        'event': ev['name'],
        'rating': 5,
        'message': 'Outstanding waste segregation audit. Pre-restart persistence check verified.'
    }
    status, fb = call('/feedback', 'POST', fb_payload)
    assert status == 201, f'Feedback failed: {status}, {fb}'
    fb_id = fb['id']
    print(f'4. Created Feedback #{fb_id} by {fb["name"]} for event {fb["event"]}')

    saved_state = {
        'event_id': event_id,
        'pred_id': pred_id,
        'waste_id': waste_id,
        'fb_id': fb_id,
        'event_name': ev['name'],
        'predicted_total_kg': pred['predicted_total_kg'],
        'waste_amount_kg': wr['amount_kg'],
        'fb_message': fb['message']
    }
    with open('persistence_checkpoint.json', 'w') as f:
        json.dump(saved_state, f, indent=2)

    print('State saved to persistence_checkpoint.json successfully!')

if __name__ == '__main__':
    main()
