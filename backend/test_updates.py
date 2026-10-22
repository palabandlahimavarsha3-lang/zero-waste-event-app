import pytest
from app import app
from database import init_db

@pytest.fixture
def client():
    init_db()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_predict_waste_api(client):
    res = client.post("/api/predict-waste", json={
        "attendees": 100,
        "duration": 4,
        "category": "Technical"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_kg"] == 35.0
    assert data["breakup"]["Plastic Bottles"] == "120 Count"
    assert data["breakup"]["Paper Cups"] == "80 Count"
    assert data["breakup"]["Food Plates"] == "100 Count"
    assert data["breakup"]["Food Waste"] == "15.0 kg"
    assert data["breakup"]["Paper Waste"] == "8.0 kg"

def test_get_alternatives_api(client):
    res = client.post("/api/get-alternatives", json={
        "attendees": 200
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "alternatives" in data
    alts = data["alternatives"]
    assert len(alts) == 4
    
    # Check key requirements:
    bottles = next(a for a in alts if a["item"] == "Plastic Bottles")
    assert "Water Dispensers + Steel Glasses" in bottles["action"]
    assert "Save 80%" in bottles["impact"]
    assert "Save ₹" in bottles["cost_saved"]

    cups = next(a for a in alts if a["item"] == "Paper Cups/Plates")
    assert "Areca Leaf Plates + Clay Kulhads" in cups["action"]
    assert "100% biodegradable" in cups["impact"]

    food = next(a for a in alts if a["item"] == "Food Waste")
    assert "RSVP Form + NGO Donation Tie-up" in food["action"]
    assert "Reduce 50%" in food["impact"]

    banners = next(a for a in alts if a["item"] == "Paper Banners")
    assert "Digital Boards + Cloth Banners" in banners["action"]
    assert "Save ₹2000" in banners["cost_saved"]

def test_audit_waste_lifecycle(client):
    # 1. Save audit items
    save_res = client.post("/api/save-audit-items", json={
        "event": "SRIT Tech Fest",
        "items": [
            {"name": "Cardboard Boxes", "qty": 14.5, "unit": "kg"},
            {"name": "Glass Bottles", "qty": 50, "unit": "Count"}
        ]
    })
    assert save_res.status_code == 201
    save_data = save_res.get_json()
    assert save_data["success"] is True
    assert len(save_data["saved_items"]) == 2
    item1_id = save_data["saved_items"][0]["id"]

    # 2. List audit items
    get_res = client.get("/api/get-audit-items")
    assert get_res.status_code == 200
    items = get_res.get_json()
    assert any(i["id"] == item1_id for i in items)

    # 3. Edit audit item
    edit_res = client.put(f"/api/edit-audit-item/{item1_id}", json={
        "name": "Cardboard Boxes (Flattened)",
        "qty": 18.0,
        "unit": "kg"
    })
    assert edit_res.status_code == 200
    edit_data = edit_res.get_json()
    assert edit_data["name"] == "Cardboard Boxes (Flattened)"
    assert edit_data["qty"] == 18.0

    # 4. Delete audit item
    del_res = client.delete(f"/api/edit-audit-item/{item1_id}")
    assert del_res.status_code == 200
    assert del_res.get_json()["success"] is True

    # 5. Verify deletion
    get_after = client.get("/api/get-audit-items")
    items_after = get_after.get_json()
    assert not any(i["id"] == item1_id for i in items_after)
