// /assets/js/admin.js
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
    const d = new Date(Number(sec) * 1000);
    return d.toLocaleString();
  }

  async function guardStaff() {
    if (!WALLET.provider || !WALLET.address) throw new Error("지갑을 연결해 주세요.");
    const a2e = getA2E(WALLET.provider);
    const lv = await a2e.staff(WALLET.address);
    if (Number(lv) < 5) throw new Error("스태프 권한이 필요합니다.(staff >= 5)");
  }

  async function loadCurrentMissionPrice() {
    try {
      await guardStaff();
      const a2e = getA2E(WALLET.provider);
      const mid = Number($("#mId").value || "1");
      const p = await a2e.adprice(mid);
      $("#curPrice").textContent = `현재 단가: ${fmtUnits(p)} HEX`;
    } catch (e) {
      $("#curPrice").textContent = "현재 단가: -";
    }
  }

  async function onSetAdPrice() {
    try {
      await guardStaff();
      if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");

      const mid = Number($("#mId").value || "0");
      const priceStr = String($("#mPrice").value || "").trim();
      if (!mid || mid <= 0) throw new Error("missionId가 올바르지 않습니다.");
      if (!priceStr) throw new Error("price를 입력하세요.");

      const v = ethers.utils.parseUnits(priceStr, 18);

      const a2e = getA2E(WALLET.signer);
      toast("setAdPrice 전송...", "info");
      const tx = await a2e.setAdPrice(mid, v);
      await tx.wait();

      toast("저장 완료", "ok");
      await loadCurrentMissionPrice();
    } catch (e) {
      toast(asUserMessage(e), "error", "저장 실패");
    }
  }

  async function renderPending() {
    const grid = $("#pendingGrid");
    grid.innerHTML = "";

    await guardStaff();

    const a2e = getA2E(WALLET.provider);
    const n = await a2e.pendingCount();
    const count = n.toNumber();

    if (count === 0) {
      grid.innerHTML = `<div class="sub">심사중 요청이 없습니다.</div>`;
      return;
    }

    // 최신이 뒤에 쌓이는 구조이므로 역순 렌더(최근 먼저)
    for (let i = count - 1; i >= 0; i--) {
      const item = await a2e.pendingAt(i);
      const id = item.id.toNumber();
      const missionId = item.missionId.toNumber();
      const owner = item.owner;
      const reqAt = item.reqAt ? Number(item.reqAt) : 0;
      const proof = item.proof;

      // 미션 단가/상태도 같이 확인
      let price = "0";
      let status = 0;
      try {
        const ci = await a2e.claimInfo(id, missionId);
        status = Number(ci.status);
        price = fmtUnits(ci.price_);
      } catch {}

      // pendingList엔 심사중만 들어오지만 안전상 status 확인
      if (status !== 1) continue;

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="row">
          <div class="title">ID ${id} · 미션 #${missionId}</div>
          <span class="badge warn">심사중</span>
        </div>

        <div class="kv">
          <div class="k">요청자</div><div class="v">${owner}</div>
          <div class="k">요청시각</div><div class="v">${reqAt ? fmtTime(reqAt) : "-"}</div>
          <div class="k">단가</div><div class="v">${price} HEX</div>
          <div class="k">proofHash</div><div class="v">${proof}</div>
        </div>

        <div class="row" style="margin-top:10px;">
          <button class="btn" data-act="approve" data-id="${id}" data-ms="${missionId}">승인</button>
          <button class="btn ghost" data-act="reject" data-id="${id}" data-ms="${missionId}">반려</button>
        </div>
      `;
      grid.appendChild(card);
    }

    // 버튼 핸들러
    grid.querySelectorAll("button[data-act]").forEach((b) => {
      b.addEventListener("click", async () => {
        const act = b.getAttribute("data-act");
        const id = Number(b.getAttribute("data-id"));
        const ms = Number(b.getAttribute("data-ms"));

        try {
          await guardStaff();
          if (!WALLET.signer) throw new Error("지갑을 연결해 주세요.");

          const a2eW = getA2E(WALLET.signer);
          toast(`${act === "approve" ? "승인" : "반려"} 전송...`, "info");

          const tx = act === "approve"
            ? await a2eW.approveClaim(id, ms)
            : await a2eW.rejectClaim(id, ms);

          await tx.wait();

          toast("처리 완료", "ok");
          await renderPending();
        } catch (e) {
          toast(asUserMessage(e), "error", "처리 실패");
        }
      });
    });
  }

  window.onWalletConnected = async function () {
    try {
      await guardStaff();
      await loadCurrentMissionPrice();
      await renderPending();
    } catch (e) {
      toast(asUserMessage(e), "error", "접근 불가");
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    $("#btnSetPrice")?.addEventListener("click", onSetAdPrice);
    $("#mId")?.addEventListener("change", loadCurrentMissionPrice);
    $("#btnRefresh")?.addEventListener("click", async () => {
      try {
        await renderPending();
      } catch (e) {
        toast(asUserMessage(e), "error");
      }
    });

    if (WALLET.provider && WALLET.address) {
      await window.onWalletConnected();
    }
  });
})();
