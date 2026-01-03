// /assets/js/a2e_id.js
(() => {
  // a2e 컨트랙트 주소 (사용자께서 쓰는 실제 주소로 교체)
  const A2E_ADDR = "0x31f21893F145Ed94DEA4e6dDe34C2Ac6EBFdB631";

  // HEX 토큰 주소 (실제 주소로 교체)
  const HEX_ADDR = "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464";

  const A2E_ABI = [
    // views
    "function admin() view returns (address)",
    "function staff(address) view returns (uint8)",
    "function price() view returns (uint256)",
    "function claimCooldown() view returns (uint256)",
    "function withdrawCooldown() view returns (uint256)",
    "function seizeGrace() view returns (uint256)",
    "function mentoFee() view returns (uint256)",
    "function feeAcc() view returns (uint256)",
    "function feeThreshold() view returns (uint256)",
    "function nextId() view returns (uint256)",
    "function idOf(address) view returns (uint256)",
    "function adprice(uint256) view returns (uint256)",
    "function myInfo(uint256) view returns (address owner,address mento,uint256 level,uint256 exp,uint256 mypay,uint256 totalpay,uint256 memberUntil,bool blacklisted)",
    "function claimInfo(uint256,uint256) view returns (bool isPending,uint64 reqAt,bytes32 proof,uint256 lastAt,uint256 price_)",

    // user actions
    "function join(address mento)",
    "function payMembership(uint256 id_,uint256 months)",
    "function claim(uint256 id_,uint256 missionId,bytes32 proof)",
    "function cancelClaim(uint256 id_,uint256 missionId)",
    "function withdraw(uint256 id_)",

    // staff/admin
    "function resolveClaim(uint256 id_,uint256 missionId)",
    "function setAdPrice(uint256 missionId,uint256 p)",
    "function flushFee()"
  ];

  const ERC20_ABI = [
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  function formatUnits(v, d = 18) {
    try { return ethers.utils.formatUnits(v, d); } catch (e) { return String(v); }
  }

  function tsToLocal(ts) {
    const n = Number(ts || 0);
    if (!n) return "-";
    return new Date(n * 1000).toLocaleString();
  }

  function toBytes32Proof(input) {
    const s = (input || "").trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(s || "proof"));
  }

  // 커스텀에러는 메시지가 없으니 프론트에서 번역
  const CUSTOM_ERROR_MAP = {
    // a2e error selectors (일부만 사람이 읽게)
    // MT()
    "0x4a1f11a7": "멘토가 유효하지 않습니다. 멘토는 먼저 가입된 주소여야 합니다.",
  };

  function explainEthersError(e) {
    const msg =
      e?.error?.data?.originalError?.message ||
      e?.error?.message ||
      e?.data?.message ||
      e?.message ||
      "";

    // revert string (예: ALLOW)
    if (msg.includes("execution reverted:")) {
      const reason = msg.split("execution reverted:")[1].trim();
      if (reason === "ALLOW") {
        return "ALLOW: HEX 승인(approve)이 부족합니다. 먼저 approve 후 다시 시도하세요.";
      }
      return "리버트: " + reason;
    }

    const dataHex =
      e?.error?.data?.originalError?.data ||
      e?.error?.data ||
      e?.data ||
      "";

    if (typeof dataHex === "string" && dataHex.startsWith("0x") && dataHex.length >= 10) {
      const selector = dataHex.slice(0, 10);
      if (CUSTOM_ERROR_MAP[selector]) return CUSTOM_ERROR_MAP[selector];
    }

    return msg || "트랜잭션 실패";
  }

  async function getWeb3() {
    if (!window.ethereum) throw new Error("No wallet");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const account = await signer.getAddress();

    const contract = new ethers.Contract(A2E_ADDR, A2E_ABI, signer);
    const contractRO = new ethers.Contract(A2E_ADDR, A2E_ABI, provider);

    const hex = new ethers.Contract(HEX_ADDR, ERC20_ABI, signer);
    const hexRO = new ethers.Contract(HEX_ADDR, ERC20_ABI, provider);

    return { provider, signer, account, contract, contractRO, hex, hexRO };
  }

  async function ensureHexAllowance(requiredAmount) {
    const { account, hex, hexRO } = await getWeb3();
    const allowance = await hexRO.allowance(account, A2E_ADDR);
    if (allowance.gte(requiredAmount)) return { approved: false, txHash: null };

    const tx = await hex.approve(A2E_ADDR, ethers.constants.MaxUint256);
    await tx.wait();
    return { approved: true, txHash: tx.hash };
  }

  window.A2E_ID = {
    A2E_ADDR,
    HEX_ADDR,
    A2E_ABI,
    formatUnits,
    tsToLocal,
    toBytes32Proof,
    explainEthersError,
    getWeb3,
    ensureHexAllowance
  };
})();
