import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "data" / "db.json"
EXTRACTED_PATH = REPO_ROOT / "data" / "extracted_projects.json"

def merge_data():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)
    
    with open(EXTRACTED_PATH, "r", encoding="utf-8") as f:
        extracted = json.load(f)
    
    # Existing projects - some might be placeholders
    existing_stalls = {p["stall_number"] for p in db.get("projects", [])}
    
    new_count = 0
    for item in extracted:
        # Avoid duplicate stalls
        if item["stall_number"] not in existing_stalls:
            db["projects"].append({
                "title": item["title"],
                "category": item["category"],
                "stall_number": item["stall_number"],
                "team_name": "TATA STEEL TRAINEES", # Defaulting as per filenames
                "description": item["description"]
            })
            new_count += 1
    
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully merged {new_count} new projects into db.json.")

if __name__ == "__main__":
    merge_data()
