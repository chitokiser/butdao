/* /assets/js/admin.js */
/* ethers v5 (UMD) */

(function () {
  // 여기는 기존에 잘 되던 주소/ABI 그대로 쓰세요
  // (사용자 첨부 코드 기준)
  const A2E_ADDR = "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3";

  const A2E_ABI = [
    "function staff(address) view returns (uint8)",
    "function adprice(uint256) view returns (uint256)",
    "function setAdPrice(uint256 missionId, uint256 v) external",

    "function pendingCount() view returns (uint256)",
    "function pendingAt(uint256 index) view returns (uint256 id, uint256 missionId, address owner, uint64 reqAt, bytes32 proof)",
    "function approveClaim(uint256 id, uint256 missionId) external",
    "function rejectClaim(uint256 id, uint256 missionId) external"
  ];

  const $ = (id) => document.getElementById(id);

  function setMsg(boxId, msg) {
    const el = $(boxId);
    if (!el) return;
    el.textContent = msg || "";
  }

  function fmtAddr(a) {
    if (!a) return "-";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function fmtTime(tsSec) {
    if (!tsSec || tsSec === 0) return "-";
    try {
      const d = new Date(Number(tsSec) * 1000);
      return d.toLocaleString();
    } catch (e) {
      return String(tsSec);
    }
  }

  async function getSignerSafe() {
    if (!window.ethereum) throw new Error("지갑 확장프로그램이 없습니다.");
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const me = await signer.getAddress();
    return { provider, signer, me };
  }

  async function getProviderAndAccount() {
    if (!window.ethereum) throw new Error("지갑 확장프로그램이 없습니다.");
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    const accounts = await provider.listAccounts();
    const me = accounts && accounts.length ? accounts[0] : null;
    return { provider, me };
  }

  async function loadStaffInfo(contract, me) {
    try {
      if (!me) {
        $("staffInfo").textContent = "staff: -";
        return 0;
      }
      const lv = await contract.staff(me);
      $("staffInfo").textContent = "staff: " + String(lv);
      return Number(lv);
    } catch (e) {
      $("staffInfo").textContent = "staff: -";
      return 0;
    }
  }

  async function loadCurPrice(contract) {
    try {
      const mid = Number($("missionId").value || "1");
      const p = await contract.adprice(mid);
      $("curPrice").textContent = "현재 단가: " + ethers.utils.formatUnits(p, 18) + " HEX";
    } catch (e) {
      $("curPrice").textContent = "현재 단가: -";
    }
  }

  async function onSetPrice() {
    setMsg("msgPrice", "");
    try {
      const { signer, me } = await getSignerSafe();
      const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgPrice", "접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      const missionId = Number($("missionId").value || "0");
      const priceStr = String($("missionPrice").value || "").trim();

      if (!missionId || missionId <= 0) throw new Error("missionId를 입력하세요.");
      if (!priceStr) throw new Error("price를 입력하세요.");

      const price = ethers.utils.parseUnits(priceStr, 18);
      const tx = await contract.setAdPrice(missionId, price);
      setMsg("msgPrice", "전송됨: " + tx.hash);

      await tx.wait();
      setMsg("msgPrice", "완료: 단가가 저장되었습니다.");
      await loadCurPrice(contract);
    } catch (e) {
      setMsg("msgPrice", e && e.message ? e.message : String(e));
    }
  }

  function renderPendingEmpty(msg) {
    const list = $("pendingList");
    list.innerHTML = "";
    const div = document.createElement("div");
    div.className = "item muted";
    div.textContent = msg || "pending 없음";
    list.appendChild(div);
  }

  async function fetchProofUrl(proofHash) {
    try {
      const r = await fetch(`/.netlify/functions/proof_get?proofHash=${encodeURIComponent(proofHash)}`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      const j = await r.json();
      if (j && j.ok && j.found && j.rec && j.rec.url) return String(j.rec.url);
      return "";
    } catch {
      return "";
    }
  }

  function safeLink(url) {
    // 기본 보안: http/https만 링크로 처리
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.toString();
    } catch {
      return "";
    }
  }

  async function renderPendingItems(items) {
    const list = $("pendingList");
    list.innerHTML = "";

    if (!items || items.length === 0) {
      renderPendingEmpty("pending 없음");
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

      const mid = document.createElement("div");
      mid.className = "muted";
      mid.style.marginTop = "6px";
      mid.innerHTML =
        "requestedAt: " + fmtTime(it.reqAt) + "<br/>" +
        "proof(hash): <span style='font-family:monospace; opacity:.9; word-break:break-all'>" + String(it.proof) + "</span><br/>" +
        "proof(url): <span id='url_" + it.id + "_" + it.missionId + "'>조회중...</span>";

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
      div.appendChild(mid);
      div.appendChild(actions);

      list.appendChild(div);

      // 여기서 Netlify DB에서 URL 찾아서 링크로 표시
      const urlSpan = document.getElementById("url_" + it.id + "_" + it.missionId);
      const url = await fetchProofUrl(String(it.proof));
      const safe = safeLink(url);

      if (!urlSpan) continue;

      if (safe) {
        urlSpan.innerHTML = `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
      } else if (url) {
        urlSpan.textContent = url; // 링크는 아니지만 원문 표시
      } else {
        urlSpan.textContent = "미등록(사용자가 url 저장 안함)";
      }
    }
  }

  async function refreshPending() {
    setMsg("msgPending", "");
    try {
      if (!window.ethereum) {
        renderPendingEmpty("지갑이 필요합니다.");
        return;
      }

      const { provider, me } = await getProviderAndAccount();
      const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, provider);

      if (!me) {
        renderPendingEmpty("지갑 연결 후 다시 시도하세요.");
        return;
      }

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
        renderPendingEmpty("pendingCount 조회 실패");
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
          const r = await contract.pendingAt(i, { from: me });
          const id = r.id ? r.id.toString() : (r[0] ? r[0].toString() : "0");
          const missionId = r.missionId ? r.missionId.toString() : (r[1] ? r[1].toString() : "0");
          const owner = r.owner || r[2];
          const reqAt = r.reqAt ? Number(r.reqAt) : Number(r[3] || 0);
          const proof = r.proof || r[4];

          items.push({
            id: Number(id),
            missionId: Number(missionId),
            owner,
            reqAt,
            proof
          });
        } catch (e) {
          setMsg("msgPending", "pendingAt(" + i + ") 조회 실패: " + (e?.message || String(e)));
          break;
        }
      }

      await renderPendingItems(items);
    } catch (e) {
      renderPendingEmpty("목록 로드 실패");
      setMsg("msgPending", e && e.message ? e.message : String(e));
    }
  }

  async function approveOne(id, missionId) {
    setMsg("msgPending", "");
    try {
      const { signer, me } = await getSignerSafe();
      const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgPending", "접근 불가: staff 레벨 5 이상");
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
      const { signer, me } = await getSignerSafe();
      const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgPending", "접근 불가: staff 레벨 5 이상");
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
    $("btnSetPrice")?.addEventListener("click", onSetPrice);
    $("btnRefresh")?.addEventListener("click", refreshPending);

    $("missionId")?.addEventListener("change", async () => {
      try {
        const { provider } = await getProviderAndAccount();
        const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, provider);
        await loadCurPrice(contract);
      } catch (e) {}
    });
  }

  async function boot() {
    bind();

    try {
      if (window.ethereum) {
        const { provider } = await getProviderAndAccount();
        const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, provider);
        await loadCurPrice(contract);
      }
    } catch (e) {}

    await refreshPending();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
