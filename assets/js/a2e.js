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

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ============================================
  // Firestore: mission guide (admin에서 저장한 값 표시)
  // ============================================

  function firebaseReady() {
    return typeof window.firebase !== "undefined" && window.APP && APP.firebase;
  }

  function guideCollectionName() {
    // config.js에서 바꾸고 싶으면 APP.ads.missionGuideCollection="mission_guides" 같은 식으로 넣어도 됨
    if (APP.ads && APP.ads.missionGuideCollection) return APP.ads.missionGuideCollection;
    if (APP.firestore && APP.firestore.missionGuides) return APP.firestore.missionGuides;
    return "mission_guides";
  }

  async function ensureFirebaseAnon() {
    if (!firebaseReady()) return false;
    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(APP.firebase);
      }
      const auth = firebase.auth();
      if (!auth.currentUser) {
        await auth.signInAnonymously();
      }
      return true;
    } catch (e) {
      console.warn("firebase anon auth failed:", e);
      return false;
    }
  }

  async function loadGuideFromFirestore(missionId) {
    if (!firebaseReady()) return null;
    const ok = await ensureFirebaseAnon();
    if (!ok) return null;

    try {
      const db = firebase.firestore();
      const doc = await db.collection(guideCollectionName()).doc(String(missionId)).get();
      if (!doc.exists) return null;

      const data = doc.data() || {};
      if (!data.guide) return null;
      return String(data.guide);
    } catch (e) {
      console.warn("loadGuideFromFirestore failed:", e);
      return null;
    }
  }

  async function applyGuidesToUI() {
    // 카드가 렌더된 후 호출되어야 함
    const missions = APP.missions || [];
    if (missions.length === 0) return;

    for (const ms of missions) {
      const el = document.getElementById(`guide_${ms.id}`);
      if (!el) continue;

      // Firestore 가이드가 있으면 우선 적용, 없으면 기존 config.js guide 유지
      const g = await loadGuideFromFirestore(ms.id);
      if (g) {
        el.innerHTML = escapeHtml(g).replaceAll("\n", "<br/>");
      } else {
        el.innerHTML = escapeHtml(ms.guide || "-").replaceAll("\n", "<br/>");
      }
    }
  }

  // ============================================
  // 기존 기능: 내 정보 로드
  // ============================================

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

  // ============================================
  // 기존 기능: 미션 렌더
  // ============================================

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
          <div id="guide_${ms.id}" style="margin-top:6px;">${escapeHtml(ms.guide || "-")}</div>
          <div style="margin-top:6px;">${escapeHtml(ms.proofExample || "-")}</div>
        </div>

        <div class="kv">
          <div class="k">미션 단가</div><div class="v" id="p_${ms.id}">-</div>
          <div class="k">요청시각</div><div class="v" id="r_${ms.id}">-</div>
          <div class="k">마지막처리</div><div class="v" id="l_${ms.id}">-</div>
        </div>

        <div class="sub">관리자 확인을 위해 작업한 url을 입력하세요</div>
        <textarea class="txt" id="proof_${ms.id}" placeholder="url을 붙여넣으세요"></textarea>

        <div class="row">
          <button class="btn" id="btnClaim_${ms.id}">청구하기</button>
          <button class="btn ghost" id="btnCancel_${ms.id}">청구취소</button>
        </div>
      `;
      wrap.appendChild(card);
    }
  }

  // ============================================
  // 기존 기능: 미션 상태/가격 갱신
  // ============================================

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

  // ============================================
  // 기존 기능: Join/Renew/Withdraw
  // ============================================

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
      await applyGuidesToUI(); // 가입 후에도 가이드 유지
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
      await applyGuidesToUI();
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
      await applyGuidesToUI();
    } catch (e) {
      toast(asUserMessage(e), "error", "출금 실패");
    }
  }

  // ============================================
  // 기존 기능: proof url netlify save 함수 (원본 유지)
  // ============================================

  async function saveProofUrlToNetlify({ proofHash, url, chainId, contract, owner, id, missionId, txHash }) {
    await fetch("/.netlify/functions/proof_save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proofHash,
        url,
        chainId,
        contract,
        owner,
        id,
        missionId,
        txHash
      })
    });
  }

  // ============================================
  // 기존 기능: 미션 버튼 바인딩 (claim/cancel)
  // ============================================

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

            // netlify 저장은 기존 흐름 유지(원하면 여기서 saveProofUrlToNetlify 호출 확장 가능)
            // 예: await saveProofUrlToNetlify({ proofHash: proof, url: txt, ... })

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

  // ============================================
  // 기존 기능: 지갑 연결 콜백
  // ============================================

  window.onWalletConnected = async function () {
    await loadMe();
    await refreshMissionStatuses();
    await applyGuidesToUI(); // 지갑 연결 후 가이드도 덮어쓰기
  };

  // ============================================
  // 초기 부팅
  // ============================================

  document.addEventListener("DOMContentLoaded", async () => {
    // 지갑 UI 요소 추가(헤더가 head.html에 있을 경우)
    const addrEl = document.getElementById("wallet-addr");
    if (addrEl && WALLET.address) addrEl.textContent = WALLET.address;

    await renderMissions();

    // 카드가 그려진 뒤에 Firestore 가이드 덮어쓰기
    await applyGuidesToUI();

    await bindMissionButtons();

    // 버튼 바인딩
    $("#btnJoin")?.addEventListener("click", onClickJoin);
    $("#btnRenew")?.addEventListener("click", onClickRenew);
    $("#btnWithdraw")?.addEventListener("click", onClickWithdraw);

    // 지갑이 이미 연결되어 있으면 즉시 로드
    if (WALLET.provider && WALLET.address) {
      await loadMe();
      await refreshMissionStatuses();
      await applyGuidesToUI();
    }
  });
})();
