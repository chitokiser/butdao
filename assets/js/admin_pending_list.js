// assets/js/admin_pending_list.js
const FN_BASE = "/.netlify/functions/a2e_pending";

function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function setMsg(text, type = "info") {
  const box = $("msg");
  if (!box) return;
  box.textContent = text || "";
  box.className = `msg ${type}`;
}

async function api(action) {
  const r = await fetch(`${FN_BASE}?action=${action}`, { cache: "no-store" });
  return r.json();
}

function render(items) {
  const wrap = $("pending-list");
  if (!wrap) return;

  if (!items?.length) {
    wrap.innerHTML = `<div class="empty">pending 없음</div>`;
    return;
  }

  wrap.innerHTML = items.map((it) => {
    return `
      <div class="card">
        <div class="row">
          <div class="pill">mission ${esc(it.missionId)}</div>
          <div class="muted">block ${esc(it.blockNumber)}</div>
        </div>
        <div class="addr">${esc(it.user)}</div>
        <div class="muted">proof: ${esc(it.proof)}</div>
        <div class="muted">tx: ${esc(it.tx)}</div>
        <div class="actions">
          <button class="btn" data-user="${esc(it.user)}" data-mission="${esc(it.missionId)}">승인(온체인)</button>
        </div>
      </div>
    `;
  }).join("");

  // 승인 버튼 이벤트(여기서는 클릭만 잡아두고, 실제 온체인 승인 함수는 당신 ABI에 맞춰 연결)
  wrap.querySelectorAll("button[data-user]").forEach((b) => {
    b.addEventListener("click", () => {
      const user = b.getAttribute("data-user");
      const missionId = Number(b.getAttribute("data-mission"));
      alert(`승인 처리 연결: user=${user}, missionId=${missionId}\n여기서 resolveClaim 호출을 ABI에 맞춰 붙이면 됩니다.`);
    });
  });
}

async function refreshList() {
  const out = await api("list");
  if (!out.ok) {
    setMsg(out.error || "list 실패", "err");
    return;
  }
  setMsg(`pending ${out.count}개`, "ok");
  render(out.items);
}

async function syncOnce() {
  setMsg("sync 중...", "info");
  const out = await api("sync");
  if (!out.ok) {
    setMsg(out.error || "sync 실패", "err");
    return;
  }
  setMsg(`sync 완료 (upserted ${out.upserted})`, "ok");
  await refreshList();
}

window.addEventListener("load", async () => {
  // 최초 1회 sync 후 목록
  await syncOnce();

  // 이후에는 list만 주기적으로 갱신(가벼움)
  setInterval(refreshList, 15000);

  const btn = $("btn-sync");
  if (btn) btn.addEventListener("click", syncOnce);
});
