import requests

url = "http://localhost:8000/parse"
payload = {"message": "Schedule a meeting with Alex tomorrow at 3 pm"}
response = requests.post(url, json=payload)

print(response.json())
