// /assets/js/header-wallet.js
// v5/v6 자동 호환 (UMD 전역 window.ethers)
// - ethers v6: BrowserProvider / ethers.formatUnits / bigint
// - ethers v5: providers.Web3Provider / ethers.utils.formatUnits / BigNumber
// head.html(partials) 늦게 삽입되는 경우도 waitForEl로 견딤
// 연결 성공 시 window.WALLET 갱신 + window.onWalletConnected() 호출 + 이벤트 디스패치

(() => {
  const TOKENS = [
    { symbol: "USDT", address: "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3" },
    { symbol: "HEX",  address: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464" },
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

  function waitForEl(selector, timeoutMs = 12000) {
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

  function shortAddr(a) {
    return a ? (a.slice(0, 6) + "..." + a.slice(-4)) : "-";
  }

  function formatLoose(str) {
    if (!str) return "0";
    if (str.includes(".")) {
      const [a, b] = str.split(".");
      if (a.length >= 7) return a;
      return a + "." + (b || "").slice(0, 4);
    }
    return str;
  }

  function isEthersV6(ethers) {
    return !!ethers && typeof ethers.BrowserProvider === "function";
  }

  function fmtUnits(ethers, raw, dec) {
    try {
      if (isEthersV6(ethers)) return ethers.formatUnits(raw, dec);
      return ethers.utils.formatUnits(raw, dec);
    } catch {
      return String(raw);
    }
  }

  function isPositive(raw) {
    try {
      if (typeof raw === "bigint") return raw > 0n;
      if (raw && typeof raw.gt === "function") return raw.gt(0);
      return Number(raw) > 0;
    } catch {
      return false;
    }
  }

  async function decimalsSafe(contract, fallbackDecimals) {
    try {
      const d = await contract.decimals();
      // v6: number / bigint 가능, v5: number
      return Number(d);
    } catch {
      if (Number.isFinite(fallbackDecimals)) return fallbackDecimals;
      return 18;
    }
  }

  async function balanceSafe(contract, user) {
    try {
      return await contract.balanceOf(user);
    } catch {
      return null;
    }
  }

  function buildStrip(stripEl) {
    stripEl.innerHTML = "";
    for (const t of TOKENS) {
      const s = document.createElement("span");
      s.className = "token-pill muted";
      s.dataset.symbol = t.symbol;
      s.textContent = `${t.symbol}: -`;
      stripEl.appendChild(s);
    }
  }

  function setPill(stripEl, symbol, text, cls) {
    const el = stripEl.querySelector(`[data-symbol="${symbol}"]`);
    if (!el) return;
    el.className = "token-pill " + (cls || "muted");
    el.textContent = `${symbol}: ${text}`;
  }

  function syncGlobalWallet({ provider, signer, address }) {
    if (!window.WALLET) window.WALLET = {};
    window.WALLET.provider = provider || null;
    window.WALLET.signer = signer || null;
    window.WALLET.address = address || null;
  }

  function fireConnectedHooks() {
    try { window.onWalletConnected && window.onWalletConnected(); } catch (_) {}
    try { window.dispatchEvent(new Event("wallet:connected")); } catch (_) {}
    try { document.dispatchEvent(new Event("wallet:connected")); } catch (_) {}
  }

  async function main() {
    const btn = await waitForEl("#wallet-btn");
    const addrEl = await waitForEl("#wallet-addr");
    const statusEl = await waitForEl("#wallet-status");
    const stripEl = await waitForEl("#token-strip");
    const walletArea = await waitForEl(".wallet-area");

    if (!btn || !addrEl || !statusEl || !stripEl || !walletArea) return;

    buildStrip(stripEl);

    walletArea.classList.remove("is-connected");
    addrEl.textContent = "지갑: -";
    statusEl.textContent = "연결 대기";

    let provider = null;
    let signer = null;
    let user = null;

    async function loadBalances() {
      const ethers = window.ethers;
      if (!ethers || !provider || !user) return;

      statusEl.textContent = "잔고 조회중...";

      await Promise.all(TOKENS.map(async (t) => {
        try {
          const c = new ethers.Contract(t.address, ERC20_ABI, provider);
          const dec = await decimalsSafe(c, t.fallbackDecimals);
          const raw = await balanceSafe(c, user);

          if (raw === null) {
            setPill(stripEl, t.symbol, "조회실패", "warn");
            return;
          }

          const v = fmtUnits(ethers, raw, dec);
          const nice = formatLoose(v);
          setPill(stripEl, t.symbol, nice, isPositive(raw) ? "good" : "muted");
        } catch {
          setPill(stripEl, t.symbol, "조회실패", "warn");
        }
      }));

      statusEl.textContent = "연결됨";
    }

    async function connect() {
      try {
        const ethers = window.ethers;
        if (!ethers) {
          alert("ethers 로드가 안 됐습니다. ethers.umd.min.js를 먼저 포함하세요.");
          return;
        }
        if (!window.ethereum) {
          alert("MetaMask/Rabby 지갑이 필요합니다.");
          return;
        }

        // v6 / v5 자동 선택
        if (isEthersV6(ethers)) {
          provider = new ethers.BrowserProvider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          signer = await provider.getSigner();
          user = await signer.getAddress();
        } else {
          provider = new ethers.providers.Web3Provider(window.ethereum, "any");
          await provider.send("eth_requestAccounts", []);
          signer = provider.getSigner();
          user = await signer.getAddress();
        }

        addrEl.textContent = "지갑: " + shortAddr(user);
        walletArea.classList.add("is-connected");
        statusEl.textContent = "연결됨 · 조회 준비중...";

        // 글로벌 WALLET 싱크 (mypage.js / a2e.js 같은 페이지에서 사용)
        syncGlobalWallet({ provider, signer, address: user });
        fireConnectedHooks();

        // 이벤트 중복 방지 후 재등록
        window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
        window.ethereum.removeListener?.("chainChanged", onChainChanged);
        window.ethereum.on?.("accountsChanged", onAccountsChanged);
        window.ethereum.on?.("chainChanged", onChainChanged);

        await loadBalances();
      } catch (e) {
        console.error(e);
        statusEl.textContent = "연결 실패";
        alert(e?.message || "지갑 연결 실패");
      }
    }

    async function onAccountsChanged(accounts) {
      user = accounts?.[0] || null;
      if (!user) {
        addrEl.textContent = "지갑: -";
        walletArea.classList.remove("is-connected");
        statusEl.textContent = "연결 대기";
        buildStrip(stripEl);
        syncGlobalWallet({ provider: null, signer: null, address: null });
        return;
      }
      addrEl.textContent = "지갑: " + shortAddr(user);
      walletArea.classList.add("is-connected");
      syncGlobalWallet({ provider, signer, address: user });
      fireConnectedHooks();
      await loadBalances();
    }

    async function onChainChanged() {
      const ethers = window.ethers;
      if (!ethers || !window.ethereum) return;

      try {
        if (isEthersV6(ethers)) {
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner().catch(() => null);
        } else {
          provider = new ethers.providers.Web3Provider(window.ethereum, "any");
          signer = provider.getSigner();
        }
        syncGlobalWallet({ provider, signer, address: user });
        fireConnectedHooks();
        await loadBalances();
      } catch (e) {
        console.warn("chainChanged reload failed:", e);
      }
    }

    btn.addEventListener("click", connect);

    // 이미 wallet.js가 먼저 연결해둔 경우(페이지마다 다름) 반영
    if (window.WALLET && window.WALLET.address) {
      user = window.WALLET.address;
      provider = window.WALLET.provider || provider;
      signer = window.WALLET.signer || signer;

      addrEl.textContent = "지갑: " + shortAddr(user);
      walletArea.classList.add("is-connected");
      statusEl.textContent = "연결됨 · 조회 준비중...";
      await loadBalances();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
