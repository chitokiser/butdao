// /assets/js/mypage.js
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

  function getA2E(x) {
    return new ethers.Contract(APP.contracts.a2e, APP.a2eAbi, x);
  }

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
    return new Date(Number(sec) * 1000).toLocaleString();
  }

  function badge(status) {
    if (status === 1) return `<span class="badge warn">심사중</span>`;
    if (status === 3) return `<span class="badge ok">승인완료</span>`;
    if (status === 2) return `<span class="badge bad">반려/취소</span>`;
    return `<span class="badge">미청구</span>`;
  }

  async function loadMe() {
    const meWallet = $("#meWallet");
    const meId = $("#meId");
    const meMento = $("#meMento");
    const meLevel = $("#meLevel");
    const meUntil = $("#meUntil");
    const mePay = $("#mePay");
    const meTotal = $("#meTotal");
    const goAdmin = $("#goAdmin");

    if (!WALLET.provider || !WALLET.address) return;

    meWallet.textContent = WALLET.address;
    const a2e = getA2E(WALLET.provider);

    const [id, staffLv] = await Promise.all([
      a2e.idOf(WALLET.address),
      a2e.staff(WALLET.address).catch(() => 0),
    ]);

    if (Number(staffLv) >= 5) goAdmin.style.display = "";

    const idNum = id.toNumber();
    meId.textContent = String(idNum);

    if (idNum === 0) {
      meLevel.textContent = "미가입";
      meMento.textContent = "-";
      meUntil.textContent = "-";
      mePay.textContent = "-";
      meTotal.textContent = "-";
      return;
    }

    const info = await a2e.myInfo(idNum);
    meMento.textContent = info.mento;
    meLevel.textContent = String(info.level);
    meUntil.textContent = fmtTime(info.memberUntil);
    mePay.textContent = `${fmtUnits(info.mypay)} HEX`;
    meTotal.textContent = `${fmtUnits(info.totalpay)} HEX`;
  }

  async function renderMyMissions() {
    const grid = $("#myMissionGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!WALLET.provider || !WALLET.address) return;
    const a2e = getA2E(WALLET.provider);
    const id = await a2e.idOf(WALLET.address);
    const idNum = id.toNumber();
    if (idNum === 0) return;

    for (const ms of APP.missions) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="row">
          <div class="title">#${ms.id} ${ms.title || "미션"}</div>
          <div id="b_${ms.id}"><span class="badge">-</span></div>
        </div>
        <div class="kv">
          <div class="k">단가</div><div class="v" id="p_${ms.id}">-</div>
          <div class="k">요청</div><div class="v" id="r_${ms.id}">-</div>
          <div class="k">처리</div><div class="v" id="l_${ms.id}">-</div>
        </div>
      `;
      grid.appendChild(card);

      try {
        const ci = await a2e.claimInfo(idNum, ms.id);
        document.getElementById(`b_${ms.id}`).innerHTML = badge(Number(ci.status));
        document.getElementById(`p_${ms.id}`).textContent = `${fmtUnits(ci.price_)} HEX`;
        document.getElementById(`r_${ms.id}`).textContent = ci.reqAt && Number(ci.reqAt) ? fmtTime(ci.reqAt) : "-";
        document.getElementById(`l_${ms.id}`).textContent = ci.lastAt && Number(ci.lastAt) ? fmtTime(ci.lastAt) : "-";
      } catch {
        document.getElementById(`b_${ms.id}`).innerHTML = `<span class="badge bad">조회 실패</span>`;
      }
    }
  }

  async function onWithdraw() {
    try {
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const a2e = getA2E(WALLET.signer);
      const id = await a2e.idOf(WALLET.address);
      const idNum = id.toNumber();
      if (idNum === 0) throw new Error("미가입입니다.");

      toast("출금 트랜잭션 전송...", "info");
      const tx = await a2e.withdraw(idNum);
      await tx.wait();

      toast("출금 완료", "ok");
      await walletRefreshHex();
      await loadMe();
      await renderMyMissions();
    } catch (e) {
      toast(asUserMessage(e), "error", "출금 실패");
    }
  }

  window.onWalletConnected = async function () {
    await loadMe();
    await renderMyMissions();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    $("#btnWithdraw")?.addEventListener("click", onWithdraw);

    if (WALLET.provider && WALLET.address) {
      await loadMe();
      await renderMyMissions();
    }
  });
})();
