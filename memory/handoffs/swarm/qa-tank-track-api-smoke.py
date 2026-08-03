from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:3000"
SESSION_STORE = Path(r"C:\Users\madph\AppData\Local\hermes\workspace-sessions.json")
OUTPUT = Path(r"C:\Users\madph\Documents\Projects\hermes-workspace\memory\handoffs\swarm\qa-tank-track-api-smoke.json")
CANDIDATE_JOB_ID = "passive-snap-track-20260725"


def request(method: str, path: str, token: str | None = None, body: dict | None = None) -> dict:
    payload = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Cookie"] = f"claude-auth={token}"
    req = urllib.request.Request(BASE + path, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return {"status": response.status, "body": json.loads(raw)}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        return {"status": error.code, "body": parsed}


store = json.loads(SESSION_STORE.read_text(encoding="utf-8"))
valid = [(token, expiry) for token, expiry in store.get("tokens", {}).items() if expiry > time.time() * 1000]
if not valid:
    raise SystemExit("No unexpired Workspace session token is available")
token = max(valid, key=lambda item: item[1])[0]

results = {
    "schema": "qa.tank-track-api-smoke.v1",
    "base": BASE,
    "candidate_job_id": CANDIDATE_JOB_ID,
    "checks": {
        "unauthenticated_list": request("GET", "/api/print-jobs?pageSize=20"),
        "authenticated_list": request("GET", "/api/print-jobs?pageSize=20", token=token),
        "authenticated_candidate_lookup": request(
            "GET", f"/api/print-jobs?jobId={CANDIDATE_JOB_ID}", token=token
        ),
        "authenticated_candidate_route": request(
            "POST",
            "/api/conductor-spawn",
            token=token,
            body={"printJobId": CANDIDATE_JOB_ID, "maxParallel": 2},
        ),
    },
}
OUTPUT.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
print(json.dumps(results, indent=2))
