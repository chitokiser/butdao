// /assets/js/mypage.js
(() => {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return (s || "").toString().replace(/[&<>"']/g, (m) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[m]));
  }

  function setMsg(kind, shortText, fullText) {
    const el = $("mp_msg");
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

  function setText(id, t) { const el = $(id); if (el) el.textContent = t ?? ""; }
  function setBlock(id, show) { const el = $(id); if (el) el.style.display = show ? "block" : "none"; }

  function missionCardAdmin(mid, priceWei) {
    const active = priceWei.gt(0);
    const state = active ? "활성" : "비활성";
    const badgeBg = active ? "rgba(0,255,0,0.10)" : "rgba(255,255,255,0.06)";
    const badgeBd = active ? "rgba(0,255,0,0.25)" : "rgba(255,255,255,0.12)";
    const badgeTx = active ? "rgba(180,255,180,0.95)" : "rgba(255,255,255,0.75)";

    const priceHex = window.A2E_ID.formatUnits(priceWei) + " HEX";

    return `
      <div style="border:1px solid #222;border-radius:14px;padding:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div style="font-size:16px;">미션 #${mid}</div>
          <div style="font-size:12px;padding:6px 10px;border-radius:999px;background:${badgeBg};border:1px solid ${badgeBd};color:${badgeTx};">
            ${state}
          </div>
        </div>
        <div style="margin-top:10px;padding:10px;border:1px solid #222;border-radius:12px;">
          <div style="font-size:12px;opacity:.8;">단가</div>
          <div style="font-size:16px;margin-top:6px;">${escapeHtml(priceHex)}</div>
        </div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn" data-fill="${mid}" style="min-width:180px;">상단 입력칸에 채우기</button>
        </div>
      </div>
    `;
  }

  async function loadMe() {
    const { account, contractRO } = await window.A2E_ID.getWeb3();

    setText("mp_me", account);

    const myId = await contractRO.idOf(account);
    setText("mp_myId", myId.toString());

    if (myId.eq(0)) {
      setText("mp_state", "아직 ID가 없습니다. a2e.html에서 가입하세요.");
      setText("mp_until", "-");
      setText("mp_mypay", "-");
      setText("mp_totalpay", "-");
      return { myId, account };
    }

    const info = await contractRO.myInfo(myId);

    setText("mp_until", window.A2E_ID.tsToLocal(info.memberUntil.toString()));
    setText("mp_mypay", window.A2E_ID.formatUnits(info.mypay) + " HEX");
    setText("mp_totalpay", window.A2E_ID.formatUnits(info.totalpay) + " HEX");

    const now = Math.floor(Date.now() / 1000);
    let state = "정상";
    if (info.blacklisted) state = "블랙리스트";
    else if (Number(info.memberUntil.toString()) < now) state = "회원권 만료(갱신 필요)";
    setText("mp_state", "owner=" + info.owner + " / 상태: " + state);

    return { myId, account };
  }

  async function renderAdminPanel(account) {
    const { contractRO } = await window.A2E_ID.getWeb3();
    const lvl = await contractRO.staff(account);
    setBlock("mp_adminPanel", Number(lvl) >= 5);
  }

  async function onRenew(myId) {
    try {
      const months = Number($("mp_months").value || "0");
      if (!months || months <= 0) throw new Error("개월 수 입력");

      const { contract, contractRO } = await window.A2E_ID.getWeb3();
      const price = await contractRO.price();
      const cost = price.mul(months);

      const r = await window.A2E_ID.ensureHexAllowance(cost);
      if (r.approved) setMsg("ok", "HEX approve 완료", r.txHash);

      const tx = await contract.payMembership(myId, months);
      setText("mp_renewHint", "갱신 트랜잭션: " + tx.hash);
      await tx.wait();

      setText("mp_renewHint", "갱신 완료");
      await loadMe();
      setMsg("ok", "갱신 완료", "");
    } catch (e) {
      setText("mp_renewHint", window.A2E_ID.explainEthersError(e));
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function onWithdraw(myId) {
    try {
      const { contract } = await window.A2E_ID.getWeb3();
      const tx = await contract.withdraw(myId);
      setText("mp_withdrawHint", "출금 트랜잭션: " + tx.hash);
      await tx.wait();

      setText("mp_withdrawHint", "출금 완료");
      await loadMe();
      setMsg("ok", "출금 완료", "");
    } catch (e) {
      setText("mp_withdrawHint", window.A2E_ID.explainEthersError(e));
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function adminView() {
    try {
      const id = Number($("ad_id").value || "0");
      const missionId = Number($("ad_missionId").value || "0");
      if (!id || !missionId) throw new Error("id / missionId 입력");

      const { contractRO } = await window.A2E_ID.getWeb3();
      const ci = await contractRO.claimInfo(id, missionId);
      const ui = await contractRO.myInfo(id);

      const lines = [];
      lines.push("id owner: " + ui.owner);
      lines.push("memberUntil: " + window.A2E_ID.tsToLocal(ui.memberUntil.toString()));
      lines.push("pending: " + ci.isPending);
      lines.push("requestedAt: " + window.A2E_ID.tsToLocal(ci.reqAt.toString()));
      lines.push("proof: " + ci.proof);
      lines.push("lastClaimAt: " + window.A2E_ID.tsToLocal(ci.lastAt.toString()));
      lines.push("adprice: " + window.A2E_ID.formatUnits(ci.price_.toString()) + " HEX");

      setText("ad_info", lines.join("\n"));
    } catch (e) {
      setText("ad_info", window.A2E_ID.explainEthersError(e));
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function adminResolve() {
    try {
      const id = Number($("ad_id").value || "0");
      const missionId = Number($("ad_missionId").value || "0");
      if (!id || !missionId) throw new Error("id / missionId 입력");

      const { contract } = await window.A2E_ID.getWeb3();
      const tx = await contract.resolveClaim(id, missionId);
      setText("ad_info", "승인 트랜잭션: " + tx.hash);
      await tx.wait();

      setText("ad_info", "승인 완료(출금 가능 포인트에 적립됨)");
      setMsg("ok", "승인 완료", "");
    } catch (e) {
      setText("ad_info", window.A2E_ID.explainEthersError(e));
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function onFlushFee() {
    try {
      const { contract } = await window.A2E_ID.getWeb3();
      const tx = await contract.flushFee();
      setText("fee_hint", "flushFee: " + tx.hash);
      await tx.wait();
      setText("fee_hint", "완료");
      setMsg("ok", "flushFee 완료", "");
    } catch (e) {
      setText("fee_hint", window.A2E_ID.explainEthersError(e));
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  async function renderAdminMissions() {
    const { contractRO } = await window.A2E_ID.getWeb3();
    const ids = window.A2E_MISSIONS.loadIds();

    const grid = $("adminMissionGrid");
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

    grid.innerHTML = prices.map(x => missionCardAdmin(x.id, x.p)).join("");

    grid.querySelectorAll("button[data-fill]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-fill");
        $("ad_setMissionId").value = id;
        $("ad_setMissionId").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  async function adminSetAdPrice(valueHex) {
    try {
      const missionId = Number($("ad_setMissionId").value || "0");
      if (!missionId) throw new Error("미션 ID 입력");

      const priceHex = (valueHex != null ? String(valueHex) : ($("ad_setPrice").value || "").trim());
      if (priceHex === "") throw new Error("단가(HEX) 입력");

      const priceWei = ethers.utils.parseUnits(priceHex, 18);

      const { contract } = await window.A2E_ID.getWeb3();
      const tx = await contract.setAdPrice(missionId, priceWei);

      setText("ad_priceHint", "저장 트랜잭션: " + tx.hash);
      await tx.wait();

      setText("ad_priceHint", "저장 완료. 미션 #" + missionId + " 단가 = " + priceHex + " HEX");
      setMsg("ok", "미션 단가 저장 완료", "");

      await renderAdminMissions();
    } catch (e) {
      setText("ad_priceHint", window.A2E_ID.explainEthersError(e));
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  }

  function addMissionToList() {
    const missionId = Number($("ad_setMissionId").value || "0");
    if (!missionId) {
      setMsg("err", "미션 ID를 먼저 입력하세요.", "");
      return;
    }
    window.A2E_MISSIONS.addId(missionId);
    setText("ad_priceHint", "목록에 추가됨(오프체인): " + missionId);
    renderAdminMissions();
  }

  function removeMissionFromList() {
    const missionId = Number($("ad_setMissionId").value || "0");
    if (!missionId) {
      setMsg("err", "미션 ID를 먼저 입력하세요.", "");
      return;
    }
    window.A2E_MISSIONS.removeId(missionId);
    setText("ad_priceHint", "목록에서 제거됨(오프체인): " + missionId);
    renderAdminMissions();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const { myId, account } = await loadMe();
      await renderAdminPanel(account);

      $("mp_renewBtn").addEventListener("click", () => onRenew(myId));
      $("mp_withdrawBtn").addEventListener("click", () => onWithdraw(myId));

      // admin actions
      const adminPanelVisible = $("mp_adminPanel").style.display !== "none";
      if (adminPanelVisible) {
        $("ad_viewBtn").addEventListener("click", adminView);
        $("ad_resolveBtn").addEventListener("click", adminResolve);
        $("btn_flushFee").addEventListener("click", onFlushFee);

        $("btn_reloadMissions").addEventListener("click", renderAdminMissions);
        $("ad_setPriceBtn").addEventListener("click", () => adminSetAdPrice(null));
        $("ad_disableBtn").addEventListener("click", () => adminSetAdPrice("0"));
        $("ad_addToListBtn").addEventListener("click", addMissionToList);
        $("ad_removeFromListBtn").addEventListener("click", removeMissionFromList);

        await renderAdminMissions();
      }
    } catch (e) {
      setMsg("err", window.A2E_ID.explainEthersError(e), e?.message || String(e));
    }
  });
})();
