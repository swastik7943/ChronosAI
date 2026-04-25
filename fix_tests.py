import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add session creation and user registration
    if 'session = requests.Session()' not in content:
        content = content.replace('BASE = "http://localhost:5000/api"',
                                  'BASE = "http://localhost:5000/api"\n'
                                  'session = requests.Session()\n'
                                  '# Pre-register user\n'
                                  'session.post(f"{BASE}/auth/register", json={"name":"Test","email":"test@test.com","password":"password123"})\n'
                                  'session.post(f"{BASE}/auth/register", json={"name":"Alice","email":"alice@test.com","password":"password123"})\n')
    
    # 2. Replace requests.<method> with session.<method>
    content = re.sub(r'requests\.(get|post|put|delete)\(', r'session.\1(', content)
    
    # 3. Handle token check which might fail now (since token is in cookie)
    # token = r.json().get("token", "") -> token = r.cookies.get("token", "")
    content = content.replace('token = r.json().get("token")', 'token = r.cookies.get("token")')
    content = content.replace('token = r.json().get("token", "")', 'token = r.cookies.get("token", "")')
    
    # 4. Same for "Authorization": f"Bearer {token}"
    content = content.replace('headers = {"Authorization": f"Bearer {token}"}', 'headers = {}')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('test_all.py')
fix_file('test_features.py')
print("Tests fixed!")
