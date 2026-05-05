// /assets/js/jump-a2e.js
// a2e.html에서 Jump 수탁지갑으로 모든 기능 이용 (MetaMask 불필요)
// - jump_session이 없으면 MetaMask 경로로 fallback
// - 있으면 JumpCustodialSigner를 WALLET.signer에 주입

(function () {
  const STORAGE_KEY   = "jump_session";
  const PARTNER_API_KEY = "3fd9afc326ff3f687197f3fbc8f746133d513e5f3237a54a94cd87a3dd3b56cf";
  const OPBNB_RPC     = "https://opbnb-mainnet-rpc.bnbchain.org";
  const OPBNB_CHAIN   = 204;

  const JUMP_CONFIG = {
    apiKey:            "AIzaSyD6oGXWcQIAa46ZiO6E9fBWOXqiNCAL4-c",
    authDomain:        "jumper-b15aa.firebaseapp.com",
    projectId:         "jumper-b15aa",
    storageBucket:     "jumper-b15aa.firebasestorage.app",
    messagingSenderId: "1051842479371",
    appId:             "1:1051842479371:web:cd0dca2c1eab0e44b58e0e",
  };

  // ── 세션 확인 ──
  let session = null;
  try { session = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch {}
  if (!session || !session.walletAddress) return; // MetaMask 경로

  // ── Firebase "jump" 앱 초기화 (idToken 갱신용) ──
  let jumpUser = null;

  function initJumpFirebase() {
    try {
      const app =
        firebase.apps.find((a) => a.name === "jump") ||
        firebase.initializeApp(JUMP_CONFIG, "jump");
      firebase.auth(app).onAuthStateChanged((u) => { jumpUser = u; });
    } catch (e) {
      console.warn("jump-a2e: Firebase init failed:", e);
    }
  }

  async function getIdToken() {
    if (jumpUser) return jumpUser.getIdToken();
    return ""; // 아직 auth 미완료 → 로컬 폴백 트리거
  }

  // ── 수탁지갑 커스텀 사이너 ──
  class JumpCustodialSigner extends window.ethers.AbstractSigner {
    constructor(provider, address) {
      super(provider);
      this._address = address;
    }

    async getAddress() { return this._address; }

    connect(provider) {
      return new JumpCustodialSigner(provider, this._address);
    }

    // 서명만 필요한 경우 로컬 키로 처리 (로컬 테스트 모드)
    async signTransaction(tx) {
      const wallet = this._localWallet();
      return wallet.signTransaction(tx);
    }

    async signMessage(message) {
      const wallet = this._localWallet();
      return wallet.signMessage(message);
    }

    async signTypedData(domain, types, value) {
      const wallet = this._localWallet();
      return wallet.signTypedData(domain, types, value);
    }

    _localWallet() {
      const ethers = window.ethers;
      const uid = jumpUser?.uid || session.uid || "local";
      const pk = ethers.id("local-test:" + uid);
      return new ethers.Wallet(pk, this.provider);
    }

    // ── 핵심: 트랜잭션 전송 ──
    async sendTransaction(tx) {
      const ethers = window.ethers;

      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("no-idToken");

        const res = await fetch("/.netlify/functions/jump_tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            partnerApiKey: PARTNER_API_KEY,
            txData: {
              to:    tx.to,
              data:  tx.data  || "0x",
              value: tx.value != null ? ethers.toBeHex(BigInt(tx.value.toString())) : "0x0",
            },
          }),
        });

        if (!res.ok) throw new Error("netlify-unavailable");
        const data = await res.json();
        if (!data.ok) throw new Error(data.msg || "트랜잭션 실패");

        // TransactionResponse-like object with wait()
        const txHash = data.txHash;
        return {
          hash: txHash,
          wait: () => this.provider.waitForTransaction(txHash),
        };
      } catch (e) {
        // Netlify 함수 미응답 → 로컬 테스트 모드
        if (!e.message.includes("트랜잭션 실패")) {
          console.warn("jump_tx 미응답 → 로컬 테스트 서명:", e.message);
          return this._localWallet().sendTransaction(tx);
        }
        throw e;
      }
    }
  }

  // ── 버튼 UI 업데이트 ──
  function styleConnectedBtn(btn) {
    if (!btn) return;
    btn.textContent = "🔐 Jump 수탁지갑";
    btn.style.background   = "rgba(167,139,250,.10)";
    btn.style.borderColor  = "rgba(167,139,250,.45)";
    btn.style.color        = "#a78bfa";
    btn.disabled = true;
  }

  // ── 메인 셋업 ──
  async function setup() {
    const ethers = window.ethers;
    if (!ethers) { console.warn("jump-a2e: ethers not loaded"); return; }

    initJumpFirebase();

    const addr     = session.walletAddress;
    const provider = new ethers.JsonRpcProvider(OPBNB_RPC, OPBNB_CHAIN);
    const signer   = new JumpCustodialSigner(provider, addr);

    // WALLET 글로벌 주입 (a2e.js가 사용)
    window.WALLET = window.WALLET || {};
    window.WALLET.provider = provider;
    window.WALLET.signer   = signer;
    window.WALLET.address  = addr;
    window.WALLET.chainId  = OPBNB_CHAIN;

    // 버튼 UI
    styleConnectedBtn(document.getElementById("btnA2EConnect"));

    // a2e.js의 onWalletConnected 훅 실행
    // (a2e.js가 아직 안 로드됐을 수 있으므로 잠시 대기)
    function fire() {
      try { if (typeof window.onWalletConnected === "function") window.onWalletConnected(); } catch {}
      try { window.dispatchEvent(new Event("wallet:connected")); } catch {}
      try { document.dispatchEvent(new Event("wallet:connected")); } catch {}
      try { window.dispatchEvent(new Event("a2e:wallet-connected")); } catch {}
    }

    // a2e.js가 onWalletConnected를 등록할 시간을 줌
    setTimeout(fire, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
