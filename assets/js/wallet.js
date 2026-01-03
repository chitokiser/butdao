let provider;
let signer;
let userAddress;

const HEX_ADDRESS = "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464";  //HEX
const HEX_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transferFrom(address f, address t, uint256 v) external returns (bool)",
  "function approve(address s, uint256 v) external returns (bool) ",
  "function transfer(address t, uint256 v) external returns (bool)",
  "function allowance(address o, address s) external view returns (uint256)"
];

const CHAINS = {
  opBNB: {
    chainId: "0xCC",
    chainName: "opBNB Mainnet",
    rpcUrls: ["https://opbnb-mainnet-rpc.bnbchain.org"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrls: ["https://opbnbscan.com"]
  },
  BSC: {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrls: ["https://bscscan.com"]
  }
};

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask 또는 Rabby 지갑이 필요합니다.");
    return;
  }

  try {
    // 1️⃣ 계정 요청
    await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    // 2️⃣ 체인 확인
    const currentChain = await window.ethereum.request({
      method: "eth_chainId"
    });

    // 3️⃣ opBNB 아니면 자동 전환 시도
    if (currentChain !== CHAINS.opBNB.chainId) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAINS.opBNB.chainId }]
        });
      } catch (switchError) {
        // 체인 없으면 추가
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [CHAINS.opBNB]
          });
        } else {
          throw switchError;
        }
      }
    }

    // 4️⃣ ethers 연결
    provider = new ethers.providers.Web3Provider(window.ethereum)

    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    document.getElementById("wallet-btn").innerText =
      userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

    document.getElementById("wallet-btn").classList.add("connected");

    loadHexBalance();
    listenWalletEvents();

  } catch (err) {
    console.error("Wallet connect error:", err);
    alert("지갑 연결 실패");
  }
}

async function loadHexBalance() {
  const hex = new ethers.Contract(HEX_ADDRESS, HEX_ABI, provider);
  const decimals = await hex.decimals();
  const bal = await hex.balanceOf(userAddress);

  const formatted = Number(
    ethers.utils.formatUnits(bal, decimals)
  );

  document.getElementById("hex-balance").innerHTML =
    `<span class="hex-icon">⬡</span> ${formatted.toLocaleString()} HEX`;
}


function listenWalletEvents() {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}
