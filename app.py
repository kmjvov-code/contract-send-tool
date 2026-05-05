import os
import json
import logging
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import base64

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads', 'sent_photos')
app.secret_key = os.environ.get('SECRET_KEY', 'wooseong-park-dev-secret-2025')

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('data', exist_ok=True)

HISTORY_FILE = os.path.join('data', 'history.json')
APP_PASSWORD  = os.environ.get('APP_PASSWORD', '1234')

# ──────────────────────────────────────────────────────────────
#  담당자 목록 — 이름 / 사무실 / 휴대폰 직접 수정하세요
# ──────────────────────────────────────────────────────────────
MANAGERS = [
    {"id": "1", "name": "김현 이사", "officePhone": "054-933-4774", "mobilePhone": "010-7444-4444"},
    {"id": "2", "name": "이성규 상무", "officePhone": "054-933-4774", "mobilePhone": "010-9772-2556"},
    {"id": "3", "name": "이재민 소장", "officePhone": "054-933-4774", "mobilePhone": "010-2222-8621"},
    {"id": "4", "name": "진승현 프로", "officePhone": "054-933-4774", "mobilePhone": "010-5114-9890"},
    {"id": "4", "name": "우승협 프로", "officePhone": "054-933-4774", "mobilePhone": "010-4596-1121"},
]


# ── 접근 제어 ──────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            if request.is_json:
                return jsonify({"success": False, "error": "인증 필요"}), 401
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated


# ──────────────────────────────────────────────────────────────
#  MMS 발송 함수 (현재 Mock)
#  나중에 알리고 API 등으로 교체 시 이 함수만 수정하세요
# ──────────────────────────────────────────────────────────────
def send_mms(to_number: str, message: str, image_path: str) -> dict:
    logging.info("=" * 50)
    logging.info("[MMS MOCK] 발송 시뮬레이션")
    logging.info(f"  수신자  : {to_number}")
    logging.info(f"  이미지  : {image_path}")
    logging.info(f"  내용\n{message}")
    logging.info("=" * 50)
    return {"success": True, "mock": True}


# ── 이력 헬퍼 ──────────────────────────────────────────────────
def _load_history() -> list:
    if not os.path.exists(HISTORY_FILE):
        return []
    with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _append_history(record: dict) -> None:
    history = _load_history()
    history.insert(0, record)
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


# ── 라우트 ────────────────────────────────────────────────────
@app.route('/')
def index():
    logged_in = session.get('logged_in', False)
    return render_template('index.html', managers=MANAGERS, logged_in=logged_in)


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    if data and data.get('password') == APP_PASSWORD:
        session['logged_in'] = True
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "비밀번호가 올바르지 않습니다."}), 401


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"success": True})


@app.route('/api/managers')
@login_required
def api_managers():
    return jsonify(MANAGERS)


@app.route('/api/send', methods=['POST'])
@login_required
def api_send():
    data = request.get_json()
    contract_no    = data.get('contractNo', '').strip()
    contractor     = data.get('contractor', '').strip()
    manager_name   = data.get('managerName', '').strip()
    customer_phone = data.get('customerPhone', '').strip()
    image_data     = data.get('imageData', '')

    if not all([contract_no, contractor, manager_name, customer_phone]):
        return jsonify({"success": False, "error": "필수 항목 누락"}), 400

    # 파일 저장: #계약번호_계약자.jpg
    filename = f"#{contract_no}_{contractor}.jpg"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    if image_data:
        _, encoded = image_data.split(',', 1) if ',' in image_data else ('', image_data)
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(encoded))

    # 이력 저장
    _append_history({
        "contractNo":    contract_no,
        "contractor":    contractor,
        "manager":       manager_name,
        "customerPhone": customer_phone,
        "filename":      filename,
        "date":          datetime.now().strftime('%Y-%m-%d %H:%M'),
    })

    # MMS 발송 (mock)
    manager = next((m for m in MANAGERS if m['name'] == manager_name), None)
    if manager:
        msg = (
            f"안녕하세요, 고객님.\n"
            f"우성공원의 {manager_name}입니다.\n\n"
            f"저희 우성공원을 선택해 주셔서 진심으로 감사드립니다.\n"
            f"금일 계약하신 상품 사진을 첨부하여 드리오니 확인 부탁드립니다.\n\n"
            f"궁금하신 점이 있으시면 아래 연락처로 연락 부탁드립니다.\n"
            f"친절하게 안내드리겠습니다.\n\n"
            f"[사무실] {manager['officePhone']}\n"
            f"[휴대폰] {manager['mobilePhone']}"
        )
        send_mms(customer_phone, msg, filepath)

    return jsonify({"success": True, "filename": filename})


@app.route('/api/history')
@login_required
def api_history():
    return jsonify(_load_history())


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
