// /assets/js/jump-auth.js
// Jump 파트너 Google 로그인 + 수탁지갑 + a2e 회원 확인

(function () {
  const JUMP_CONFIG = {
    apiKey: "AIzaSyD6oGXWcQIAa46ZiO6E9fBWOXqiNCAL4-c",
    authDomain: "jumper-b15aa.firebaseapp.com",
    projectId: "jumper-b15aa",
    storageBucket: "jumper-b15aa.firebasestorage.app",
    messagingSenderId: "1051842479371",
    appId: "1:1051842479371:web:cd0dca2c1eab0e44b58e0e",
    measurementId: "G-0EGPWQ3JP0"
  };

  const PARTNER_API_KEY = "3fd9afc326ff3f687197f3fbc8f746133d513e5f3237a54a94cd87a3dd3b56cf";

  const A2E_CONTRACT = "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3";
  const OPBNB_RPC    = "https://opbnb-mainnet-rpc.bnbchain.org";
  const A2E_ABI = [
    "function idOf(address) view returns (uint256)",
    "function myInfo(uint256 id_) view returns (address owner, address mento, uint256 level, uint256 exp, uint256 mypay, uint256 totalpay, uint256 memberUntil, bool blacklisted)"
  ];

  const JUMP_SESSION_KEY = "jump_session";

  let jumpApp  = null;
  let jumpAuth = null;
  let jumpDb   = null;

  const $ = (sel) => document.querySelector(sel);

  // ── 섹션 전환 ──
  function showSection(id) {
    ["#section-login", "#section-loading", "#section-dashboard"].forEach((s) => {
      const el = $(s);
      if (el) el.style.display = "none";
    });
    const target = $(id);
    if (target) target.style.display = "flex";
  }

  function setStatus(msg, isError) {
    const el = $("#jump-status");
    if (!el) return;
    el.textContent = msg;
    el.className = "jump-status" + (isError ? " error" : "");
  }

  function setLoadingMsg(msg) {
    const el = $("#jump-loading-msg");
    if (el) el.textContent = msg;
  }

  // ── 수탁지갑 조회 (서버에 없으면 로그인 차단) ──
  async function fetchWallet(idToken) {
    let res;
    try {
      res = await fetch("/.netlify/functions/jump_wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, partnerApiKey: PARTNER_API_KEY })
      });
    } catch {
      throw new Error("수탁지갑 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.");
    }

    if (!res.ok) {
      throw new Error(`수탁지갑 서버 오류 (${res.status}). 관리자에게 문의하세요.`);
    }

    const data = await res.json();
    if (!data.ok || !data.walletAddress) {
      throw new Error(data.msg || "수탁지갑이 배정되지 않았습니다. 관리자에게 문의하세요.");
    }
    return data;
  }

  // ── a2e 컨트랙트 회원 조회 ──
  async function checkMembership(walletAddress) {
    const ethers = window.ethers;
    if (!ethers) return null;

    try {
      const provider = new ethers.JsonRpcProvider(OPBNB_RPC);
      const contract = new ethers.Contract(A2E_CONTRACT, A2E_ABI, provider);

      const rawId = await contract.idOf(walletAddress);
      if (rawId === 0n) return null;

      const info = await contract.myInfo(rawId);
      return {
        id:          rawId.toString(),
        level:       Number(info[2]),
        exp:         info[3].toString(),
        mypay:       info[4].toString(),
        totalpay:    info[5].toString(),
        memberUntil: Number(info[6]),
        blacklisted: info[7]
      };
    } catch (e) {
      console.warn("checkMembership failed:", e);
      return null;
    }
  }

  // ── 회원 카드 렌더링 ──
  function renderMemberCard(membership) {
    const card = $("#jump-member-card");
    if (!card) return;

    if (!membership) {
      card.className = "member-card not-member";
      card.innerHTML = `
        <div class="member-label">✅ Jump 회원</div>
        <p class="not-member-msg">
          수탁지갑이 준비되어 있습니다.<br/>
          아직 a2e 미션에 참여하지 않아 레벨/보상 정보가 없습니다.
        </p>`;
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpired = membership.memberUntil < now;
    const expiryDate = new Date(membership.memberUntil * 1000).toLocaleDateString("ko-KR");
    const mypayHex = (Number(membership.mypay) / 1e18).toLocaleString("ko-KR", { maximumFractionDigits: 4 });
    const expVal   = (Number(membership.exp) / 1e16).toLocaleString("ko-KR", { maximumFractionDigits: 0 });

    card.className = "member-card is-member";
    card.innerHTML = `
      <div class="member-label">✅ Jump 회원 확인됨</div>
      <div class="member-grid">
        <div class="member-stat">
          <div class="sk">회원 번호</div>
          <div class="sv"># ${membership.id}</div>
        </div>
        <div class="member-stat">
          <div class="sk">레벨</div>
          <div class="sv"><span class="level-badge">⭐ Lv.${membership.level}</span></div>
        </div>
        <div class="member-stat">
          <div class="sk">경험치 (EXP)</div>
          <div class="sv">${expVal}</div>
        </div>
        <div class="member-stat">
          <div class="sk">미지급 보상 (HEX)</div>
          <div class="sv">${mypayHex}</div>
        </div>
        <div class="member-stat" style="grid-column:1/-1;">
          <div class="sk">회원 만료일</div>
          <div class="sv">
            ${expiryDate}
            ${isExpired ? '<span class="expired-tag">만료됨</span>' : ""}
          </div>
        </div>
      </div>`;
  }

  // ── 지갑 카드 렌더링 ──
  function renderWallet(walletData) {
    const walletEl      = $("#jump-wallet-address");
    const walletShortEl = $("#jump-wallet-short");
    const copyBtn       = $("#jump-copy-btn");
    const addr = walletData.walletAddress;

    if (walletEl) walletEl.textContent = addr;
    if (walletShortEl) walletShortEl.textContent = addr.slice(0, 6) + "..." + addr.slice(-4);

    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(addr).then(() => {
          copyBtn.textContent = "복사됨!";
          setTimeout(() => { copyBtn.textContent = "주소 복사"; }, 2000);
        });
      };
    }
  }

  // ── 사용자 정보 렌더링 ──
  function renderUser(user) {
    const nameEl            = $("#jump-user-name");
    const emailEl           = $("#jump-user-email");
    const avatarEl          = $("#jump-avatar");
    const avatarPlaceholder = $("#jump-avatar-placeholder");

    if (nameEl)  nameEl.textContent  = user.displayName || "사용자";
    if (emailEl) emailEl.textContent = user.email || "";

    if (avatarEl && user.photoURL) {
      avatarEl.src = user.photoURL;
      avatarEl.style.display = "block";
      if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
    }
  }

  // ── Firestore 저장 ──
  async function saveToFirestore(user, walletAddress, membership) {
    if (!jumpDb) return;
    try {
      await jumpDb.collection("jump_users").doc(user.uid).set(
        {
          uid:          user.uid,
          email:        user.email || "",
          displayName:  user.displayName || "",
          walletAddress,
          memberId:     membership ? membership.id : null,
          memberLevel:  membership ? membership.level : null,
          isMember:     !!membership,
          updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Firestore save failed:", e);
    }
  }

  // ── 로그인 후 전체 처리 ──
  async function handleUser(user) {
    if (!user) {
      showSection("#section-login");
      return;
    }

    showSection("#section-loading");

    try {
      // 1단계: 수탁지갑 주소 가져오기
      setLoadingMsg("수탁지갑 확인 중...");
      const idToken    = await user.getIdToken();
      const walletData = await fetchWallet(idToken);

      // 2단계: a2e 컨트랙트 회원 여부 확인
      setLoadingMsg("Jump 회원 상태 확인 중...");
      const membership = await checkMembership(walletData.walletAddress);

      // 3단계: Firestore 저장
      await saveToFirestore(user, walletData.walletAddress, membership);

      // 4단계: localStorage에 세션 저장
      localStorage.setItem(JUMP_SESSION_KEY, JSON.stringify({
        uid:           user.uid,
        walletAddress: walletData.walletAddress,
        displayName:   user.displayName || "",
        email:         user.email || "",
        photoURL:      user.photoURL || "",
        memberLevel:   membership ? membership.level : null
      }));

      // 5단계: ?dashboard=1 파라미터가 없으면 항상 index.html로 이동
      const isDashboardMode = new URLSearchParams(location.search).has("dashboard");
      if (!isDashboardMode) {
        window.location.href = "/index.html";
        return;
      }

      renderUser(user);
      renderWallet(walletData);
      renderMemberCard(membership);
      showSection("#section-dashboard");
    } catch (e) {
      setStatus(e?.message || "오류가 발생했습니다.", true);
      showSection("#section-login");
    }
  }

  // ── Google 로그인 ──
  async function signInWithGoogle() {
    if (!jumpAuth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    try {
      setStatus("로그인 중...");
      await jumpAuth.signInWithPopup(provider);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setStatus(e?.message || "로그인 실패", true);
      } else {
        setStatus("");
      }
    }
  }

  async function signOut() {
    if (!jumpAuth) return;
    localStorage.removeItem(JUMP_SESSION_KEY);
    await jumpAuth.signOut();
  }

  // ── 초기화 ──
  function init() {
    jumpApp =
      firebase.apps.find((a) => a.name === "jump") ||
      firebase.initializeApp(JUMP_CONFIG, "jump");

    jumpAuth = firebase.auth(jumpApp);
    jumpDb   = firebase.firestore(jumpApp);

    jumpAuth.onAuthStateChanged(handleUser);

    const loginBtn  = $("#jump-google-btn");
    if (loginBtn)  loginBtn.addEventListener("click", signInWithGoogle);

    const logoutBtn = $("#jump-logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", signOut);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
