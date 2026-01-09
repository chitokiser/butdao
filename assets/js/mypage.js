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

  // v6: bigint/number/string 어떤 게 와도 안전하게 Number로
  function toNum(x, fallback = 0) {
    try {
      if (typeof x === "bigint") return Number(x);
      if (typeof x === "number") return Number.isFinite(x) ? x : fallback;
      if (typeof x === "string") return Number(x);
      // ethers v5 BigNumber가 섞여 들어오는 경우 대비
      if (x && typeof x.toString === "function") return Number(x.toString());
      return fallback;
    } catch {
      return fallback;
    }
  }

  function fmtUnits(v, dec = 18, digits = 4) {
    try {
      // v6: ethers.formatUnits
      const s = ethers.formatUnits(v, dec);
      const n = Number(s);
      if (!Number.isFinite(n)) return String(s);
      return n.toLocaleString(undefined, { maximumFractionDigits: digits });
    } catch {
      try {
        if (v && typeof v.toString === "function") return v.toString();
      } catch {}
      return String(v);
    }
  }

  function fmtNum(v) {
    try {
      const n = toNum(v, NaN);
      if (Number.isFinite(n)) return n.toLocaleString();
      return String(v);
    } catch {
      return String(v);
    }
  }

  function fmtTime(sec) {
    const n = toNum(sec, 0);
    if (!n) return "-";
    return new Date(n * 1000).toLocaleString();
  }

  function badge(status) {
    if (status === 1) return `<span class="badge warn">심사중</span>`;
    if (status === 3) return `<span class="badge ok">승인완료</span>`;
    if (status === 2) return `<span class="badge bad">반려/취소</span>`;
    return `<span class="badge">미청구</span>`;
  }

  // 경험치 임계치(프론트 계산)
  function nextNeedExp(level) {
    const lv = Number(level || 0);
    if (lv <= 0) return 0;
    return lv * 64000;
  }

  function setXpBar(exp, needTotal) {
    const xpWrap = $("#xpWrap");
    const meExp = $("#meExp");
    const meNeedTotal = $("#meNeedTotal");
    const meNeedExp = $("#meNeedExp");
    const meExpPct = $("#meExpPct");
    const meExpFill = $("#meExpFill");
    const xpRuleHint = $("#xpRuleHint");

    if (!xpWrap || !meExp || !meNeedTotal || !meNeedExp || !meExpPct || !meExpFill) return;

    const need = toNum(needTotal, 0);
    const now = toNum(exp, 0);

    if (!need || need <= 0) {
      xpWrap.style.display = "none";
      return;
    }

    xpWrap.style.display = "";
    meExp.textContent = fmtNum(now);
    meNeedTotal.textContent = fmtNum(need);

    const left = Math.max(0, need - now);
    meNeedExp.textContent = fmtNum(left);

    const pctRaw = (now / need) * 100;
    const pctText = Math.max(0, Math.min(100, pctRaw)).toFixed(2);

    const pctForBar = now > 0 ? Math.max(1, pctRaw) : 0;
    const pctClamped = Math.max(0, Math.min(100, pctForBar));

    meExpPct.textContent = String(pctText);
    meExpFill.style.width = pctClamped + "%";

    if (xpRuleHint) xpRuleHint.textContent = "기준: 레벨 × 64,000";
  }

  let ME_CACHE = {
    idNum: 0,
    level: 0,
    exp: 0,
    need: 0,
    left: 0,
  };

  async function loadMe() {
    const meWallet = $("#meWallet");
    const meId = $("#meId");
    const meMento = $("#meMento");
    const meLevel = $("#meLevel");
    const meUntil = $("#meUntil");
    const mePay = $("#mePay");
    const meTotal = $("#meTotal");
    const goAdmin = $("#goAdmin");
    const levelUpHint = $("#levelUpHint");

    if (!window.WALLET || !WALLET.provider || !WALLET.address) return;

    meWallet.textContent = WALLET.address;
    const a2e = getA2E(WALLET.provider);

    const [id, staffLv] = await Promise.all([
      a2e.idOf(WALLET.address),
      a2e.staff(WALLET.address).catch(() => 0),
    ]);

    if (goAdmin && toNum(staffLv, 0) >= 5) goAdmin.style.display = "";

    // v6: id는 bigint (toNumber 없음)
    const idNum = toNum(id, 0);
    meId.textContent = String(idNum);

    if (idNum === 0) {
      meLevel.textContent = "미가입";
      meMento.textContent = "-";
      meUntil.textContent = "-";
      mePay.textContent = "-";
      meTotal.textContent = "-";
      setXpBar(0, 0);
      if (levelUpHint) levelUpHint.textContent = "";
      ME_CACHE = { idNum: 0, level: 0, exp: 0, need: 0, left: 0 };
      return;
    }

    const info = await a2e.myInfo(idNum);
    // info: owner, mento, level, exp, mypay, totalpay, memberUntil, blacklisted

    const level = toNum(info.level, 0);
    const exp = toNum(info.exp, 0);

    const need = nextNeedExp(level);
    const left = Math.max(0, need - exp);

    meMento.textContent = info.mento || "-";
    meLevel.textContent = String(level);

    meUntil.textContent = fmtTime(info.memberUntil);
    mePay.textContent = `${fmtUnits(info.mypay)} HEX`;
    meTotal.textContent = `${fmtUnits(info.totalpay)} HEX`;

    setXpBar(exp, need);

    ME_CACHE = { idNum, level, exp, need, left };

    if (levelUpHint) {
      if (need === 0) {
        levelUpHint.textContent = "";
      } else if (left > 0) {
        levelUpHint.textContent = `레벨업까지 남은 경험치: ${fmtNum(left)}`;
      } else {
        levelUpHint.textContent = `레벨업 조건 충족 (현재 컨트랙트에서는 관리자만 레벨 변경 가능)`;
      }
    }
  }

  async function renderMyMissions() {
    const grid = $("#myMissionGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!window.WALLET || !WALLET.provider || !WALLET.address) return;
    const a2e = getA2E(WALLET.provider);
    const id = await a2e.idOf(WALLET.address);
    const idNum = toNum(id, 0);
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
        document.getElementById(`b_${ms.id}`).innerHTML = badge(toNum(ci.status, 0));
        document.getElementById(`p_${ms.id}`).textContent = `${fmtUnits(ci.price_)} HEX`;
        document.getElementById(`r_${ms.id}`).textContent = toNum(ci.reqAt, 0) ? fmtTime(ci.reqAt) : "-";
        document.getElementById(`l_${ms.id}`).textContent = toNum(ci.lastAt, 0) ? fmtTime(ci.lastAt) : "-";
      } catch {
        document.getElementById(`b_${ms.id}`).innerHTML = `<span class="badge bad">조회 실패</span>`;
      }
    }
  }

  async function renderMyMentees() {
    const grid = $("#myMenteeGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!window.WALLET || !WALLET.provider || !WALLET.address) return;
    const a2e = getA2E(WALLET.provider);

    let nextId = 0;
    try {
      const bn = await a2e.nextId();
      nextId = toNum(bn, 0);
    } catch (e) {
      grid.innerHTML = `<div class="card"><div class="sub">멘티 목록 조회 실패 (nextId 조회 불가)</div></div>`;
      return;
    }

    const my = WALLET.address.toLowerCase();
    const mentees = [];

    for (let id = 1; id < nextId; id++) {
      try {
        const info = await a2e.myInfo(id);
        const owner = String(info.owner || "").toLowerCase();
        const mento = String(info.mento || "").toLowerCase();
        const level = toNum(info.level, 0);
        const exp = toNum(info.exp, 0);

        if (owner !== "0x0000000000000000000000000000000000000000" && mento === my && level > 0) {
          mentees.push({ id, owner: info.owner, level, exp });
        }
      } catch (e) {}
    }

    if (mentees.length === 0) {
      grid.innerHTML = `<div class="card"><div class="sub">멘티가 없습니다.</div></div>`;
      return;
    }

    for (const m of mentees) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="row" style="justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div class="title">ID ${m.id}</div>
          <div class="sub">${m.owner}</div>
        </div>
        <div class="kv">
          <div class="k">레벨</div><div class="v">${m.level}</div>
          <div class="k">Experience</div><div class="v">${fmtNum(m.exp)}</div>
        </div>
      `;
      grid.appendChild(card);
    }
  }

  async function onWithdraw() {
    try {
      if (!window.WALLET || !WALLET.signer) throw new Error("지갑을 연결해 주세요.");
      const a2e = getA2E(WALLET.signer);
      const id = await a2e.idOf(WALLET.address);
      const idNum = toNum(id, 0);
      if (idNum === 0) throw new Error("미가입입니다.");

      toast("출금 트랜잭션 전송...", "info");
      const tx = await a2e.withdraw(idNum);
      await tx.wait();

      toast("출금 완료", "ok");
      await walletRefreshHex?.();
      await loadMe();
      await renderMyMissions();
      await renderMyMentees();
    } catch (e) {
      toast(asUserMessage ? asUserMessage(e) : (e?.message || "출금 실패"), "error", "출금 실패");
    }
  }

  async function onLevelUpClick() {
    if (ME_CACHE.idNum === 0) {
      toast("미가입 상태입니다.", "error");
      return;
    }
    if (ME_CACHE.need === 0) {
      toast("레벨 정보가 없습니다.", "error");
      return;
    }
    if (ME_CACHE.left > 0) {
      toast(`레벨업까지 경험치가 부족합니다. 남은 경험치: ${fmtNum(ME_CACHE.left)}`, "info");
      return;
    }
    toast("레벨업 조건은 충족했습니다. 현재 컨트랙트에서는 관리자만 레벨 변경이 가능합니다.", "info");
  }

  window.onWalletConnected = async function () {
    await loadMe();
    await renderMyMissions();
    await renderMyMentees();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    $("#btnWithdraw")?.addEventListener("click", onWithdraw);
    $("#btnLevelUp")?.addEventListener("click", onLevelUpClick);

    if (window.WALLET && WALLET.provider && WALLET.address) {
      await loadMe();
      await renderMyMissions();
      await renderMyMentees();
    }
  });
})();
