// /assets/js/header-wallet.js
// 헤더가 partials로 "나중에" 삽입되는 경우도 확실히 잡는다.
// ethers는 UMD 전역(window.ethers) 사용.

(() => {
  const TOKENS = [
    { symbol: "USDT", address: "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3" },
    { symbol: "HEX",  address: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464" }, // HexStableToken.sol
    { symbol: "HUT",  address: "0x3e31344335C77dA37cb2Cf409117e1dCa5Fda634", fallbackDecimals: 0 },
    { symbol: "PUT",  address: "0xE0fD5e1C6D832E71787BfB3E3F5cdB5dd2FD41b6", fallbackDecimals: 0 },
    { symbol: "BUT",  address: "0xc159663b769E6c421854E913460b973899B76E42", fallbackDecimals: 0 },
    { symbol: "EXP",  address: "0xBc619cb03c0429731AF66Ae8ccD5aeE917A6E5f4", fallbackDecimals: 0 },
    { symbol: "VET",  address: "0xff8eCA08F731EAe46b5e7d10eBF640A8Ca7BA3D4", fallbackDecimals: 0 },
  ];

  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  // partials 로딩 타이밍 문제 방지용: 요소가 생길 때까지 기다리는 유틸
  function waitForEl(selector, timeoutMs = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(t);
          resolve(el);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          resolve(null);
        }
      }, 120);
    });
  }

  function shortAddr(a){
    return a ? (a.slice(0, 6) + "..." + a.slice(-4)) : "-";
  }

  function formatLoose(str){
    if (!str) return "0";
    if (str.includes(".")) {
      const [a,b] = str.split(".");
      if (a.length >= 7) return a;
      return a + "." + (b || "").slice(0, 4);
    }
    return str;
  }

  async function decimalsSafe(ethers, contract, fallbackDecimals){
    try{
      const d = await contract.decimals();
      return Number(d);
    }catch(_e){
      if (Number.isFinite(fallbackDecimals)) return fallbackDecimals;
      return 18;
    }
  }

  async function balanceSafe(contract, user){
    try{
      return await contract.balanceOf(user);
    }catch(_e){
      return null;
    }
  }

  function buildStrip(stripEl){
    stripEl.innerHTML = "";
    for (const t of TOKENS){
      const s = document.createElement("span");
      s.className = "token-pill muted";
      s.dataset.symbol = t.symbol;
      s.textContent = `${t.symbol}: -`;
      stripEl.appendChild(s);
    }
  }

  function setPill(stripEl, symbol, text, cls){
    const el = stripEl.querySelector(`[data-symbol="${symbol}"]`);
    if (!el) return;
    el.className = "token-pill " + (cls || "muted");
    el.textContent = `${symbol}: ${text}`;
  }

  // ============================
  // ✅ 핵심: 페이지 전역 WALLET 동기화 + 콜백/이벤트 브릿지
  // ============================
  function syncWalletGlobal({ provider, signer, address, chainId }) {
    const w = (window.WALLET && typeof window.WALLET === "object") ? window.WALLET : {};
    w.provider = provider || w.provider || null;
    w.signer  = signer  || w.signer  || null;
    w.address = address || w.address || null;
    w.chainId = (chainId != null) ? chainId : (w.chainId ?? null);
    window.WALLET = w;

    // a2e.js / mypage.js가 기대하는 콜백
    try { window.onWalletConnected?.(); } catch(e) {}

    // 이벤트 기반으로도 받을 수 있게
    try { window.dispatchEvent(new Event("wallet:connected")); } catch(e) {}
    try { document.dispatchEvent(new Event("wallet:connected")); } catch(e) {}
  }

  function clearWalletGlobal() {
    if (window.WALLET && typeof window.WALLET === "object") {
      window.WALLET.address = null;
      window.WALLET.signer = null;
      window.WALLET.provider = null;
    } else {
      window.WALLET = { address: null, signer: null, provider: null };
    }
    try { window.dispatchEvent(new Event("wallet:disconnected")); } catch(e) {}
    try { document.dispatchEvent(new Event("wallet:disconnected")); } catch(e) {}
  }

  async function main(){
    const btn = await waitForEl("#wallet-btn");
    const addrEl = await waitForEl("#wallet-addr");
    const statusEl = await waitForEl("#wallet-status");
    const stripEl = await waitForEl("#token-strip");
    const walletArea = await waitForEl(".wallet-area");

    if (!btn || !addrEl || !statusEl || !stripEl || !walletArea) {
      return;
    }

    buildStrip(stripEl);

    // 기본: 숨김 상태
    walletArea.classList.remove("is-connected");
    addrEl.textContent = "지갑: -";
    statusEl.textContent = "연결 대기";

    let provider, signer, user;

    async function loadBalances(){
      const ethers = window.ethers;
      if (!ethers || !provider || !user) return;

      statusEl.textContent = "잔고 조회중...";

      await Promise.all(TOKENS.map(async (t) => {
        const c = new ethers.Contract(t.address, ERC20_ABI, provider);
        const dec = await decimalsSafe(ethers, c, t.fallbackDecimals);
        const raw = await balanceSafe(c, user);

        if (raw === null){
          setPill(stripEl, t.symbol, "조회실패", "warn");
          return;
        }

        const v = ethers.formatUnits(raw, dec);
        const nice = formatLoose(v);
        setPill(stripEl, t.symbol, nice, (raw > 0n) ? "good" : "muted");
      }));

      statusEl.textContent = "연결됨";
    }

    async function connect(){
      try{
        const ethers = window.ethers;
        if (!ethers) {
          alert("ethers 로드가 안 됐습니다. head에서 ethers.umd.min.js 먼저 포함하세요.");
          return;
        }
        if (!window.ethereum){
          alert("MetaMask/Rabby 지갑이 필요합니다.");
          return;
        }

        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        user = await signer.getAddress();

        const net = await provider.getNetwork().catch(() => null);
        const chainId = net ? Number(net.chainId) : null;

        addrEl.textContent = "지갑: " + shortAddr(user);
        walletArea.classList.add("is-connected");
        statusEl.textContent = "연결됨 · 조회 준비중...";

        // ✅ 전역 WALLET 동기화(여기가 핵심)
        syncWalletGlobal({ provider, signer, address: user, chainId });

        // 이벤트(중복 등록 방지)
        window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
        window.ethereum.removeListener?.("chainChanged", onChainChanged);
        window.ethereum.on?.("accountsChanged", onAccountsChanged);
        window.ethereum.on?.("chainChanged", onChainChanged);

        await loadBalances();
      } catch(e){
        console.error(e);
        statusEl.textContent = "연결 실패";
        alert(e?.message || "지갑 연결 실패");
      }
    }

    async function onAccountsChanged(accounts){
      user = accounts?.[0] || null;
      if (!user){
        addrEl.textContent = "지갑: -";
        walletArea.classList.remove("is-connected");
        statusEl.textContent = "연결 대기";
        buildStrip(stripEl);

        // ✅ 전역 WALLET 해제
        clearWalletGlobal();
        return;
      }

      addrEl.textContent = "지갑: " + shortAddr(user);
      walletArea.classList.add("is-connected");

      // ✅ 전역 WALLET 갱신
      const net = await provider?.getNetwork?.().catch(() => null);
      const chainId = net ? Number(net.chainId) : null;
      syncWalletGlobal({ provider, signer, address: user, chainId });

      await loadBalances();
    }

    async function onChainChanged(){
      const ethers = window.ethers;
      if (!ethers || !window.ethereum) return;

      provider = new ethers.BrowserProvider(window.ethereum);

      // signer/address 재확인
      try {
        signer = await provider.getSigner();
        user = await signer.getAddress();
      } catch (e) {}

      const net = await provider.getNetwork().catch(() => null);
      const chainId = net ? Number(net.chainId) : null;

      // ✅ 전역 WALLET 갱신
      if (user) syncWalletGlobal({ provider, signer, address: user, chainId });

      await loadBalances();
    }

    btn.addEventListener("click", connect);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
