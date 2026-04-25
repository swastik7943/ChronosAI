import os
from google import genai
from dotenv import load_dotenv
from pathlib import Path

# Find root .env file
root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

api_key = os.environ.get("GEMINI_API_KEY")
print(f"Testing API Key: {api_key[:5]}...{api_key[-5:] if api_key else 'None'}")

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents='Hi, are you working?'
    )
    print("Success!")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
