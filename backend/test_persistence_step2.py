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
    print('--- Step 2: Verifying Records Persisted After Flask Restart ---')
    with open('persistence_checkpoint.json', 'r') as f:
        cp = json.load(f)

    event_id = cp['event_id']
    pred_id = cp['pred_id']
    waste_id = cp['waste_id']
    fb_id = cp['fb_id']

    # 1. Verify Event persisted
    status, ev = call(f'/events/{event_id}')
    assert status == 200, f'Event {event_id} not found after restart! Status: {status}'
    assert ev['name'] == cp['event_name'], f'Event name mismatch: {ev["name"]} vs {cp["event_name"]}'
    print(f'[OK] Event #{event_id} verified: "{ev["name"]}" (Venue: {ev["venue"]}, Attendees: {ev["attendees"]})')

    # 2. Verify Prediction persisted
    status, pred_list = call('/predictions')
    assert status == 200, f'Failed to fetch predictions: {status}'
    found_pred = next((p for p in pred_list if p['id'] == pred_id), None)
    assert found_pred is not None, f'Prediction #{pred_id} missing after restart!'
    assert float(found_pred['predicted_total_kg']) == float(cp['predicted_total_kg'])
    print(f'[OK] Waste Prediction #{pred_id} verified: {found_pred["predicted_total_kg"]} kg total, is_estimate={found_pred.get("is_estimate")}')

    # 3. Verify Waste Report persisted
    status, wr_list = call('/waste-reports')
    assert status == 200, f'Failed to fetch waste reports: {status}'
    found_wr = next((w for w in wr_list if w['id'] == waste_id), None)
    assert found_wr is not None, f'Waste report #{waste_id} missing after restart!'
    assert float(found_wr['amount_kg']) == float(cp['waste_amount_kg'])
    print(f'[OK] Actual Waste Report #{waste_id} verified: {found_wr["amount_kg"]} kg {found_wr["category"]} for event #{found_wr["event_id"]}')

    # 4. Verify Feedback persisted
    status, fb_list = call('/feedback')
    assert status == 200, f'Failed to fetch feedback: {status}'
    found_fb = next((f for f in fb_list if f['id'] == fb_id), None)
    assert found_fb is not None, f'Feedback #{fb_id} missing after restart!'
    assert found_fb['message'] == cp['fb_message']
    print(f'[OK] Feedback #{fb_id} verified: "{found_fb["message"]}" by {found_fb["name"]} (Rating: {found_fb["rating"]}/5)')

    print('\n>>> ALL 4 DATA ENTITIES PERSISTED IN SQLITE ACROSS RESTART VERIFIED! <<<')

if __name__ == '__main__':
    main()
