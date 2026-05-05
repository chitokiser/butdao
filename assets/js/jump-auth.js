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

  let jumpApp       = null;
  let jumpAuth      = null;
  let jumpDb        = null;
  let _justLoggedIn = false;

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

  // ── 로컬 테스트 폴백: ethers.js로 클라이언트에서 지갑 파생 ──
  function localDeriveWallet(uid) {
    const ethers = window.ethers;
    if (!ethers) throw new Error("ethers.js가 로드되지 않았습니다.");
    const privateKey = ethers.id("local-test:" + uid); // keccak256(uid) → 테스트용
    return new ethers.Wallet(privateKey).address;
  }

  // ── 수탁지갑 조회 (Netlify Function → 실패 시 캐시된 주소 → 로컬 폴백) ──
  async function fetchWallet(idToken, uid) {
    try {
      const res = await fetch("/.netlify/functions/jump_wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, partnerApiKey: PARTNER_API_KEY })
      });

      // 함수 서버가 없을 때(405, 404 등) → 캐시 확인 후 로컬 폴백
      if (!res.ok) {
        console.warn("Netlify 함수 미응답 → 캐시 확인 중...");
        return _fallbackWallet(uid);
      }

      const data = await res.json();
      if (!data.ok) throw new Error(data.msg || "지갑 생성 실패");
      return data;
    } catch (e) {
      // 네트워크 오류도 캐시 확인 후 로컬 폴백으로
      if (e.message && e.message.includes("지갑 생성")) throw e;
      console.warn("Netlify 함수 오류 → 캐시 확인 중:", e.message);
      return _fallbackWallet(uid);
    }
  }

  // 캐시된 실제 주소가 있으면 재사용, 없으면 로컬 파생
  function _fallbackWallet(uid) {
    try {
      const cached = JSON.parse(localStorage.getItem(JUMP_SESSION_KEY) || "null");
      if (cached?.uid === uid && cached?.walletAddress && !cached?.isLocalTest) {
        console.info("jump-auth: 캐시된 실제 주소 재사용 →", cached.walletAddress);
        return { ok: true, walletAddress: cached.walletAddress, isLocalTest: false };
      }
    } catch {}
    console.warn("jump-auth: 캐시 없음 → 로컬 테스트 모드로 전환");
    return { ok: true, walletAddress: localDeriveWallet(uid), isLocalTest: true };
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
      setLoadingMsg("수탁지갑 준비 중...");
      const idToken    = await user.getIdToken();
      const walletData = await fetchWallet(idToken, user.uid);

      // 2단계: a2e 컨트랙트 회원 여부 확인
      setLoadingMsg("Jump 회원 상태 확인 중...");
      const membership = await checkMembership(walletData.walletAddress);

      // 3단계: Firestore 저장
      await saveToFirestore(user, walletData.walletAddress, membership);

      // 4단계: localStorage에 세션 저장 (isLocalTest: true면 주소가 임시 파생값임을 표시)
      localStorage.setItem(JUMP_SESSION_KEY, JSON.stringify({
        uid:           user.uid,
        walletAddress: walletData.walletAddress,
        isLocalTest:   walletData.isLocalTest || false,
        displayName:   user.displayName || "",
        email:         user.email || "",
        photoURL:      user.photoURL || "",
        memberLevel:   membership ? membership.level : null
      }));

      // 5단계: ?dashboard=1 파라미터가 없으면 항상 index.html로 이동
      _justLoggedIn = false;
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
      _justLoggedIn = true;
      await jumpAuth.signInWithPopup(provider);
    } catch (e) {
      _justLoggedIn = false;
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
