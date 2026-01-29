// /assets/js/admin.js
/* ethers v5 (UMD) + firebase compat (UMD) */

(function () {
  const $ = (id) => document.getElementById(id);

  // 하드코딩 금지: config.js의 단일 설정 소스 사용
  const getAddr = () =>
    window.APP && APP.contracts && APP.contracts.a2e ? APP.contracts.a2e : null;

  // 컨트랙트(a2e.sol)와 일치하는 최소 ABI (pendingCount / pendingAt / adprice)
  const A2E_ABI = [
    "function staff(address) view returns (uint8)",

    "function adprice(uint256) view returns (uint256)",
    "function setAdPrice(uint256 missionId, uint256 v) external",

    "function pendingCount() view returns (uint256)",
    "function pendingAt(uint256 index) view returns (uint256 id, uint256 missionId, address owner, uint64 reqAt, bytes32 proof)",

    "function approveClaim(uint256 id, uint256 missionId) external",
    "function rejectClaim(uint256 id, uint256 missionId) external",
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

  function normHash(h) {
    return String(h || "").trim().toLowerCase();
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
    if (!addr)
      throw new Error("APP.contracts.a2e 가 없습니다. config.js 로드 순서를 확인하세요.");
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
      const mid = Number(
        $("missionId") && $("missionId").value ? $("missionId").value : "1"
      );
      const p = await readContract.adprice(mid);
      if ($("curPrice"))
        $("curPrice").textContent =
          "현재 단가: " + ethers.utils.formatUnits(p, 18) + " HEX";
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

      const missionId = Number(
        $("missionId") && $("missionId").value ? $("missionId").value : "0"
      );
      const priceStr = String(
        $("missionPrice") && $("missionPrice").value ? $("missionPrice").value : ""
      ).trim();

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
    if (!list) return;
    list.innerHTML = "";
    const div = document.createElement("div");
    div.className = "item muted";
    div.textContent = msg || "pending 없음";
    list.appendChild(div);
  }

  // ─────────────────────────────────────────────
  // Firebase (Firestore) 연결: proofHash→url, ad_orders 목록, mission_guides
  // ─────────────────────────────────────────────

  let FB = { ok: false, db: null, auth: null };

  async function initFirebaseCompatIfPossible() {
    try {
      if (!window.firebase || !window.APP || !APP.firebase) return;

      // 이미 초기화되어 있으면 재사용
      if (firebase.apps && firebase.apps.length > 0) {
        FB.db = firebase.firestore();
        FB.auth = firebase.auth();
        FB.ok = true;
        return;
      }

      firebase.initializeApp(APP.firebase);
      FB.db = firebase.firestore();
      FB.auth = firebase.auth();
      FB.ok = true;
    } catch {
      FB.ok = false;
    }
  }

  async function ensureAnonAuth() {
    try {
      if (!FB.ok || !FB.auth) return;
      const u = FB.auth.currentUser;
      if (u) return;
      await FB.auth.signInAnonymously();
    } catch {
      // auth 실패해도 read가 열려 있으면 읽힐 수 있으니 조용히 무시
    }
  }

  function getProofCollection() {
    return APP.ads && APP.ads.proofCollection ? APP.ads.proofCollection : "proof_urls";
  }

  function getOrdersCollection() {
    return APP.ads && APP.ads.ordersCollection ? APP.ads.ordersCollection : "ad_orders";
  }

  function getMissionGuideCollection() {
    return APP.ads && APP.ads.missionGuideCollection
      ? APP.ads.missionGuideCollection
      : "mission_guides";
  }

  // proofHash -> url: Firestore에서 조회
  // 핵심 수정:
  // 1) docId(=proofHash lower)로 먼저 조회
  // 2) 없으면 where("proofHash"=="...")로 보조 조회
  async function fetchProofUrlFromFirestore(proofHash) {
    try {
      if (!FB.ok || !FB.db) return null;
      const col = getProofCollection();
      const key = normHash(proofHash);
      if (!key) return null;

      // 1) 문서ID 직접 조회(가장 확실)
      const d1 = await FB.db.collection(col).doc(key).get();
      if (d1.exists) {
        const v = d1.data() || {};
        if (v.url) return String(v.url);
      }

      // 2) 보조: proofHash 필드로 조회(혹시 docId와 다르게 저장된 경우)
      const snap = await FB.db
        .collection(col)
        .where("proofHash", "==", key)
        .limit(1)
        .get();

      if (!snap.empty) {
        const d = snap.docs[0].data() || {};
        return d.url ? String(d.url) : null;
      }

      // 3) 보조2: 원본 문자열 그대로도 한번(대소문자 섞여 저장된 경우)
      const snap2 = await FB.db
        .collection(col)
        .where("proofHash", "==", String(proofHash))
        .limit(1)
        .get();

      if (!snap2.empty) {
        const d = snap2.docs[0].data() || {};
        return d.url ? String(d.url) : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  // 로컬에서는 functions 호출을 안 해서 404 제거
  async function fetchProofUrl(proofHash) {
    const url1 = await fetchProofUrlFromFirestore(proofHash);
    if (url1) return url1;

    const hn = location.hostname;
    if (hn === "127.0.0.1" || hn === "localhost") return null;

    try {
      const r = await fetch(
        "/.netlify/functions/proof_get?proofHash=" + encodeURIComponent(proofHash)
      );
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.url ? String(j.url) : null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // mission guide 저장/불러오기
  // ─────────────────────────────────────────────

  async function loadMissionGuide(missionId) {
    try {
      if (!FB.ok || !FB.db) return null;
      const docId = String(missionId);
      const snap = await FB.db.collection(getMissionGuideCollection()).doc(docId).get();
      if (!snap.exists) return null;
      const d = snap.data() || {};
      return typeof d.guide === "string" ? d.guide : "";
    } catch {
      return null;
    }
  }

  async function onGuideLoad() {
    setMsg("msgGuide", "");
    try {
      const missionId = Number(
        $("missionId") && $("missionId").value ? $("missionId").value : "0"
      );
      if (!missionId || missionId <= 0) throw new Error("missionId를 입력하세요.");

      if (!FB.ok || !FB.db)
        throw new Error("Firebase 연결이 없습니다. admin.html에 firebase compat 스크립트를 추가하세요.");

      const guide = await loadMissionGuide(missionId);
      if ($("missionGuide")) $("missionGuide").value = guide != null ? guide : "";

      if ($("guideStatus"))
        $("guideStatus").textContent = guide == null ? "저장된 가이드 없음" : "가이드 로드됨";
    } catch (e) {
      setMsg("msgGuide", e && e.message ? e.message : String(e));
      if ($("guideStatus")) $("guideStatus").textContent = "로드 실패";
    }
  }

  async function onGuideSave() {
    setMsg("msgGuide", "");
    try {
      const { signer, me } = await getSignerAndMe();
      const contract = getContractWith(signer);

      const staffLv = await loadStaffInfo(contract, me);
      if (staffLv < 5) {
        setMsg("msgGuide", "접근 불가: staff 레벨이 5 이상이어야 합니다.");
        return;
      }

      const missionId = Number(
        $("missionId") && $("missionId").value ? $("missionId").value : "0"
      );
      if (!missionId || missionId <= 0) throw new Error("missionId를 입력하세요.");

      const guide = String(
        $("missionGuide") && $("missionGuide").value ? $("missionGuide").value : ""
      ).trim();
      if (!guide) throw new Error("가이드를 입력하세요.");

      if (!FB.ok || !FB.db)
        throw new Error("Firebase 연결이 없습니다. admin.html에 firebase compat 스크립트를 추가하세요.");

      // admin:true 포함(현재 rules가 이 방식이면 필요)
      await FB.db
        .collection(getMissionGuideCollection())
        .doc(String(missionId))
        .set(
          {
            admin: true,
            missionId,
            guide,
            updatedBy: me,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      if ($("guideStatus")) $("guideStatus").textContent = "저장됨";
      setMsg("msgGuide", "가이드 저장 완료");
    } catch (e) {
      setMsg("msgGuide", e && e.message ? e.message : String(e));
      if ($("guideStatus")) $("guideStatus").textContent = "저장 실패";
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

      // 핵심 수정: proofHash를 소문자로 정규화해서 조회(저장 docId와 일치)
      const proofKey = normHash(it.proof);

      fetchProofUrl(proofKey).then((url) => {
        if (url) {
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = url;
          link.style.pointerEvents = "auto";
        } else {
          link.textContent = "원문 URL 없음 (proof 저장 확인)";
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
          const r = await contract.pendingAt(i);
          items.push({
            id: Number(r.id || r[0]),
            missionId: Number(r.missionId || r[1]),
            owner: r.owner || r[2],
            reqAt: Number(r.reqAt || r[3] || 0),
            proof: r.proof || r[4],
          });
        } catch (e) {
          setMsg(
            "msgPending",
            "pendingAt(" + i + ") 조회 중 revert: " + (e && e.message ? e.message : String(e))
          );
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

  // ─────────────────────────────────────────────
  // 광고 주문 현황: Firestore에서 직접 읽기
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

  async function refreshOrders() {
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

      if (!FB.ok || !FB.db) {
        renderOrdersEmpty("Firebase 연결이 없습니다. admin.html에 firebase compat 스크립트를 추가하세요.");
        return;
      }

      renderOrdersEmpty("불러오는 중...");

      const snap = await FB.db
        .collection(getOrdersCollection())
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      if (snap.empty) {
        renderOrdersEmpty("주문 0개");
        return;
      }

      const list = $("ordersList");
      list.innerHTML = "";

      snap.forEach((docSnap) => {
        const o = docSnap.data() || {};
        const pay = o.payment || {};

        const createdAtISO =
          o.createdAt && typeof o.createdAt.toDate === "function"
            ? o.createdAt.toDate().toISOString()
            : null;

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
        line1.textContent = "주문ID: " + docSnap.id + " / 생성: " + fmtISO(createdAtISO);

        const line2 = document.createElement("div");
        line2.className = "muted";
        line2.style.marginTop = "6px";
        line2.textContent = "가격: " + (o.pricePaw != null ? String(o.pricePaw) : "-") + " HEX";

        const line3 = document.createElement("div");
        line3.className = "muted";
        line3.style.marginTop = "6px";
        line3.textContent = "결제자: " + (pay.payer ? fmtAddr(pay.payer) : "-");

        const explorer =
          window.APP && APP.chain && APP.chain.blockExplorer ? APP.chain.blockExplorer : "https://opbnbscan.com";
        const txUrl = pay.txUrl || (pay.txHash ? explorer + "/tx/" + pay.txHash : null);

        const line4 = document.createElement("div");
        line4.className = "muted";
        line4.style.marginTop = "6px";
        line4.textContent = "영수증: ";

        if (txUrl && pay.txHash) line4.appendChild(safeLink(txUrl, pay.txHash));
        else line4.appendChild(document.createTextNode("-"));

        const line5 = document.createElement("div");
        line5.className = "muted";
        line5.style.marginTop = "6px";
        line5.textContent = "연락처: " + (o.contact || "-");

        const line6 = document.createElement("div");
        line6.className = "muted";
        line6.style.marginTop = "6px";
        line6.textContent = "요청사항: " + (o.required || "-");

        const line7 = document.createElement("div");
        line7.className = "muted";
        line7.style.marginTop = "6px";
        line7.textContent = "참고링크: ";
        if (o.link) line7.appendChild(safeLink(o.link, o.link));
        else line7.appendChild(document.createTextNode("-"));

        const line8 = document.createElement("div");
        line8.className = "muted";
        line8.style.marginTop = "6px";
        line8.textContent = "메모: " + (o.memo || "-");

        div.appendChild(top);
        div.appendChild(line1);
        div.appendChild(line2);
        div.appendChild(line3);
        div.appendChild(line4);
        div.appendChild(line5);
        div.appendChild(line6);
        div.appendChild(line7);
        div.appendChild(line8);

        list.appendChild(div);
      });

      setOrdersMsg("주문 표시 완료");
    } catch (e) {
      renderOrdersEmpty("주문 로드 실패");
      setOrdersMsg(e && e.message ? e.message : String(e));
    }
  }

  function bind() {
    if ($("btnSetPrice")) $("btnSetPrice").addEventListener("click", onSetPrice);
    if ($("btnRefresh")) $("btnRefresh").addEventListener("click", refreshPending);

    if ($("btnOrdersRefresh")) $("btnOrdersRefresh").addEventListener("click", refreshOrders);

    // 가이드 버튼
    if ($("btnGuideLoad")) $("btnGuideLoad").addEventListener("click", onGuideLoad);
    if ($("btnGuideSave")) $("btnGuideSave").addEventListener("click", onGuideSave);

    // missionId 바뀌면: 단가 로드 + 가이드 로드
    if ($("missionId")) {
      $("missionId").addEventListener("change", async () => {
        try {
          const { signer } = await getSignerAndMe();
          const c = getContractWith(signer);
          await loadCurPrice(c);
        } catch {}

        try {
          await onGuideLoad();
        } catch {}
      });
    }
  }

  async function boot() {
    bind();

    await initFirebaseCompatIfPossible();
    await ensureAnonAuth();

    try {
      const { signer } = await getSignerAndMe();
      const c = getContractWith(signer);
      await loadCurPrice(c);
    } catch {}

    // 처음 진입 시 가이드도 한번 로드(미션ID 입력돼 있으면)
    try {
      await onGuideLoad();
    } catch {}

    await refreshPending();

    if ($("ordersList")) {
      try {
        await refreshOrders();
      } catch {}
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
