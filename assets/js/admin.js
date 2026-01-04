/* /assets/js/admin.js */
/* ethers v5 (UMD) */

(function () {
  const $ = (id) => document.getElementById(id);

  // 하드코딩 금지: config.js의 단일 설정 소스 사용
  const getAddr = () => (window.APP && APP.contracts && APP.contracts.a2e) ? APP.contracts.a2e : null;

  // 컨트랙트(a2e.sol)와 일치하는 최소 ABI (pendingCount / pendingAt / adprice)
  const A2E_ABI = [
    "function staff(address) view returns (uint8)",

    "function adprice(uint256) view returns (uint256)",
    "function setAdPrice(uint256 missionId, uint256 v) external",

    "function pendingCount() view returns (uint256)",
    "function pendingAt(uint256 index) view returns (uint256 id, uint256 missionId, address owner, uint64 reqAt, bytes32 proof)",

    "function approveClaim(uint256 id, uint256 missionId) external",
    "function rejectClaim(uint256 id, uint256 missionId) external"
  ];

  function setMsg(id, msg) {
    const el = $(id);
    if (el) el.textContent = msg || "";
  }

  function fmtAddr(a) {
    if (!a) return "-";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function fmtTime(tsSec) {
    if (!tsSec || Number(tsSec) === 0) return "-";
    try {
      return new Date(Number(tsSec) * 1000).toLocaleString();
    } catch {
      return String(tsSec);
    }
  }

  async function getProvider() {
    if (!window.ethereum) throw new Error("지갑 확장프로그램이 없습니다.");
    return new ethers.providers.Web3Provider(window.ethereum, "any");
  }

  async function getSignerAndMe() {
    const provider = await getProvider();
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const me = await signer.getAddress();
    return { provider, signer, me };
  }

  function getContractWith(signerOrProvider) {
    const addr = getAddr();
    if (!addr) throw new Error("APP.contracts.a2e 가 없습니다. config.js 로드 순서를 확인하세요.");
    return new ethers.Contract(addr, A2E_ABI, signerOrProvider);
  }

  async function loadStaffInfo(contract, me) {
    try {
      const lv = await contract.staff(me);
      if ($("staffInfo")) $("staffInfo").textContent = "staff: " + String(lv);
      return Number(lv);
    } catch (e) {
      if ($("staffInfo")) $("staffInfo").textContent = "staff: -";
      return 0;
    }
  }

  async function loadCurPrice(readContract) {
    try {
      const mid = Number(($("missionId") && $("missionId").value) ? $("missionId").value : "1");
      const p = await readContract.adprice(mid);
      if ($("curPrice")) $("curPrice").textContent = "현재 단가: " + ethers.utils.formatUnits(p, 18) + " HEX";
    } catch {
      if ($("curPrice")) $("curPrice").textContent = "현재 단가: -";
    }
  }

  async function onSetPrice() {
    setMsg("msgPrice", "");
    try {
      const { signer, me } = await getSignerAndMe();
      const contract = getContractWith(signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgPrice", "접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      const missionId = Number(($("missionId") && $("missionId").value) ? $("missionId").value : "0");
      const priceStr = String(($("missionPrice") && $("missionPrice").value) ? $("missionPrice").value : "").trim();

      if (!missionId || missionId <= 0) throw new Error("missionId를 입력하세요.");
      if (!priceStr) throw new Error("price를 입력하세요.");

      const price = ethers.utils.parseUnits(priceStr, 18);
      const tx = await contract.setAdPrice(missionId, price);
      setMsg("msgPrice", "전송됨: " + tx.hash);

      await tx.wait();
      setMsg("msgPrice", "완료: 단가가 저장되었습니다.");

      // 읽기 갱신
      await loadCurPrice(contract);
    } catch (e) {
      setMsg("msgPrice", e && e.message ? e.message : String(e));
    }
  }

  function renderPendingEmpty(msg) {
    const list = $("pendingList");
    if (!list) return;
    list.innerHTML = "";
    const div = document.createElement("div");
    div.className = "item muted";
    div.textContent = msg || "pending 없음";
    list.appendChild(div);
  }

  async function fetchProofUrl(proofHash) {
    // proofHash로 DB 조회해서 원문 URL을 가져옴 (Netlify function 필요)
    // 필요 함수: /.netlify/functions/proof_get?proofHash=0x...
    try {
      const r = await fetch("/.netlify/functions/proof_get?proofHash=" + encodeURIComponent(proofHash));
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.url ? String(j.url) : null;
    } catch {
      return null;
    }
  }

  function renderPendingItems(items) {
    const list = $("pendingList");
    if (!list) return;

    list.innerHTML = "";
    if (!items || items.length === 0) {
      renderPendingEmpty("pending 0개");
      return;
    }

    for (const it of items) {
      const div = document.createElement("div");
      div.className = "item";

      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      top.style.gap = "10px";
      top.style.flexWrap = "wrap";

      const left = document.createElement("div");
      left.style.fontWeight = "800";
      left.textContent = "id " + it.id + " / mission " + it.missionId;

      const right = document.createElement("div");
      right.className = "muted";
      right.textContent = fmtAddr(it.owner);

      top.appendChild(left);
      top.appendChild(right);

      const mid1 = document.createElement("div");
      mid1.className = "muted";
      mid1.style.marginTop = "6px";
      mid1.textContent = "requestedAt: " + fmtTime(it.reqAt);

      const mid2 = document.createElement("div");
      mid2.className = "muted";
      mid2.style.marginTop = "6px";
      mid2.textContent = "proof(hash): " + String(it.proof);

      const linkRow = document.createElement("div");
      linkRow.style.marginTop = "8px";

      const link = document.createElement("a");
      link.href = "#";
      link.textContent = "proof URL 불러오는 중...";
      link.style.pointerEvents = "none";
      linkRow.appendChild(link);

      // 비동기로 URL 조회해서 링크로 교체
      fetchProofUrl(String(it.proof)).then((url) => {
        if (url) {
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = url;
          link.style.pointerEvents = "auto";
        } else {
          link.textContent = "DB에 원문 URL이 없습니다 (proof_save 호출 여부 확인)";
        }
      });

      const actions = document.createElement("div");
      actions.className = "row";
      actions.style.marginTop = "10px";

      const b1 = document.createElement("button");
      b1.textContent = "승인";
      b1.onclick = () => approveOne(it.id, it.missionId);

      const b2 = document.createElement("button");
      b2.textContent = "거절";
      b2.onclick = () => rejectOne(it.id, it.missionId);

      actions.appendChild(b1);
      actions.appendChild(b2);

      div.appendChild(top);
      div.appendChild(mid1);
      div.appendChild(mid2);
      div.appendChild(linkRow);
      div.appendChild(actions);

      list.appendChild(div);
    }
  }

  async function refreshPending() {
    setMsg("msgPending", "");
    try {
      // onlyStaff(view) 때문에 “읽기”도 signer로 해야 안전합니다.
      const { signer, me } = await getSignerAndMe();
      const contract = getContractWith(signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        renderPendingEmpty("접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      let len = 0;
      try {
        const bn = await contract.pendingCount();
        len = Number(bn);
      } catch (e) {
        renderPendingEmpty("pendingCount 조회 실패: ABI/주소 확인");
        setMsg("msgPending", e && e.message ? e.message : String(e));
        return;
      }

      if (!len || len <= 0) {
        renderPendingEmpty("pending 0개");
        return;
      }

      const items = [];
      for (let i = 0; i < len; i++) {
        try {
          const r = await contract.pendingAt(i); // signer 기반이라 from=me로 잡힘
          items.push({
            id: Number(r.id || r[0]),
            missionId: Number(r.missionId || r[1]),
            owner: r.owner || r[2],
            reqAt: Number(r.reqAt || r[3] || 0),
            proof: r.proof || r[4]
          });
        } catch (e) {
          setMsg("msgPending", "pendingAt(" + i + ") 조회 중 revert: " + (e && e.message ? e.message : String(e)));
          break;
        }
      }

      renderPendingItems(items);
    } catch (e) {
      renderPendingEmpty("목록 로드 실패");
      setMsg("msgPending", e && e.message ? e.message : String(e));
    }
  }

  async function approveOne(id, missionId) {
    setMsg("msgPending", "");
    try {
      const { signer, me } = await getSignerAndMe();
      const contract = getContractWith(signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgPending", "접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      const tx = await contract.approveClaim(id, missionId);
      setMsg("msgPending", "승인 전송됨: " + tx.hash);
      await tx.wait();

      setMsg("msgPending", "승인 완료");
      await refreshPending();
    } catch (e) {
      setMsg("msgPending", e && e.message ? e.message : String(e));
    }
  }

  async function rejectOne(id, missionId) {
    setMsg("msgPending", "");
    try {
      const { signer, me } = await getSignerAndMe();
      const contract = getContractWith(signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgPending", "접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      const tx = await contract.rejectClaim(id, missionId);
      setMsg("msgPending", "거절 전송됨: " + tx.hash);
      await tx.wait();

      setMsg("msgPending", "거절 완료");
      await refreshPending();
    } catch (e) {
      setMsg("msgPending", e && e.message ? e.message : String(e));
    }
  }

  function bind() {
    if ($("btnSetPrice")) $("btnSetPrice").addEventListener("click", onSetPrice);
    if ($("btnRefresh")) $("btnRefresh").addEventListener("click", refreshPending);

    if ($("missionId")) {
      $("missionId").addEventListener("change", async () => {
        try {
          const { signer } = await getSignerAndMe();
          const c = getContractWith(signer);
          await loadCurPrice(c);
        } catch {}
      });
    }

    // ─────────────────────────────────────────────
    // [추가] 광고 주문 현황(영수증 포함)
    // ─────────────────────────────────────────────
    if ($("btnOrdersRefresh")) $("btnOrdersRefresh").addEventListener("click", refreshOrders);
  }

  // ─────────────────────────────────────────────
  // [추가] 광고 주문 현황(영수증 포함)
  // Netlify function: /.netlify/functions/ad_orders_list?limit=50
  // ─────────────────────────────────────────────

  function setOrdersMsg(msg) {
    const el = $("ordersMsg");
    if (el) el.textContent = msg || "";
  }

  function renderOrdersEmpty(msg) {
    const list = $("ordersList");
    if (!list) return;
    list.innerHTML = "";
    const div = document.createElement("div");
    div.className = "item muted";
    div.textContent = msg || "주문 없음";
    list.appendChild(div);
  }

  function fmtISO(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return String(iso);
    }
  }

  function safeLink(url, text) {
    if (!url) return "-";
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text || url;
    return a;
  }

  async function refreshOrders() {
    // staff 권한 체크: 기존 방식 그대로 signer로 확인
    setOrdersMsg("");
    try {
      const { signer, me } = await getSignerAndMe();
      const c = getContractWith(signer);
      const staffLv = await loadStaffInfo(c, me);

      if (staffLv < 5) {
        renderOrdersEmpty("접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      const limitSel = $("ordersLimit");
      const limit = Number(limitSel && limitSel.value ? limitSel.value : 50) || 50;

      renderOrdersEmpty("불러오는 중...");
      const r = await fetch("/.netlify/functions/ad_orders_list?limit=" + encodeURIComponent(String(limit)), {
        headers: { "Cache-Control": "no-cache" }
      });
      if (!r.ok) {
        renderOrdersEmpty("주문 조회 실패: " + r.status);
        return;
      }
      const j = await r.json();
      if (!j || !j.ok) {
        renderOrdersEmpty("주문 조회 실패: " + (j && j.error ? j.error : "unknown"));
        return;
      }

      const items = Array.isArray(j.items) ? j.items : [];
      if (items.length === 0) {
        renderOrdersEmpty("주문 0개");
        return;
      }

      const list = $("ordersList");
      list.innerHTML = "";

      for (const o of items) {
        const div = document.createElement("div");
        div.className = "item";

        const top = document.createElement("div");
        top.style.display = "flex";
        top.style.justifyContent = "space-between";
        top.style.gap = "10px";
        top.style.flexWrap = "wrap";

        const left = document.createElement("div");
        left.style.fontWeight = "800";
        left.textContent = (o.serviceName ? o.serviceName : "서비스") + " (#" + (o.serviceId ?? "-") + ")";

        const right = document.createElement("div");
        right.className = "muted";
        right.textContent = "status: " + (o.status || "-");

        top.appendChild(left);
        top.appendChild(right);

        const line1 = document.createElement("div");
        line1.className = "muted";
        line1.style.marginTop = "6px";
        line1.textContent = "주문ID: " + (o.docId || "-") + " / 생성: " + fmtISO(o.createdAt);

        const line2 = document.createElement("div");
        line2.className = "muted";
        line2.style.marginTop = "6px";
        line2.textContent = "가격: " + (o.pricePaw != null ? String(o.pricePaw) : "-") + " HEX";

        const pay = o.payment || {};
        const line3 = document.createElement("div");
        line3.className = "muted";
        line3.style.marginTop = "6px";
        line3.textContent = "결제자: " + (pay.payer ? fmtAddr(pay.payer) : "-");

        const line4 = document.createElement("div");
        line4.className = "muted";
        line4.style.marginTop = "6px";
        line4.textContent = "TX: ";

        if (pay.txUrl && pay.txHash) {
          line4.appendChild(safeLink(pay.txUrl, pay.txHash));
        } else if (pay.txHash) {
          // txUrl이 저장 안 된 과거 데이터 대비
          const explorer = (window.APP && APP.chain && APP.chain.blockExplorer) ? APP.chain.blockExplorer : "https://opbnbscan.com";
          line4.appendChild(safeLink(explorer + "/tx/" + pay.txHash, pay.txHash));
        } else {
          line4.appendChild(document.createTextNode("-"));
        }

        div.appendChild(top);
        div.appendChild(line1);
        div.appendChild(line2);
        div.appendChild(line3);
        div.appendChild(line4);

        list.appendChild(div);
      }

      setOrdersMsg("주문 " + items.length + "개 표시됨");
    } catch (e) {
      renderOrdersEmpty("주문 로드 실패");
      setOrdersMsg(e && e.message ? e.message : String(e));
    }
  }

  async function boot() {
    bind();
    try {
      const { signer } = await getSignerAndMe();
      const c = getContractWith(signer);
      await loadCurPrice(c);
    } catch {}
    await refreshPending();

    // 주문현황 섹션이 있으면 자동 1회 로드
    if ($("ordersList")) {
      try { await refreshOrders(); } catch {}
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
