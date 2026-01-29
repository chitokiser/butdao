// /assets/js/a2e.js
// (ethers v6 compatible) + proof_urls Firestore save fixed

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

  function asUserMessage(e) {
    return (
      e?.reason ||
      e?.shortMessage ||
      e?.message ||
      (typeof e === "string" ? e : "") ||
      "실패"
    );
  }

  function fmtUnits(v, dec = 18, digits = 4) {
    try {
      const s = window.ethers.formatUnits(v, dec);
      return Number(s).toLocaleString(undefined, { maximumFractionDigits: digits });
    } catch {
      try { return String(v); } catch { return "-"; }
    }
  }

  function fmtTime(sec) {
    const n = Number(sec || 0);
    if (!n) return "-";
    const d = new Date(n * 1000);
    return d.toLocaleString();
  }

  function statusBadge(status) {
    if (status === 1) return `<span class="badge warn">심사중</span>`;
    if (status === 3) return `<span class="badge ok">승인완료</span>`;
    if (status === 2) return `<span class="badge bad">반려/취소</span>`;
    return `<span class="badge">미청구</span>`;
  }

  function getA2E(signerOrProvider) {
    return new window.ethers.Contract(APP.contracts.a2e, APP.a2eAbi, signerOrProvider);
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
  // Firebase
  // ============================================

  function firebaseReady() {
    return typeof window.firebase !== "undefined" && window.APP && APP.firebase;
  }

  function guideCollectionName() {
    if (APP.ads && APP.ads.missionGuideCollection) return APP.ads.missionGuideCollection;
    if (APP.firestore && APP.firestore.missionGuides) return APP.firestore.missionGuides;
    return "mission_guides";
  }

  function proofCollectionName() {
    if (APP.ads && APP.ads.proofCollection) return APP.ads.proofCollection;
    if (APP.firestore && APP.firestore.proofUrls) return APP.firestore.proofUrls;
    return "proof_urls";
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
    const missions = APP.missions || [];
    if (missions.length === 0) return;

    for (const ms of missions) {
      const el = document.getElementById(`guide_${ms.id}`);
      if (!el) continue;

      const g = await loadGuideFromFirestore(ms.id);
      if (g) el.innerHTML = escapeHtml(g).replaceAll("\n", "<br/>");
      else el.innerHTML = escapeHtml(ms.guide || "-").replaceAll("\n", "<br/>");
    }
  }

  // 증명 URL 저장 (핵심 수정: 익명로그인 보장 + 컬렉션명 + docId 통일)
  async function saveProofUrlToFirestore({ proofHash, url, chainId, contract, owner, id, missionId, txHash }) {
    if (!firebaseReady()) return false;

    const ok = await ensureFirebaseAnon();
    if (!ok) return false;

    try {
      const db = firebase.firestore();

      const ph = String(proofHash || "").toLowerCase();
      if (!ph || !ph.startsWith("0x") || ph.length !== 66) return false;

      const docId = ph; // docId = proofHash(0x..66)
      const ref = db.collection(proofCollectionName()).doc(docId);

      // 최초 1회만 생성
      const snap = await ref.get();
      if (snap.exists) return true;

      await ref.set(
        {
          proofHash: ph,
          url: String(url || ""),
          chainId: Number(chainId || 0),
          contract: String(contract || ""),
          owner: String(owner || ""),
          id: Number(id || 0),
          missionId: Number(missionId || 0),
          txHash: String(txHash || ""),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: false }
      );

      return true;
    } catch (e) {
      console.warn("saveProofUrlToFirestore failed:", e);
      return false;
    }
  }

  // ============================================
  // WALLET (v6)
  // ============================================

  window.WALLET = window.WALLET || {
    provider: null,
    signer: null,
    address: null,
    chainId: 0,
  };

  async function ensureWalletConnected() {
    if (!window.ethereum) throw new Error("MetaMask/Rabby 지갑이 필요합니다.");
    const ethers = window.ethers;

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const net = await provider.getNetwork();

    WALLET.provider = provider;
    WALLET.signer = signer;
    WALLET.address = address;
    WALLET.chainId = Number(net?.chainId || 0);

    return WALLET;
  }

  async function tryLoadConnectedAccount() {
    try {
      if (!window.ethereum) return null;
      const ethers = window.ethers;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
      const addr = accounts && accounts[0] ? accounts[0] : null;
      if (!addr) return null;

      const signer = await provider.getSigner();
      const net = await provider.getNetwork();

      WALLET.provider = provider;
      WALLET.signer = signer;
      WALLET.address = addr;
      WALLET.chainId = Number(net?.chainId || 0);
      return WALLET;
    } catch {
      return null;
    }
  }

  // ============================================
  // 내 정보 로드
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

    if (!meWallet || !meId || !meLevel || !meUntil || !mePay || !poolBal || !cfgPrice || !staffBadge) return;

    if (!WALLET.provider || !WALLET.address) {
      meWallet.textContent = "-";
      meId.textContent = "-";
      meLevel.textContent = "-";
      meUntil.textContent = "-";
      mePay.textContent = "-";
      poolBal.textContent = "-";
      return;
    }

    meWallet.textContent = WALLET.address;

    const a2eRead = getA2E(WALLET.provider);

    const [idRaw, price, pool] = await Promise.all([
      a2eRead.idOf(WALLET.address),
      a2eRead.price(),
      a2eRead.contractHexBalance(),
    ]);

    const idNum = Number(idRaw || 0);
    meId.textContent = String(idNum);

    cfgPrice.textContent = `회비: ${fmtUnits(price, 18, 4)} HEX`;
    poolBal.textContent = `${fmtUnits(pool, 18, 4)} HEX`;

    const lvlRaw = await a2eRead.staff(WALLET.address).catch(() => 0);
    const lvl = Number(lvlRaw || 0);
    if (lvl >= 5) {
      staffBadge.style.display = "";
      staffBadge.textContent = `스태프(${lvl})`;
    } else {
      staffBadge.style.display = "none";
    }

    if (idNum === 0) {
      meLevel.textContent = "미가입";
      meUntil.textContent = "-";
      mePay.textContent = "-";
      return;
    }

    const info = await a2eRead.myInfo(idNum);
    const level = Number(info?.level ?? info?.[2] ?? 0);
    const memberUntil = Number(info?.memberUntil ?? info?.[6] ?? 0);
    const mypay = info?.mypay ?? info?.[4] ?? 0;

    meLevel.textContent = String(level);
    meUntil.textContent = fmtTime(memberUntil);
    mePay.textContent = `${fmtUnits(mypay, 18, 4)} HEX`;
  }

  // ============================================
  // 미션 렌더
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
  // 미션 상태/가격 갱신
  // ============================================

  async function refreshMissionStatuses() {
    if (!WALLET.provider || !WALLET.address) return;

    const a2e = getA2E(WALLET.provider);
    const idRaw = await a2e.idOf(WALLET.address);
    const idNum = Number(idRaw || 0);

    for (const ms of APP.missions) {
      const pEl = document.getElementById(`p_${ms.id}`);
      if (!pEl) continue;

      try {
        const p = await a2e.adprice(ms.id);
        pEl.textContent = `${fmtUnits(p, 18, 4)} HEX`;
      } catch {
        pEl.textContent = "-";
      }
    }

    if (idNum === 0) {
      for (const ms of APP.missions) {
        const st = document.getElementById(`st_${ms.id}`);
        if (st) st.innerHTML = `<span class="badge">미가입</span>`;
      }
      return;
    }

    for (const ms of APP.missions) {
      try {
        const ci = await a2e.claimInfo(idNum, ms.id);
        const status = Number(ci?.status ?? ci?.[0] ?? 0);
        const reqAt = Number(ci?.reqAt ?? ci?.[1] ?? 0);
        const lastAt = Number(ci?.lastAt ?? ci?.[3] ?? 0);

        const st = document.getElementById(`st_${ms.id}`);
        const r = document.getElementById(`r_${ms.id}`);
        const l = document.getElementById(`l_${ms.id}`);

        if (st) st.innerHTML = statusBadge(status);
        if (r) r.textContent = reqAt > 0 ? fmtTime(reqAt) : "-";
        if (l) l.textContent = lastAt > 0 ? fmtTime(lastAt) : "-";
      } catch {
        const st = document.getElementById(`st_${ms.id}`);
        if (st) st.innerHTML = `<span class="badge bad">조회 실패</span>`;
      }
    }
  }

  // ============================================
  // Join/Renew/Withdraw
  // ============================================

  async function walletRefreshHex() {
    if (typeof window.walletRefreshHex === "function") return window.walletRefreshHex();
  }

  async function onClickJoin() {
    try {
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const mento = ($("#inpMento")?.value || "").trim();
      if (!window.ethers.isAddress(mento)) throw new Error("멘토 주소가 올바르지 않습니다.");

      const a2e = getA2E(WALLET.signer);

      const hexAddr = await a2e.hexToken();
      const hex = new window.ethers.Contract(hexAddr, APP.erc20Abi, WALLET.signer);

      const price = await a2e.price();
      const allowance = await hex.allowance(WALLET.address, APP.contracts.a2e);

      if (allowance < price) {
        toast("회비 결제를 위해 HEX 승인(approve)이 필요합니다. 승인 진행합니다.", "info");
        const txa = await hex.approve(APP.contracts.a2e, window.ethers.MaxUint256);
        await txa.wait();
      }

      toast("Join 트랜잭션 전송...", "info");
      const tx = await a2e.join(mento);
      await tx.wait();

      toast("가입 완료", "ok");
      await walletRefreshHex();
      await loadMe();
      await refreshMissionStatuses();
      await applyGuidesToUI();
    } catch (e) {
      toast(asUserMessage(e), "error", "Join 실패");
    }
  }

  async function onClickRenew() {
    try {
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const months = Number(($("#inpMonths")?.value || "1").trim());
      if (!Number.isFinite(months) || months <= 0) throw new Error("개월 수가 올바르지 않습니다.");

      const a2e = getA2E(WALLET.signer);
      const idRaw = await a2e.idOf(WALLET.address);
      const idNum = Number(idRaw || 0);
      if (idNum === 0) throw new Error("먼저 가입(Join)하세요.");

      const hexAddr = await a2e.hexToken();
      const hex = new window.ethers.Contract(hexAddr, APP.erc20Abi, WALLET.signer);

      const price = await a2e.price();
      const need = price * BigInt(months);

      const allowance = await hex.allowance(WALLET.address, APP.contracts.a2e);
      if (allowance < need) {
        toast("갱신 결제를 위해 HEX 승인(approve)이 필요합니다. 승인 진행합니다.", "info");
        const txa = await hex.approve(APP.contracts.a2e, window.ethers.MaxUint256);
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
      const idRaw = await a2e.idOf(WALLET.address);
      const idNum = Number(idRaw || 0);
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
  // netlify backup (옵션)
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
  // 미션 버튼 바인딩
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

            const idRaw = await a2e.idOf(WALLET.address);
            const idNum = Number(idRaw || 0);
            if (idNum === 0) throw new Error("먼저 가입하세요.");

            const txt = (document.getElementById(`proof_${ms.id}`)?.value || "").trim();
            if (!txt) throw new Error("증명 URL을 입력하세요.");

            // proofHash는 URL 원문을 해시
            const proof = window.ethers.keccak256(window.ethers.toUtf8Bytes(txt));

            toast(`미션 #${ms.id} 청구 전송...`, "info");
            const tx = await a2e.claim(idNum, ms.id, proof);
            await tx.wait();

            // Firestore 저장 (관리자 확인용)
            const chainId = Number(WALLET.chainId || 0);
            const ok = await saveProofUrlToFirestore({
              proofHash: proof,
              url: txt,
              chainId,
              contract: (APP && APP.contracts && APP.contracts.a2e) ? APP.contracts.a2e : "",
              owner: WALLET.address,
              id: idNum,
              missionId: ms.id,
              txHash: tx.hash
            });

            // 옵션: netlify에도 백업
            try {
              await saveProofUrlToNetlify({
                proofHash: proof,
                url: txt,
                chainId,
                contract: (APP && APP.contracts && APP.contracts.a2e) ? APP.contracts.a2e : "",
                owner: WALLET.address,
                id: idNum,
                missionId: ms.id,
                txHash: tx.hash
              });
            } catch {}

            if (!ok) {
              toast("청구는 완료됐지만 증명URL 저장이 실패했습니다. rules/auth를 확인하세요.", "error", "증명 저장 실패");
            } else {
              toast("청구 완료: 심사중 표시됩니다.", "ok");
            }

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

            const idRaw = await a2e.idOf(WALLET.address);
            const idNum = Number(idRaw || 0);
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
  // 외부 훅 유지
  // ============================================

  window.onWalletConnected = async function () {
    await loadMe();
    await refreshMissionStatuses();
    await applyGuidesToUI();
  };

  // ============================================
  // 부팅
  // ============================================

  document.addEventListener("DOMContentLoaded", async () => {
    await renderMissions();
    await applyGuidesToUI();
    await bindMissionButtons();

    $("#btnJoin")?.addEventListener("click", onClickJoin);
    $("#btnRenew")?.addEventListener("click", onClickRenew);
    $("#btnWithdraw")?.addEventListener("click", onClickWithdraw);

    await tryLoadConnectedAccount();
    if (WALLET.provider && WALLET.address) {
      await loadMe();
      await refreshMissionStatuses();
      await applyGuidesToUI();
    }

    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", async (accounts) => {
        const a = accounts && accounts[0] ? accounts[0] : null;
        if (!a) {
          WALLET.provider = null;
          WALLET.signer = null;
          WALLET.address = null;
          WALLET.chainId = 0;
          await loadMe();
          return;
        }
        await tryLoadConnectedAccount();
        await loadMe();
        await refreshMissionStatuses();
        await applyGuidesToUI();
      });

      window.ethereum.on("chainChanged", async () => {
        await tryLoadConnectedAccount();
        await loadMe();
        await refreshMissionStatuses();
        await applyGuidesToUI();
      });
    }
  });
})();
