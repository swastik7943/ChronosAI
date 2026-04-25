import os
import json
from pathlib import Path
from dotenv import load_dotenv
import sys

# Ensure ai_service is in the path
ai_dir = Path(r"c:\ChronosAI\ai_service")
sys.path.append(str(ai_dir))

from agent.parser import parse_message

def run_tests():
    print("Testing AI Service Chat Enhancements...")
    
    # 1. Multi-turn Memory Test
    history = [
        {"role": "user", "content": "Schedule a meeting with Alex"},
        {"role": "model", "content": "Sure, what date?"}
    ]
    res1 = parse_message("Actually make it for next Monday at 2 PM", current_time="2026-04-21T08:00:00+05:30", history=history)
    print(f"\n[Test 1] Multi-turn Memory:")
    print(f"Intent: {res1.intent}")
    print(f"Date: {res1.date}")
    print(f"Time: {res1.time}")
    print(f"Participants: {res1.participants}")
    
    # 2. Team Parsing (Just extracting the name, resolution is backend)
    res2 = parse_message("Schedule a design review with the Marketing Team for tomorrow at 10 AM", current_time="2026-04-21T08:00:00+05:30")
    print(f"\n[Test 2] Team Name Parsing:")
    print(f"Participants: {res2.participants}")
    print(f"Title: {res2.title_hint}")

    # 3. Query with Participants
    res3 = parse_message("What meetings do I have with Sarah next week?", current_time="2026-04-21T08:00:00+05:30")
    print(f"\n[Test 3] Advanced Query Search:")
    print(f"Intent: {res3.intent}")
    print(f"Participants: {res3.participants}")

if __name__ == "__main__":
    run_tests()
