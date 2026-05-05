// /assets/js/jump-header.js
// 모든 페이지 헤더에 Jump 수탁지갑 상태 표시 (localStorage 기반)

(function () {
  const STORAGE_KEY = "jump_session";
  const OPBNB_RPC   = "https://opbnb-mainnet-rpc.bnbchain.org";

  const TOKENS = [
    { symbol: "USDT", address: "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3" },
    { symbol: "HEX",  address: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464" },
    { symbol: "HUT",  address: "0x3e31344335C77dA37cb2Cf409117e1dCa5Fda634", dec: 0 },
    { symbol: "PUT",  address: "0xE0fD5e1C6D832E71787BfB3E3F5cdB5dd2FD41b6", dec: 0 },
    { symbol: "BUT",  address: "0xc159663b769E6c421854E913460b973899B76E42", dec: 0 },
    { symbol: "EXP",  address: "0xBc619cb03c0429731AF66Ae8ccD5aeE917A6E5f4", dec: 0 },
    { symbol: "VET",  address: "0xff8eCA08F731EAe46b5e7d10eBF640A8Ca7BA3D4", dec: 0 },
  ];
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  function getSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }

  function waitForEl(sel, ms = 10000) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const el = document.querySelector(sel);
        if (el) { clearInterval(iv); resolve(el); return; }
        if (Date.now() - t0 > ms) { clearInterval(iv); resolve(null); }
      }, 120);
    });
  }

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "..." + a.slice(-4) : "-";
  }

  function fmtLoose(str) {
    if (!str) return "0";
    if (str.includes(".")) {
      const [a, b] = str.split(".");
      if (a.length >= 7) return a;
      return a + "." + (b || "").slice(0, 4);
    }
    return str;
  }

  async function loadBalances(walletAddress, stripEl) {
    const ethers = window.ethers;
    if (!ethers || !walletAddress) return;
    try {
      const provider = new ethers.JsonRpcProvider(OPBNB_RPC);
      await Promise.all(TOKENS.map(async (t) => {
        const pill = stripEl.querySelector(`[data-symbol="${t.symbol}"]`);
        if (!pill) return;
        try {
          const c = new ethers.Contract(t.address, ERC20_ABI, provider);
          let dec = t.dec ?? 18;
          try { dec = Number(await c.decimals()); } catch {}
          const raw = await c.balanceOf(walletAddress);
          const val = fmtLoose(ethers.formatUnits(raw, dec));
          pill.className = "token-pill " + (raw > 0n ? "good" : "muted");
          pill.textContent = `${t.symbol}: ${val}`;
        } catch {
          pill.className = "token-pill warn";
          pill.textContent = `${t.symbol}: -`;
        }
      }));
    } catch (e) {
      console.warn("jump-header: balance load failed", e);
    }
  }

  async function applyJumpHeader(session) {
    const [addrEl, statusEl, walletArea, btn, stripEl] = await Promise.all([
      waitForEl("#wallet-addr"),
      waitForEl("#wallet-status"),
      waitForEl(".wallet-area"),
      waitForEl("#wallet-btn"),
      waitForEl("#token-strip"),
    ]);
    if (!walletArea) return;

    const addr = session.walletAddress;

    if (addrEl) addrEl.textContent = "🔐 " + shortAddr(addr);
    if (statusEl) statusEl.textContent = "Jump 로그인";
    walletArea.classList.add("is-connected");

    if (btn) {
      btn.textContent = "Jump 로그아웃";
      btn.style.borderColor = "rgba(167,139,250,.45)";
      btn.style.color = "#a78bfa";
      btn.style.background = "rgba(167,139,250,.10)";
      btn.onclick = (e) => { e.preventDefault(); location.href = "/jump.html"; };
    }

    if (stripEl) {
      stripEl.innerHTML = "";
      for (const t of TOKENS) {
        const s = document.createElement("span");
        s.className = "token-pill muted";
        s.dataset.symbol = t.symbol;
        s.textContent = `${t.symbol}: -`;
        stripEl.appendChild(s);
      }
      if (window.ethers) {
        loadBalances(addr, stripEl);
      } else {
        window.addEventListener("load", () => {
          if (window.ethers) loadBalances(addr, stripEl);
        });
      }
    }
  }

  const session = getSession();
  if (session && session.walletAddress) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => applyJumpHeader(session));
    } else {
      applyJumpHeader(session);
    }
  }
})();
