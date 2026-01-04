// /assets/js/wallet.js
(function () {
  const $ = (s) => document.querySelector(s);

  window.WALLET = {
    provider: null,       // ethers.providers.Web3Provider
    signer: null,
    address: null,
    chainId: null,
  };

  function shortAddr(a) {
    if (!a) return "-";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function setWalletUI() {
    const addrEl = $("#wallet-addr");
    const btn = $("#wallet-btn");
    if (!addrEl || !btn) return;

    if (window.WALLET.address) {
      addrEl.textContent = shortAddr(window.WALLET.address);
      btn.textContent = "연결됨";
      btn.classList.add("is-connected");
    } else {
      addrEl.textContent = "-";
      btn.textContent = "지갑연결";
      btn.classList.remove("is-connected");
    }
  }

  async function updateHexBalance() {
    const balEl = $("#hex-balance");
    if (!balEl) return;

    try {
      if (!window.WALLET.provider || !window.WALLET.address) {
        balEl.textContent = "HEX잔고: -";
        return;
      }

      const a2e = getA2ERead();
      const hexAddr = await a2e.hexToken();
      const hex = new ethers.Contract(hexAddr, APP.erc20Abi, window.WALLET.provider);
      const [sym, dec, bal] = await Promise.all([
        hex.symbol().catch(() => "HEX"),
        hex.decimals().catch(() => 18),
        hex.balanceOf(window.WALLET.address),
      ]);

      const fmt = ethers.utils.formatUnits(bal, dec);
      balEl.textContent = `${sym}잔고: ${Number(fmt).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
    } catch (e) {
      balEl.textContent = "HEX잔고: -";
    }
  }

  function getA2ERead() {
    const rpc = new ethers.providers.JsonRpcProvider(APP.chain.rpcUrl);
    return new ethers.Contract(APP.contracts.a2e, APP.a2eAbi, rpc);
  }

  async function ensureChain() {
    const target = "0x" + APP.chain.chainId.toString(16);

    // 메타마스크/다른 지갑 확장 충돌 메시지는 확장 프로그램 문제라 코드로 완전 해결 불가
    // 우리는 window.ethereum을 덮어쓰지 않고, 요청만 합니다.
    if (!window.ethereum) throw new Error("지갑 확장(메타마스크/라비 등)을 설치해 주세요.");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: target }],
      });
    } catch (e) {
      // 체인이 없으면 추가
      if (e && (e.code === 4902 || String(e.message || "").includes("4902"))) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: target,
            chainName: APP.chain.name,
            rpcUrls: [APP.chain.rpcUrl],
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            blockExplorerUrls: [APP.chain.blockExplorer],
          }],
        });
      } else {
        throw e;
      }
    }
  }

  window.connectWallet = async function connectWallet() {
    try {
      await ensureChain();

      const web3 = new ethers.providers.Web3Provider(window.ethereum, "any");
      await web3.send("eth_requestAccounts", []);
      const signer = web3.getSigner();
      const addr = await signer.getAddress();
      const net = await web3.getNetwork();

      window.WALLET.provider = web3;
      window.WALLET.signer = signer;
      window.WALLET.address = addr;
      window.WALLET.chainId = net.chainId;

      setWalletUI();
      await updateHexBalance();

      // 페이지별 훅
      if (typeof window.onWalletConnected === "function") {
        await window.onWalletConnected();
      }
    } catch (e) {
      window.uiToast?.(asUserMessage(e), "error");
    }
  };

  // chain/account 변경 반영
  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on("accountsChanged", () => {
      window.location.reload();
    });
    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });
  }

  window.walletRefreshHex = updateHexBalance;
  window.walletShortAddr = shortAddr;

  // 공통 에러 메시지(긴 문자열 모바일 줄바꿈 대응은 CSS에서)
  window.asUserMessage = function asUserMessage(e) {
    const msg = e?.reason || e?.data?.message || e?.message || String(e || "");
    // 흔한 패턴 정리
    if (msg.includes("user rejected")) return "사용자가 서명을 취소했습니다.";
    if (msg.includes("insufficient funds")) return "가스비(BNB)가 부족합니다.";
    if (msg.includes("execution reverted")) {
      // revert: XXX 또는 custom error selector만 있는 경우도 있음
      const m = msg.match(/execution reverted(?::\s*)?([A-Za-z0-9_]+)?/);
      const code = (m && m[1]) ? m[1] : "";
      return code ? `실행 실패: ${code}` : "실행 실패(리버트)";
    }
    return msg;
  };

  // 초기 UI
  document.addEventListener("DOMContentLoaded", () => {
    setWalletUI();
    updateHexBalance();
  });
})();
