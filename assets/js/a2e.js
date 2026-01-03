// /assets/js/a2e.js
(() => {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return (s || "").toString().replace(/[&<>"']/g, (m) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[m]));
  }

  function setMsg(kind, shortText, fullText) {
    const el = $("a2e_msg");
    if (!el) return;
    el.style.display = "block";
    el.classList.remove("msgbox--ok", "msgbox--err");
    el.classList.add(kind === "ok" ? "msgbox--ok" : "msgbox--err");

    const s = (shortText || "").toString();
    const f = (fullText || "").toString();

    if (f && f.length > 120 && f !== s) {
      el.innerHTML = `
        <div class="msg-title">${kind === "ok" ? "완료" : "오류"}</div>
        <div>${escapeHtml(s)}</div>
        <details>
          <summary>자세히 보기</summary>
          <div style="margin-top:8px;opacity:.9;">${escapeHtml(f)}</div>
        </details>
      `;
    } else {
      el.innerHTML = `
        <div class="msg-title">${kind === "ok" ? "완료" : "오류"}</div>
        <div>${escapeHtml(s || f || "")}</div>
      `;
    }
  }

  function badge(active) {
    const state = active ? "활성" : "비활성";
    const badgeBg = active ? "rgba(0,255,0,0.10)" : "rgba(255,255,255,0.06)";
    const badgeBd = active ? "rgba(0,255,0,0.25)" : "rgba(255,255,255,0.12)";
    const badgeTx = active ? "rgba(180,255,180,0.95)" : "rgba(255,255,255,0.75)";
    return `
      <div style="font-size:12px;padding:6px 10px;border-radius:999px;background:${badgeBg};border:1px solid ${badgeBd};color:${badgeTx};">
        ${state}
      </div>
    `;
  }

  function cardHtml({ id, priceHex, active }) {
    const meta = window.A2E_MISSIONS.getMeta(id);
    const guide = (meta.guide || []).map(x => `<li style="margin:4px 0;">${escapeHtml(x)}</li>`).join("");

    return `
      <div style="border:1px solid #222;border-radius:14px;padding:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <div style="font-size:16px;">미션 #${id} · ${escapeHtml(meta.title)}</div>
            <div style="margin-top:6px;font-size:13px;opacity:.85;line-height:1.5;">
              ${escapeHtml(meta.desc)}
            </div>
          </div>
          ${badge(active)}
        </div>

        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="padding:10px;border:1px solid #222;border-radius:12px;">
            <div style="font-size:12px;opacity:.8;">기본 보상(HEX)</div>
            <div style="font-size:16px;margin-top:6px;">${escapeHtml(priceHex)}</div>
          </div>

          <div style="padding:10px;border:1px solid #222;border-radius:12px;">
            <div style="font-size:12px;opacity:.8;">청구 입력</div>
            <button class="btn" data-fill="${id}" style="margin-top:8px;width:100%;">이 미션으로 청구 입력 채우기</button>
          </div>
        </div>

        <div style="margin-top:10px;padding:10px;border:1px solid #222;border-radius:12px;">
          <div style="font-size:12px;opacity:.8;margin-bottom:6px;">가이드</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;opacity:.9;line-height:1.55;">
            ${guide || `<li style="margin:4px 0;">가이드가 없습니다.</li>`}
          </ul>
        </div>

        <div style="margin-top:10px;padding:10px;border:1px solid #222;border-radius:12px;">
          <div style="font-size:12px;opacity:.8;margin-bottom:6px;">예시 proof 포맷</div>
          <div style="font-size:13px;opacity:.95;white-space:pre-wrap;overflow-wrap:anywhere;">
            ${escapeHtml(meta.proofExample || "예) URL 또는 식별값")}
          </div>
          <div style="margin-top:6px;font-size:12px;opacity:.75;">
            입력한 proof는 프론트에서 해시(bytes32)로 변환되어 온체인에 저장됩니다.
          </div>
        </div>
      </div>
    `;
  }

  async function renderTop() {
    const { account, contractRO } = await window.A2E_ID.getWeb3();

    $("a2e_me").textContent = account;

    const myId = await contractRO.idOf(account);
    $("a2e_myId").textContent = myId.toString();

    const price = await contractRO.price();
    const feeAcc = await contractRO.feeAcc();
    const feeTh = await contractRO.feeThreshold();

    $("a2e_price").textContent = window.A2E_ID.formatUnits(price) + " HEX";
    $("a2e_feeAcc").textContent = window.A2E_ID.formatUnits(feeAcc) + " HEX";
    $("a2e_feeTh").textContent = window.A2E_ID.formatUnits(feeTh) + " HEX";

    if (myId.gt(0)) {
      const info = await contractRO.myInfo(myId);
      $("a2e_until").textContent = window.A2E_ID.tsToLocal(info.memberUntil.toString());
      $("a2e_joinBtn").disabled = true;
      $("a2e_joinHint").textContent = "이미 가입된 계정입니다. 갱신은 마이페이지에서 진행하세요.";
    } else {
      $("a2e_until").textContent = "-";
      $("a2e_joinBtn").disabled = false;
      $("a2e_joinHint").textContent = "가입 시 HEX approve가 필요합니다. 버튼을 누르면 자동 승인(approve)을 시도합니다.";
    }
  }

  async function renderMissions() {
    const { contractRO } = await window.A2E_ID.getWeb3();
    const ids = window.A2E_MISSIONS.loadIds();

    const grid = $("missionGrid");
    grid.innerHTML = "";

    const prices = await Promise.all(ids.map(async (mid) => {
      try {
        const p = await contractRO.adprice(mid);
        return { id: mid, p };
      } catch {
        return { id: mid, p: ethers.constants.Zero };
      }
    }));

    prices.sort((a, b) => {
      const aa = a.p.gt(0) ? 0 : 1;
      const bb = b.p.gt(0) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return a.id - b.id;
    });

    grid.innerHTML = prices.map(x => {
      const priceHex = window.A2E_ID.formatUnits(x.p) + " HEX";
      return cardHtml({ id: x.id, priceHex, active: x.p.gt(0) });
    }).join("");

    grid.querySelectorAll("button[data-fill]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fill");
        $("claim_missionId").value = id;
        $("claim_missionId").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  async function onJoin() {
    try {
      const { contract, contractRO } = await window.A2E_ID.getWeb3();
      const price = await contractRO.price();

      const r = await window.A2E_ID.ensureHexAllowance(price);
      if (r.approved) setMsg("ok", "HEX approve 완료", r.txHash);

      const mentorInput = ($("a2e_mentor").value || "").trim();
      const mento = mentorInput === "" ? ethers.constants.AddressZero : mentorInput;

      const tx = await contract.join(mento);
      setMsg("ok", "가입 트랜잭션 전송됨", tx.hash);
      await tx.wait();

      setMsg("ok", "가입 완료", "");
      await renderTop();
    } catch (e) {
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function onClaim() {
    try {
      const { account, contract, contractRO } = await window.A2E_ID.getWeb3();
      const myId = await contractRO.idOf(account);
      if (myId.eq(0)) throw new Error("먼저 가입(Join)해야 합니다.");

      const missionId = Number($("claim_missionId").value || "0");
      if (!missionId) throw new Error("미션 ID를 입력하세요.");

      const proof = window.A2E_ID.toBytes32Proof($("claim_proof").value || "");

      const tx = await contract.claim(myId, missionId, proof);
      $("claim_hint").textContent = "청구 전송: " + tx.hash + "\nproof=" + proof;
      await tx.wait();
      $("claim_hint").textContent = "청구 완료(대기). 관리자가 승인하면 출금 가능 포인트로 적립됩니다.";
    } catch (e) {
      $("claim_hint").textContent = window.A2E_ID.explainEthersError(e);
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function onCancelClaim() {
    try {
      const { account, contract, contractRO } = await window.A2E_ID.getWeb3();
      const myId = await contractRO.idOf(account);
      if (myId.eq(0)) throw new Error("먼저 가입(Join)해야 합니다.");

      const missionId = Number($("claim_missionId").value || "0");
      if (!missionId) throw new Error("미션 ID를 입력하세요.");

      const tx = await contract.cancelClaim(myId, missionId);
      $("claim_hint").textContent = "청구 취소 전송: " + tx.hash;
      await tx.wait();
      $("claim_hint").textContent = "취소 완료";
    } catch (e) {
      $("claim_hint").textContent = window.A2E_ID.explainEthersError(e);
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await renderTop();
      await renderMissions();

      $("a2e_joinBtn").addEventListener("click", onJoin);
      $("btn_claim").addEventListener("click", onClaim);
      $("btn_cancelClaim").addEventListener("click", onCancelClaim);
      $("a2e_refreshMissions").addEventListener("click", renderMissions);
    } catch (e) {
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  });
})();
