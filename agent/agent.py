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

    module_path = os.path.join("agent/modules", f"{module}.ps1")

    if not os.path.isfile(module_path):
        return {
            "success": False,
            "error": "Module not found"
        }, 404

    result = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            module_path
        ],
        capture_output=True,
        text=True
    )

    return result.stdout

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)