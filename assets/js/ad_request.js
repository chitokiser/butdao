// /assets/js/ad_request.js
/* ethers v6 (UMD) + firebase compat */

(function () {
  const $ = (id) => document.getElementById(id);

  function setStatus(msg) {
    const el = $("mStatus");
    if (el) el.textContent = msg || "";
  }

  function getOrdersCollection() {
    return (window.APP && APP.ads && APP.ads.ordersCollection) ? APP.ads.ordersCollection : "ad_orders";
  }

  function ensureApp() {
    if (!window.APP) throw new Error("config.js(APP)가 로드되지 않았습니다.");
    if (!APP.firebase) throw new Error("APP.firebase 설정이 없습니다.");
  }

  // Firebase
  let FB = { ok: false, db: null, auth: null };

  async function initFirebase() {
    ensureApp();
    if (!window.firebase) throw new Error("firebase compat 스크립트가 없습니다.");

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
  }

  async function ensureAnonAuth() {
    if (!FB.ok || !FB.auth) return;
    if (FB.auth.currentUser) return;
    await FB.auth.signInAnonymously();
  }

  // Wallet
  async function getProvider() {
    if (!window.ethereum) throw new Error("지갑 확장프로그램이 없습니다.");
    return new ethers.BrowserProvider(window.ethereum);
  }

  async function getMe() {
    const p = await getProvider();
    await p.send("eth_requestAccounts", []);
    const signer = await p.getSigner();
    return await signer.getAddress();
  }

  // UI modal open/close
  function openModal() {
    const back = $("modalBack");
    if (back) back.style.display = "flex";
  }

  function closeModal() {
    const back = $("modalBack");
    if (back) back.style.display = "none";
  }

  // 샘플 서비스 목록 (기존에 svcBody 채우는 로직이 있다면 그걸 유지하고 이 부분만 연결하면 됨)
  // 여기서는 최소 동작만: 버튼 클릭 시 모달 열고 값 세팅
  function renderServices() {
    const body = $("svcBody");
    if (!body) return;

    const services = (APP && APP.ads && Array.isArray(APP.ads.services)) ? APP.ads.services : [
      { id: 1, name: "기본 광고", includes: "리포트 제공", required: "참고링크/목적", price: "10" }
    ];

    body.innerHTML = "";
    services.forEach((s) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${s.id}</td>
        <td>${escapeHtml(s.name || "-")}</td>
        <td class="muted">${escapeHtml(s.includes || "-")}</td>
        <td class="muted">${escapeHtml(s.required || "-")}</td>
        <td class="right price">${escapeHtml(String(s.price || "-"))}</td>
        <td class="right"><button class="btn ghost" data-svc="${s.id}">주문</button></td>
      `;

      body.appendChild(tr);
    });

    body.querySelectorAll("button[data-svc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = Number(btn.getAttribute("data-svc"));
        const svc = services.find(x => Number(x.id) === sid) || services[0];

        $("mTitle").textContent = "주문 요청";
        $("mDesc").textContent = (svc && svc.name) ? svc.name : "-";
        $("btnSubmit").dataset.serviceId = String(sid);

        setStatus("");
        openModal();
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function saveOrderToFirestore(order) {
    await initFirebase();
    await ensureAnonAuth();

    const col = getOrdersCollection();
    const ref = FB.db.collection(col).doc(); // 자동 ID
    await ref.set({
      ...order,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "created"
    });

    return ref.id;
  }

  async function onSubmit() {
    setStatus("");
    try {
      const serviceId = Number(($("btnSubmit").dataset.serviceId || "0"));
      if (!serviceId) throw new Error("서비스 ID가 없습니다.");

      const contact = String(($("mContact").value || "")).trim();
      const required = String(($("mRequired").value || "")).trim();
      const link = String(($("mLink").value || "")).trim();
      const memo = String(($("mMemo").value || "")).trim();

      if (!contact) throw new Error("연락처를 입력하세요.");
      if (!required) throw new Error("광고목적을 입력하세요.");

      setStatus("지갑 확인 중...");
      const me = await getMe();

      setStatus("주문 저장 중...");
      const docId = await saveOrderToFirestore({
        serviceId,
        serviceName: ($("mDesc") && $("mDesc").textContent) ? $("mDesc").textContent : "서비스",
        contact,
        required,
        link,
        memo,
        wallet: me
      });

      setStatus("주문 저장 완료: " + docId + " / 결제는 다음 단계로 진행");
      // 여기서 결제 트랜잭션 로직이 있다면 이어붙이면 됨

    } catch (e) {
      setStatus(e && e.message ? e.message : String(e));
    }
  }

  function bind() {
    const closeBtn = $("btnClose");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    const submitBtn = $("btnSubmit");
    if (submitBtn) submitBtn.addEventListener("click", onSubmit);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderServices();
    bind();
  });
})();
