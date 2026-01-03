// /assets/js/admin.js
(() => {
  const FN = "/.netlify/functions/a2e_pending";
  const A2E_ADDR = "0x29C82645A2299F460BB07A76ba0aF32349bEcB3c";

  // TODO: 실제 컨트랙트 승인 함수에 맞춰 ABI/함수명만 바꾸면 됨
  // 기본 가정: approve(id, missionId) 또는 resolveClaim(id, missionId)
  // 아래는 일단 resolveClaim(uint256,uint256)로 잡아둠
  const A2E_ABI = [
    "function resolveClaim(uint256 id, uint256 missionId) external",
  ];

  const $ = (id) => document.getElementById(id);

  function setMsg(id, text, type = "info") {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg " + type;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }

  async function api(action, params = {}) {
    const u = new URL(location.origin + FN);
    u.searchParams.set("action", action);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    const r = await fetch(u.toString(), { cache: "no-store" });
    return r.json();
  }

  let selected = null;

  function fillForm(item) {
    selected = item;
    $("inId").value = String(item.id ?? "");
    $("inMission").value = String(item.missionId ?? "");
    $("inProof").value = String(item.proof ?? "");
    setMsg("msg2", "선택됨: id=" + item.id + " / mission=" + item.missionId, "ok");
  }

  function render(items) {
    const wrap = $("pending-list");
    if (!wrap) return;

    if (!items || items.length === 0) {
      wrap.innerHTML = `<div class="empty">pending 없음</div>`;
      return;
    }

    wrap.innerHTML = items.map((it) => {
      const when = it.requestedAt ? new Date(it.requestedAt).toLocaleString() : "-";
      return `
        <div class="item" data-key="${esc(it.key)}">
          <div class="row">
            <div class="muted">id ${esc(it.id)} · mission ${esc(it.missionId)}</div>
            <button class="btn small secondary"
              data-act="select"
              data-id="${esc(it.id)}"
              data-mission="${esc(it.missionId)}"
              data-proof="${esc(it.proof)}"
              data-key="${esc(it.key)}"
            >선택</button>
          </div>
          <div class="kv">
            <div class="k">proof</div><div class="v">${esc(it.proof)}</div>
            <div class="k">tx</div><div class="v">${esc(it.tx)}</div>
            <div class="k">block</div><div class="v">${esc(it.blockNumber)}</div>
            <div class="k">time</div><div class="v">${esc(when)}</div>
          </div>
        </div>
      `;
    }).join("");

    wrap.querySelectorAll('button[data-act="select"]').forEach((b) => {
      b.addEventListener("click", () => {
        fillForm({
          key: b.getAttribute("data-key"),
          id: Number(b.getAttribute("data-id")),
          missionId: Number(b.getAttribute("data-mission")),
          proof: b.getAttribute("data-proof"),
        });
      });
    });
  }

  async function refresh() {
    const out = await api("list");
    if (!out.ok) {
      setMsg("msg", out.error || "list 실패", "err");
      return;
    }
    setMsg("msg", "pending " + out.count + "개", "ok");
    render(out.items);
  }

  async function sync() {
    setMsg("msg", "sync 중…", "info");
    const out = await api("sync");
    if (!out.ok) {
      setMsg("msg", out.error || "sync 실패", "err");
      return;
    }
    setMsg("msg", `sync 완료 (found ${out.found}, upserted ${out.upserted})`, "ok");
    await refresh();
  }

  async function delKey(key) {
    if (!key) return;
    await api("del", { key });
  }

  async function approveOnchain(id, missionId) {
    if (!window.ethereum) throw new Error("지갑이 없습니다.");
    if (!window.signer) throw new Error("지갑연결이 필요합니다.");

    const c = new ethers.Contract(A2E_ADDR, A2E_ABI, window.signer);
    const tx = await c.resolveClaim(id, missionId);
    return tx.wait();
  }

  $("btn-refresh")?.addEventListener("click", refresh);
  $("btn-sync")?.addEventListener("click", sync);

  $("btn-reject")?.addEventListener("click", async () => {
    try {
      const key = $("inId").value && $("inMission").value
        ? `${Number($("inId").value)}_${Number($("inMission").value)}`
        : (selected?.key || "");

      if (!key) return setMsg("msg2", "삭제할 key가 없습니다. 목록에서 선택하세요.", "err");

      setMsg("msg2", "삭제 중…", "info");
      await delKey(key);
      setMsg("msg2", "삭제 완료", "ok");
      selected = null;
      await refresh();
    } catch (e) {
      setMsg("msg2", e?.message || String(e), "err");
    }
  });

  $("btn-approve")?.addEventListener("click", async () => {
    try {
      const id = Number(($("inId").value || "").trim());
      const missionId = Number(($("inMission").value || "").trim());
      const key = selected?.key || `${id}_${missionId}`;

      if (!Number.isFinite(id) || !Number.isFinite(missionId)) {
        return setMsg("msg2", "id/missionId 값이 올바르지 않습니다.", "err");
      }

      setMsg("msg2", "승인 트랜잭션 전송…", "info");

      const rcpt = await approveOnchain(id, missionId);

      setMsg("msg2", "승인 완료: " + rcpt.transactionHash, "ok");

      // 승인 성공 → pending 삭제
      await delKey(key);

      selected = null;
      await refresh();
    } catch (e) {
      // 모바일 overflow 방지: 메시지는 이미 wrap 처리됨
      setMsg("msg2", e?.error?.message || e?.message || String(e), "err");
    }
  });

  // 최초 로딩: sync 1번 + 이후 refresh 주기
  window.addEventListener("load", async () => {
    await sync();
    setInterval(refresh, 15000);
  });
})();
