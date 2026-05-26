$env:PYTHONUTF8 = '1'
Set-Location 'C:\Users\PICHAU\Desktop\Extrator Leads\backend'
& '.\venv\Scripts\python.exe' -m uvicorn app.main:app --port 8000 --host 0.0.0.0 --reload
