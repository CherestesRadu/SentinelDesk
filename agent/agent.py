from flask import Flask
from flask_cors import CORS
from flask import request
import subprocess
import os

app = Flask(__name__)
CORS(app)

@app.route("/status")
def status():
    return {
        "status": "online"
    }

@app.route("/run", methods=["POST"])
def run_module():
    data = request.get_json()

    module = data.get("module")
    target = data.get("target") # for ping

    module_path = os.path.join("agent/modules", f"{module}.ps1")

    if not os.path.isfile(module_path):
        return {
            "success": False,
            "error": "Module not found"
        }, 404

    arguments = []
    if module == "ping":
        if not isinstance(target, str) or not target.strip():
            return {
                "success": False,
                "error": "Ping target is required"
            }, 400

        arguments = [
            "-Target",
            target.strip()
        ]
    
    result = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            module_path,
            *arguments
        ],
        capture_output=True,
        text=True,
        timeout=30
    )

    return result.stdout

@app.route("/audit")
def audit():
    log_path = os.path.join("agent", "logs", "audit.log")

    if not os.path.isfile(log_path):
        return {
            "success": True,
            "entries": []
        }

    try:
        with open(log_path, "rb") as file:
            raw = file.read()

        if raw.startswith(b"\xff\xfe"):
            contents = raw[2:].decode("utf-16-le")
        else:
            contents = raw.decode("utf-8")

        lines = contents.splitlines()

        entries = []

        for line in lines:
            line = line.strip()

            if not line:
                continue

            if line.startswith("[") and "]:" in line:
                timestamp, message = line.split("]:", 1)
            
                timestamp = timestamp.strip("[] ")
                message = message.strip()
            
                level = "warn" if any(
                    word in message.lower()
                    for word in ["warn", "error", "fail"]
                ) else "ok"
            
                entries.append({
                    "time": timestamp,
                    "level": level,
                    "message": message
                })

        entries.reverse()

        return {
            "success": True,
            "entries": entries
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error)
        }, 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)