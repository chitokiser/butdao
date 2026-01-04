// /assets/js/a2e.js
(function () {
  const $ = (s) => document.querySelector(s);

  function toast(msg, type = "info", title = "알림") {
    const box = $("#toast");
    const t = $("#toastTitle");
    const m = $("#toastMsg");
    if (!box || !t || !m) return;

    t.textContent = title;
    m.textContent = msg;

    box.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => box.classList.remove("show"), 4500);
  }
  window.uiToast = toast;

  function fmtUnits(v, dec = 18, digits = 4) {
    try {
      const s = ethers.utils.formatUnits(v, dec);
      return Number(s).toLocaleString(undefined, { maximumFractionDigits: digits });
    } catch {
      return String(v);
    }
  }

  function fmtTime(sec) {
    if (!sec) return "-";
    const d = new Date(Number(sec) * 1000);
    return d.toLocaleString();
  }

  function statusBadge(status) {
    // 0 none, 1 pending, 2 rejected/canceled, 3 approved
    if (status === 1) return `<span class="badge warn">심사중</span>`;
    if (status === 3) return `<span class="badge ok">승인완료</span>`;
    if (status === 2) return `<span class="badge bad">반려/취소</span>`;
    return `<span class="badge">미청구</span>`;
  }

  function getA2E(signerOrProvider) {
    return new ethers.Contract(APP.contracts.a2e, APP.a2eAbi, signerOrProvider);
  }

  async function loadMe() {
    const meWallet = $("#meWallet");
    const meId = $("#meId");
    const meLevel = $("#meLevel");
    const meUntil = $("#meUntil");
    const mePay = $("#mePay");
    const poolBal = $("#poolBal");
    const cfgPrice = $("#cfgPrice");
    const staffBadge = $("#staffBadge");

    if (!WALLET.provider || !WALLET.address) {
      meWallet.textContent = "-";
      meId.textContent = "-";
      return;
    }
    meWallet.textContent = WALLET.address;

    const a2eRead = getA2E(WALLET.provider);
    const [id, price, pool] = await Promise.all([
      a2eRead.idOf(WALLET.address),
      a2eRead.price(),
      a2eRead.contractHexBalance(),
    ]);

    cfgPrice.textContent = `회비: ${fmtUnits(price, 18, 4)} HEX`;

    const idNum = id.toNumber();
    meId.textContent = String(idNum);

    // staff?
    const lvl = await a2eRead.staff(WALLET.address).catch(() => 0);
    if (Number(lvl) >= 5) {
      staffBadge.style.display = "";
      staffBadge.textContent = `스태프(${lvl})`;
    } else {
      staffBadge.style.display = "none";
    }

    poolBal.textContent = `${fmtUnits(pool, 18, 4)} HEX`;

    if (idNum === 0) {
      meLevel.textContent = "미가입";
      meUntil.textContent = "-";
      mePay.textContent = "-";
      return;
    }

    const info = await a2eRead.myInfo(idNum);
    meLevel.textContent = String(info.level);
    meUntil.textContent = fmtTime(info.memberUntil);
    mePay.textContent = `${fmtUnits(info.mypay, 18, 4)} HEX`;
  }

  async function renderMissions() {
    const wrap = $("#missionGrid");
    if (!wrap) return;
    wrap.innerHTML = "";

    const missions = APP.missions || [];
    for (const ms of missions) {
      const card = document.createElement("div");
      card.className = "card mission";
      card.innerHTML = `
        <div class="row">
          <div class="meta">
            <span class="badge">#${ms.id}</span>
            <div class="title">${escapeHtml(ms.title || "미션")}</div>
          </div>
          <div class="meta" id="st_${ms.id}">
            <span class="badge">상태: -</span>
          </div>
        </div>

        <div class="desc">${escapeHtml(ms.desc || "")}</div>

        <div class="box">
          <div>가이드</div>
          <div style="margin-top:6px;">${escapeHtml(ms.guide || "-")}</div>
          <div style="margin-top:10px;">예시 proof 포맷</div>
          <div style="margin-top:6px;">${escapeHtml(ms.proofExample || "-")}</div>
        </div>

        <div class="kv">
          <div class="k">미션 단가</div><div class="v" id="p_${ms.id}">-</div>
          <div class="k">요청시각</div><div class="v" id="r_${ms.id}">-</div>
          <div class="k">마지막처리</div><div class="v" id="l_${ms.id}">-</div>
        </div>

        <div class="sub">proof 텍스트</div>
        <textarea class="txt" id="proof_${ms.id}" placeholder="proof 텍스트를 붙여넣으세요"></textarea>

        <div class="row">
          <button class="btn" id="btnClaim_${ms.id}">청구하기</button>
          <button class="btn ghost" id="btnCancel_${ms.id}">청구취소</button>
        </div>
      `;
      wrap.appendChild(card);
    }
  }

  async function refreshMissionStatuses() {
    if (!WALLET.provider || !WALLET.address) return;

    const a2e = getA2E(WALLET.provider);
    const id = await a2e.idOf(WALLET.address);
    const idNum = id.toNumber();

    // 가격 표시(가입 전에도 가능)
    for (const ms of APP.missions) {
      const pEl = document.getElementById(`p_${ms.id}`);
      try {
        const p = await a2e.adprice(ms.id);
        pEl.textContent = `${fmtUnits(p, 18, 4)} HEX`;
      } catch {
        pEl.textContent = "-";
      }
    }

    if (idNum === 0) {
      // 미가입이면 상태만 기본 표시
      for (const ms of APP.missions) {
        const st = document.getElementById(`st_${ms.id}`);
        if (st) st.innerHTML = `<span class="badge">미가입</span>`;
      }
      return;
    }

    for (const ms of APP.missions) {
      try {
        const ci = await a2e.claimInfo(idNum, ms.id);
        const status = Number(ci.status);
        const st = document.getElementById(`st_${ms.id}`);
        const r = document.getElementById(`r_${ms.id}`);
        const l = document.getElementById(`l_${ms.id}`);

        if (st) st.innerHTML = statusBadge(status);
        if (r) r.textContent = ci.reqAt && Number(ci.reqAt) > 0 ? fmtTime(ci.reqAt) : "-";
        if (l) l.textContent = ci.lastAt && Number(ci.lastAt) > 0 ? fmtTime(ci.lastAt) : "-";
      } catch (e) {
        const st = document.getElementById(`st_${ms.id}`);
        if (st) st.innerHTML = `<span class="badge bad">조회 실패</span>`;
      }
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function onClickJoin() {
    try {
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const mento = ($("#inpMento").value || "").trim();
      if (!ethers.utils.isAddress(mento)) throw new Error("멘토 주소가 올바르지 않습니다.");

      const a2e = getA2E(WALLET.signer);

      // join은 컨트랙트가 transferFrom을 하므로, HEX approve가 필요할 수 있음
      const hexAddr = await a2e.hexToken();
      const hex = new ethers.Contract(hexAddr, APP.erc20Abi, WALLET.signer);

      const price = await a2e.price();
      const allowance = await hex.allowance(WALLET.address, APP.contracts.a2e);
      if (allowance.lt(price)) {
        toast("회비 결제를 위해 HEX 승인(approve)이 필요합니다. 승인 진행합니다.", "info");
        const txa = await hex.approve(APP.contracts.a2e, ethers.constants.MaxUint256);
        await txa.wait();
      }

      toast("Join 트랜잭션 전송...", "info");
      const tx = await a2e.join(mento);
      await tx.wait();

      toast("가입 완료", "ok");
      await walletRefreshHex();
      await loadMe();
      await refreshMissionStatuses();
    } catch (e) {
      toast(asUserMessage(e), "error", "Join 실패");
    }
  }

  async function onClickRenew() {
    try {
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const months = Number(($("#inpMonths").value || "1").trim());
      if (!Number.isFinite(months) || months <= 0) throw new Error("개월 수가 올바르지 않습니다.");

      const a2e = getA2E(WALLET.signer);
      const id = await a2e.idOf(WALLET.address);
      const idNum = id.toNumber();
      if (idNum === 0) throw new Error("먼저 가입(Join)하세요.");

      const hexAddr = await a2e.hexToken();
      const hex = new ethers.Contract(hexAddr, APP.erc20Abi, WALLET.signer);

      const price = await a2e.price();
      const need = price.mul(months);

      const allowance = await hex.allowance(WALLET.address, APP.contracts.a2e);
      if (allowance.lt(need)) {
        toast("갱신 결제를 위해 HEX 승인(approve)이 필요합니다. 승인 진행합니다.", "info");
        const txa = await hex.approve(APP.contracts.a2e, ethers.constants.MaxUint256);
        await txa.wait();
      }

      toast("Renew 트랜잭션 전송...", "info");
      const tx = await a2e.renew(idNum, months);
      await tx.wait();

      toast("갱신 완료", "ok");
      await walletRefreshHex();
      await loadMe();
      await refreshMissionStatuses();
    } catch (e) {
      toast(asUserMessage(e), "error", "Renew 실패");
    }
  }

  async function onClickWithdraw() {
    try {
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const a2e = getA2E(WALLET.signer);
      const id = await a2e.idOf(WALLET.address);
      const idNum = id.toNumber();
      if (idNum === 0) throw new Error("미가입 상태입니다.");

      toast("Withdraw 트랜잭션 전송...", "info");
      const tx = await a2e.withdraw(idNum);
      await tx.wait();

      toast("출금 완료", "ok");
      await walletRefreshHex();
      await loadMe();
      await refreshMissionStatuses();
    } catch (e) {
      toast(asUserMessage(e), "error", "출금 실패");
    }
  }

  async function bindMissionButtons() {
    for (const ms of APP.missions) {
      const btnClaim = document.getElementById(`btnClaim_${ms.id}`);
      const btnCancel = document.getElementById(`btnCancel_${ms.id}`);

      if (btnClaim) {
        btnClaim.addEventListener("click", async () => {
          try {
            if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
            const a2e = getA2E(WALLET.signer);

            const id = await a2e.idOf(WALLET.address);
            const idNum = id.toNumber();
            if (idNum === 0) throw new Error("먼저 가입하세요.");

            const txt = (document.getElementById(`proof_${ms.id}`).value || "").trim();
            if (!txt) throw new Error("proof 텍스트를 입력하세요.");

            const proof = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txt));

            toast(`미션 #${ms.id} 청구 전송...`, "info");
            const tx = await a2e.claim(idNum, ms.id, proof);
            await tx.wait();

            toast("청구 완료: 심사중 표시됩니다.", "ok");
            await refreshMissionStatuses();
          } catch (e) {
            toast(asUserMessage(e), "error", "청구 실패");
          }
        });
      }

      if (btnCancel) {
        btnCancel.addEventListener("click", async () => {
          try {
            if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
            const a2e = getA2E(WALLET.signer);

            const id = await a2e.idOf(WALLET.address);
            const idNum = id.toNumber();
            if (idNum === 0) throw new Error("미가입 상태입니다.");

            toast(`미션 #${ms.id} 청구취소 전송...`, "info");
            const tx = await a2e.cancelClaim(idNum, ms.id);
            await tx.wait();

            toast("청구취소 완료", "ok");
            await refreshMissionStatuses();
          } catch (e) {
            toast(asUserMessage(e), "error", "취소 실패");
          }
        });
      }
    }
  }

  window.onWalletConnected = async function () {
    await loadMe();
    await refreshMissionStatuses();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    // 지갑 UI 요소 추가(헤더가 head.html에 있을 경우)
    const addrEl = document.getElementById("wallet-addr");
    if (addrEl && WALLET.address) addrEl.textContent = WALLET.address;

    await renderMissions();
    await bindMissionButtons();

    // 버튼 바인딩
    $("#btnJoin")?.addEventListener("click", onClickJoin);
    $("#btnRenew")?.addEventListener("click", onClickRenew);
    $("#btnWithdraw")?.addEventListener("click", onClickWithdraw);

    // 지갑이 이미 연결되어 있으면 즉시 로드
    if (WALLET.provider && WALLET.address) {
      await loadMe();
      await refreshMissionStatuses();
    }
  });
})();
