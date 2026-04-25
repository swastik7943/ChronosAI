import requests

url = "http://localhost:8000/parse"

tests = [
    ("Schedule a meeting with Alex, Bob, and Carol tomorrow at 3 pm", "Multi-participant"),
    ("Schedule meeting with team tomorrow afternoon", "Time range + title"),
    ("What meetings do I have tomorrow?", "Query intent"),
    ("When am I free tomorrow?", "Availability intent"),
    ("Cancel my meeting with Alex tomorrow", "Cancel intent"),
    ("Move my meeting with Bob to Friday", "Reschedule intent"),
    ("Set up a meeting with Dave for 1 hour", "Schedule + duration"),
    ("Schedule a meeting to discuss Q3 budget with Alex tomorrow", "Title hint"),
    ("30 minutes", "Duration only"),
    ("Alex, Bob", "Multi-name follow-up"),
    ("afternoon", "Time range only"),
]

for msg, label in tests:
    resp = requests.post(url, json={"message": msg})
    d = resp.json()
    print(f"[{label}] '{msg}'")
    print(f"  intent={d['intent']} | date={d['date']} | time={d['time']} | range={d.get('time_range')} | dur={d['duration']} | parts={d['participants']} | title={d.get('title_hint')}")
    print()
