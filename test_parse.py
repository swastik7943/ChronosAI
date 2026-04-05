import requests

url = "http://localhost:8000/parse"

tests = [
    "Schedule a meeting with Alex tomorrow at 3 pm",
    "Schedule a meeting with Bob today at 10 am for 1 hour",
    "Cancel the meeting with Alex tomorrow",
    "Reschedule the meeting with Bob tomorrow",
    "30 minutes",
    "Alex",
    "tomorrow",
    "3 pm",
]

for msg in tests:
    resp = requests.post(url, json={"message": msg})
    data = resp.json()
    print(f"INPUT: '{msg}'")
    print(f"  -> intent={data['intent']}, date={data['date']}, time={data['time']}, duration={data['duration']}, participants={data['participants']}")
    print()
