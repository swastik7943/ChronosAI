import os
import json
import re
from datetime import date
import dateparser
import google.generativeai as genai
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class ParsedResult(BaseModel):
    intent: str
    date: str | None = None
    time: str | None = None
    timezone: str | None = None
    duration: int | None = None # in minutes
    participants: list[str] = []

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "dummy_key"))
model = genai.GenerativeModel('gemini-1.5-flash')

def fallback_parse(text: str, intent: str) -> ParsedResult:
    date_val = None
    time_val = None
    duration_val = None
    participants = []

    # Time extraction
    time_match = re.search(r'\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b', text.lower())
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        am_pm = time_match.group(3)
        if am_pm == 'pm' and hour < 12: hour += 12
        if am_pm == 'am' and hour == 12: hour = 0
        time_val = f"{hour:02d}:{minute:02d}"
    elif re.search(r'^(\d{1,2})(?::(\d{2}))?$', text.strip()):
        # Handle just "15:00" or "15" safely as time response
        tm = re.search(r'^(\d{1,2})(?::(\d{2}))?$', text.strip())
        hour = int(tm.group(1))
        minute = int(tm.group(2)) if tm.group(2) else 0
        if 0 <= hour <= 23:
            time_val = f"{hour:02d}:{minute:02d}"

    # Date extraction (using simple matching for dialogue responses)
    if "tomorrow" in text.lower():
        date_val = dateparser.parse("tomorrow").strftime("%Y-%m-%d")
    elif "today" in text.lower():
        date_val = dateparser.parse("today").strftime("%Y-%m-%d")
    elif re.search(r'202\d-\d{2}-\d{2}', text):
        date_val = re.search(r'202\d-\d{2}-\d{2}', text).group(0)

    # Participants
    part_match = re.search(r'with\s+([A-Z][a-z]+)', text)
    if part_match:
        participants.append(part_match.group(1))
    elif re.search(r'^([a-zA-Z]+)$', text.strip()):
        # If user replies just "Alex"
        words = text.strip().lower()
        if words not in ['tomorrow', 'today', 'cancel', 'reschedule', 'yes', 'no']:
            participants.append(text.strip().capitalize())

    # Duration
    dur_match = re.search(r'(\d+)\s*(min|minute|hour|hr)', text.lower())
    if dur_match:
        val = int(dur_match.group(1))
        unit = dur_match.group(2)
        if 'hour' in unit or 'hr' in unit: duration_val = val * 60
        else: duration_val = val

    return ParsedResult(
        intent=intent,
        date=date_val,
        time=time_val,
        duration=duration_val,
        participants=participants
    )

def parse_message(text: str) -> ParsedResult:
    intent = "schedule"
    if "cancel" in text.lower() or "delete" in text.lower(): intent = "cancel"
    if "reschedule" in text.lower() or "move" in text.lower(): intent = "reschedule"

    if not os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") == "your_gemini_api_key_here":
        print("Warning: GEMINI_API_KEY is not configured yet. Fallback to basic intent extraction.")
        return fallback_parse(text, intent)

    today_str = date.today().isoformat()
    prompt = f"""
    Calculate dates assuming today is {today_str}.
    Analyze the user's scheduling message and extract the following details into a strict JSON format with exactly these keys:
    - "intent": string ("schedule", "reschedule", "cancel", or "unknown")
    - "date": string (YYYY-MM-DD) or null
    - "time": string (HH:MM in 24-hour format) or null
    - "timezone": string (e.g. "EST", "PST", "UTC") or null
    - "duration": integer (in minutes) or null
    - "participants": array of strings (names/emails)

    Respond ONLY with the JSON object. Do not include markdown codeblocks like ```json .
    
    User message: "{text}"
    """

    try:
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        
        return ParsedResult(
            intent=data.get("intent", "unknown"),
            date=data.get("date"),
            time=data.get("time"),
            timezone=data.get("timezone"),
            duration=data.get("duration"),
            participants=data.get("participants", [])
        )
    except Exception as e:
        print(f"Gemini API Error: {e}")
        print("Falling back to rule-based parsing...")
        return fallback_parse(text, intent)
