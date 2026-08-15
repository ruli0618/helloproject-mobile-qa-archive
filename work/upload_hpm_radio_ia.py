import json
import time
import sys
from pathlib import Path

import requests
import urllib3


_request = requests.sessions.Session.request
_send = requests.sessions.Session.send


def _patched_request(self, method, url, **kwargs):
    kwargs.setdefault("verify", False)
    return _request(self, method, url, **kwargs)


requests.sessions.Session.request = _patched_request


def _patched_send(self, request, **kwargs):
    kwargs.setdefault("verify", False)
    return _send(self, request, **kwargs)


requests.sessions.Session.send = _patched_send
urllib3.disable_warnings()

import internetarchive  # noqa: E402


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "outputs" / "helloproject-mobile-archive" / "helloproject-mobile.com" / "radio" / "radio_manifest.json"
RADIO_DIR = Path(r"C:\Users\misuz\Desktop\RADIO\ハロモバラジオ")

PROGRAM_IDS = {
    "オリジナル番組「かみこ日和」": "helloproject-mobile-radio-kamiko-biyori",
    "オリジナル番組「ふくむらの部屋」": "helloproject-mobile-radio-fukumura-no-heya",
    "オリジナル番組「みよちゃん家の縁側」": "helloproject-mobile-radio-miyochanchi-no-engawa",
    "オリジナル番組「やじまの部屋」": "helloproject-mobile-radio-yajima-no-heya",
    "オリジナル番組「ろこの部屋」": "helloproject-mobile-radio-roko-no-heya",
    "オリジナル番組「宣伝会議」": "helloproject-mobile-radio-senden-kaigi",
    "オリジナル番組「隣のやじまん家」": "helloproject-mobile-radio-tonari-no-yajimanchi",
}


def load_manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def program_rows(manifest, program):
    return [item for item in manifest["items"] if item["program"] == program]


def metadata(program, rows):
    size_gb = round(sum(item["size"] for item in rows) / 1024 / 1024 / 1024, 2)
    episodes = len({item["episode"] for item in rows if item["episode"]})
    return {
        "title": f"ハロモバラジオ - {program}",
        "mediatype": "audio",
        "collection": "opensource_audio",
        "creator": "Hello! Project Mobile",
        "language": "jpn",
        "subject": ["Hello! Project", "Hello Project Mobile", "radio", "Japanese idol"],
        "description": (
            "ハロー！プロジェクトモバイルで配信されていたラジオ音源の個人保存アーカイブです。"
            f"番組: {program} / ファイル数: {len(rows)} / 回数: {episodes} / 容量: {size_gb}GB"
        ),
    }


def check():
    session = internetarchive.get_session()
    print(json.dumps(session.whoami(), ensure_ascii=False, indent=2))


def upload_program(program):
    manifest = load_manifest()
    identifier = PROGRAM_IDS[program]
    rows = program_rows(manifest, program)
    item = internetarchive.get_item(identifier)
    existing = {file.get("name") for file in item.files}
    pending = [row for row in rows if row["file_name"] not in existing]
    print(json.dumps({
        "program": program,
        "identifier": identifier,
        "files": len(rows),
        "existing": len(existing),
        "pending": len(pending),
        "size_gb": round(sum(item["size"] for item in rows) / 1024 / 1024 / 1024, 2),
    }, ensure_ascii=False, indent=2))
    if not pending:
        return
    for index, row in enumerate(pending, start=1):
        file_path = str(RADIO_DIR / program / row["file_name"])
        while True:
            try:
                print(json.dumps({"uploading": row["file_name"], "progress": f"{index}/{len(pending)}"}, ensure_ascii=False))
                upload_metadata = metadata(program, rows) if index == 1 and not existing else None
                responses = internetarchive.upload(
                    identifier,
                    [file_path],
                    metadata=upload_metadata,
                    checksum=True,
                    retries=3,
                    verbose=True,
                    queue_derive=False,
                )
                for response in responses:
                    print(response.status_code, response.url)
                time.sleep(8)
                break
            except Exception as exc:
                message = str(exc)
                print(json.dumps({"retry_after_error": message[:500]}, ensure_ascii=False), file=sys.stderr)
                if "total_tasks_queued exceeds global_limit" in message or "Please reduce your request rate" in message:
                    time.sleep(900)
                    continue
                raise


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "check"
    if command == "check":
        check()
        return
    if command == "upload":
        program = sys.argv[2] if len(sys.argv) > 2 else ""
        programs = [program] if program else list(PROGRAM_IDS)
        for name in programs:
            upload_program(name)
        return
    print("usage: python work/upload_hpm_radio_ia.py check|upload [program name]")
    sys.exit(2)


if __name__ == "__main__":
    main()
