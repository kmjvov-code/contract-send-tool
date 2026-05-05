/* ═══════════════════════════════════════════════
   계약 위치 안내 발송툴 — script.js
   ═══════════════════════════════════════════════ */

'use strict';

// ── 앱 상태 ─────────────────────────────────────
const state = {
  photoImage:     null,   // Image 객체
  markerPos:      null,   // { x, y } — 캔버스 좌표
  managers:       [],
  currentManager: null,
  historyOpen:    false,
};


// ════════════════════════════════════════════════
//  렌더 함수
// ════════════════════════════════════════════════

/**
 * renderPhotoPreview()
 * 사진 미리보기 캔버스를 갱신한다.
 * 이미지가 없으면 플레이스홀더를 표시한다.
 */
function renderPhotoPreview() {
  const canvas      = document.getElementById('photoCanvas');
  const placeholder = document.getElementById('photoPlaceholder');
  const markerHint  = document.getElementById('markerHint');

  if (!state.photoImage) {
    canvas.style.display      = 'none';
    placeholder.style.display = 'flex';
    markerHint.style.display  = 'none';
    return;
  }

  placeholder.style.display = 'none';
  canvas.style.display      = 'block';
  markerHint.style.display  = 'flex';

  const wrap   = canvas.parentElement;
  const maxW   = wrap.clientWidth;
  const ratio  = state.photoImage.naturalHeight / state.photoImage.naturalWidth;

  canvas.width  = maxW;
  canvas.height = maxW * ratio;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(state.photoImage, 0, 0, canvas.width, canvas.height);

  if (state.markerPos) {
    renderContractMarker(ctx, canvas);
  }
}

/**
 * renderContractMarker()
 * 이미지 위에 "계약 ←" 표시를 그린다.
 * 이미지를 먼저 다시 그린 뒤 마커를 그린다.
 */
function renderContractMarker(ctx, canvas) {
  if (!state.photoImage || !state.markerPos) return;

  // ctx/canvas를 인자로 받지 않은 경우 직접 얻는다
  if (!ctx || !canvas) {
    canvas = document.getElementById('photoCanvas');
    ctx    = canvas.getContext('2d');
    ctx.drawImage(state.photoImage, 0, 0, canvas.width, canvas.height);
  }

  const { x, y } = state.markerPos;
  const fontSize  = Math.max(14, Math.round(canvas.width * 0.045));
  const text      = '계약';
  const pad       = Math.round(fontSize * 0.45);

  ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';

  const tw   = ctx.measureText(text).width;
  const boxW = tw + pad * 2;
  const boxH = fontSize + pad * 2;

  // 캔버스 경계 안으로 클램프
  const bx = Math.max(0, Math.min(canvas.width  - boxW, x - boxW / 2));
  const by = Math.max(0, Math.min(canvas.height - boxH, y - boxH / 2));

  // 배경 박스 — 계약 표시만 강조색 사용
  ctx.fillStyle = '#00A651';
  _roundRect(ctx, bx, by, boxW, boxH, 6);
  ctx.fill();

  // 텍스트
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, bx + pad, by + boxH / 2);
}

/**
 * renderMessagePreview()
 * 문자 미리보기 텍스트를 갱신한다.
 */
function renderMessagePreview() {
  const el = document.getElementById('messagePreview');
  const m  = state.currentManager;

  if (!m) {
    el.textContent = '담당자를 선택하면 문자 내용이 표시됩니다.';
    return;
  }

  el.textContent = [
    `안녕하세요, 고객님.`,
    `우성공원의 ${m.name}입니다.`,
    ``,
    `저희 우성공원을 선택해 주셔서 진심으로 감사드립니다.`,
    `금일 계약하신 상품 사진을 첨부하여 드리오니 확인 부탁드립니다.`,
    ``,
    `궁금하신 점이 있으시면 아래 연락처로 연락 부탁드립니다.`,
    `친절하게 안내드리겠습니다.`,
    ``,
    `[사무실] ${m.officePhone}`,
    `[휴대폰] ${m.mobilePhone}`,
  ].join('\n');
}

/**
 * renderHistoryList()
 * 발송 이력 목록을 렌더링한다.
 */
function renderHistoryList(history) {
  const el = document.getElementById('historyList');

  if (!history || history.length === 0) {
    el.innerHTML = '<p class="history-empty">발송 이력이 없습니다.</p>';
    return;
  }

  el.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-item-header">
        <span class="history-contract">#${_esc(item.contractNo)}</span>
        <span class="history-date">${_esc(item.date)}</span>
      </div>
      <div class="history-item-body">
        <span class="history-contractor">${_esc(item.contractor)}</span>
        <span class="history-manager">${_esc(item.manager)}</span>
      </div>
      <div class="history-item-footer">
        <span class="history-phone">${_esc(item.customerPhone)}</span>
        <span class="history-file">${_esc(item.filename)}</span>
      </div>
    </div>
  `).join('');
}

/**
 * updateScreen()
 * 각 렌더 함수를 호출해 전체 화면을 갱신한다.
 */
function updateScreen() {
  renderPhotoPreview();
  renderMessagePreview();
}


// ════════════════════════════════════════════════
//  이벤트 핸들러 — 로그인
// ════════════════════════════════════════════════

async function handleLogin() {
  const password = document.getElementById('loginPassword').value;
  const errorEl  = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  btn.disabled = true;
  errorEl.textContent = '';

  try {
    const res = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    });
    const result = await res.json();
    if (result.success) {
      window.location.reload();
    } else {
      errorEl.textContent = result.error || '비밀번호가 올바르지 않습니다.';
    }
  } catch (err) {
    errorEl.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
  } finally {
    btn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    window.location.reload();
  }
}


// ════════════════════════════════════════════════
//  이벤트 핸들러 — 메인 앱
// ════════════════════════════════════════════════

function handlePhotoFile(file) {
  if (!file) return;
  state.markerPos = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.photoImage = img;
      renderPhotoPreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleCanvasPointer(e) {
  if (!state.photoImage) return;
  e.preventDefault();

  const canvas = document.getElementById('photoCanvas');
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  const src = e.touches ? e.touches[0] : e;
  state.markerPos = {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };

  renderContractMarker();
}

function handleManagerChange(e) {
  const id = e.target.value;
  state.currentManager = state.managers.find(m => m.id === id) || null;

  const infoEl = document.getElementById('managerInfo');

  if (state.currentManager) {
    document.getElementById('managerName').textContent  = state.currentManager.name;
    document.getElementById('officePhone').textContent  = state.currentManager.officePhone;
    document.getElementById('mobilePhone').textContent  = state.currentManager.mobilePhone;
    infoEl.classList.add('visible');
  } else {
    infoEl.classList.remove('visible');
  }

  renderMessagePreview();
}

function handleHistoryToggle() {
  state.historyOpen = !state.historyOpen;
  document.getElementById('historyBody').classList.toggle('open', state.historyOpen);
  document.getElementById('historyToggleIcon').classList.toggle('open', state.historyOpen);
}

async function handleSend() {
  const contractNo    = document.getElementById('contractNo').value.trim();
  const contractor    = document.getElementById('contractor').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();

  if (!contractNo || !contractor || !customerPhone) {
    alert('계약번호, 계약자, 고객 연락처를 입력해주세요.');
    return;
  }
  if (!state.currentManager) {
    alert('담당자를 선택해주세요.');
    return;
  }
  if (!state.photoImage) {
    alert('사진을 등록해주세요.');
    return;
  }

  const canvas    = document.getElementById('photoCanvas');
  const imageData = canvas.toDataURL('image/jpeg', 0.92);

  const btn     = document.getElementById('sendBtn');
  const btnText = document.getElementById('sendBtnText');
  btn.disabled  = true;
  btnText.textContent = '저장 중...';

  try {
    const res = await fetch('/api/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contractNo,
        contractor,
        managerName:   state.currentManager.name,
        customerPhone,
        imageData,
      }),
    });

    const result = await res.json();

    if (result.success) {
      alert(`저장 완료!\n파일명: ${result.filename}`);
      await loadHistory();
      // 이력 섹션이 닫혀있으면 열기
      if (!state.historyOpen) handleHistoryToggle();
    } else {
      alert('저장 실패. 다시 시도해주세요.');
    }
  } catch (err) {
    console.error('[send error]', err);
    alert('오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    btn.disabled = false;
    btnText.textContent = '문자 보내기';
  }
}


// ════════════════════════════════════════════════
//  API
// ════════════════════════════════════════════════

async function loadManagers() {
  try {
    const res    = await fetch('/api/managers');
    state.managers = await res.json();
  } catch (err) {
    console.error('[loadManagers]', err);
  }
}

async function loadHistory() {
  try {
    const res     = await fetch('/api/history');
    const history = await res.json();
    renderHistoryList(history);
  } catch (err) {
    console.error('[loadHistory]', err);
  }
}


// ════════════════════════════════════════════════
//  유틸
// ════════════════════════════════════════════════

function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return d.slice(0,2) + '-' + d.slice(2);
    if (d.length <= 9) return d.slice(0,2) + '-' + d.slice(2,5) + '-' + d.slice(5);
    return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6,10);
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + '-' + d.slice(3);
  if (d.length <= 10) return d.slice(0,3) + '-' + d.slice(3,6) + '-' + d.slice(6);
  return d.slice(0,3) + '-' + d.slice(3,7) + '-' + d.slice(7,11);
}


// ════════════════════════════════════════════════
//  초기화
// ════════════════════════════════════════════════

function initLoginPage() {
  const loginBtn      = document.getElementById('loginBtn');
  const loginPassword = document.getElementById('loginPassword');

  loginBtn.addEventListener('click', handleLogin);
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

async function initMainApp() {
  await loadManagers();
  await loadHistory();

  // 사진 입력
  document.getElementById('cameraInput').addEventListener('change', e => {
    handlePhotoFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('galleryInput').addEventListener('change', e => {
    handlePhotoFile(e.target.files[0]);
    e.target.value = '';
  });

  // 캔버스 터치/클릭 — 계약 표시
  const canvas = document.getElementById('photoCanvas');
  canvas.addEventListener('click', handleCanvasPointer);
  canvas.addEventListener('touchstart', handleCanvasPointer, { passive: false });

  // 연락처 자동 하이픈
  document.getElementById('customerPhone').addEventListener('input', (e) => {
    const input = e.target;
    const formatted = formatPhone(input.value);
    const delta = formatted.length - input.value.length;
    const pos = input.selectionStart;
    input.value = formatted;
    if (delta !== 0) input.setSelectionRange(pos + delta, pos + delta);
  });

  // 담당자 선택
  document.getElementById('managerSelect').addEventListener('change', handleManagerChange);

  // 이력 토글
  document.getElementById('historyToggle').addEventListener('click', handleHistoryToggle);

  // 문자 보내기
  document.getElementById('sendBtn').addEventListener('click', handleSend);

  // 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  updateScreen();
}

async function init() {
  if (document.getElementById('loginBtn')) {
    initLoginPage();
  } else {
    await initMainApp();
  }
}

document.addEventListener('DOMContentLoaded', init);
