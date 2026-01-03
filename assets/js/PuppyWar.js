// =====================================
// 주소 설정
// =====================================
const HEX_TOKEN_ADDRESS = "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464";
const PUPPYWAR_ADDRESS  = "0x5Ee72e142996e3871caC3dDA789EdE48f9F9f976";



const PUPPYWAR_ABI = [
  "function play(uint8 _winnum,uint256 pay) external",
  "event Result(address indexed user,uint256 home,uint256 away)",
  "event Reward(address indexed user,uint256 amount)",
  "event Loss(address indexed user,uint256 amount)"
];

// =====================================
// UI (강아지)
// =====================================
function createDog(teamId, index) {
  const wrap = document.createElement("div");
  wrap.className = "dog-wrapper";

  const hp = document.createElement("div");
  hp.className = "hp-bar";
  hp.style.width = "100%";

  const img = document.createElement("img");
  img.className = "dog";
  img.src = `assets/img/puppy/${index + 1}.png`;

  wrap.appendChild(hp);
  wrap.appendChild(img);

  document.getElementById(teamId).appendChild(wrap);
}

function initDogs() {
  const home = document.getElementById("homeTeam");
  const away = document.getElementById("awayTeam");

  home.innerHTML = "";
  away.innerHTML = "";

  for (let i = 0; i < 10; i++) {
    createDog("homeTeam", i);
    createDog("awayTeam", i);
  }
}

function battleAnimation(home, away) {
  document.querySelectorAll("#homeTeam .hp-bar")
    .forEach(el => el.style.width = `${away * 10}%`);

  document.querySelectorAll("#awayTeam .hp-bar")
    .forEach(el => el.style.width = `${home * 10}%`);
}

// =====================================
// 메인 게임 로직
// =====================================
async function playGame(choice) {
  try {
    if (!window.ethereum) {
      alert("MetaMask가 필요합니다");
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const user = await signer.getAddress();

    const hex  = new ethers.Contract(HEX_TOKEN_ADDRESS, HEX_ABI, signer);
    const game = new ethers.Contract(PUPPYWAR_ADDRESS, PUPPYWAR_ABI, signer);

    const betInput = document.getElementById("bettingAmount");
    const amount = ethers.BigNumber.from(betInput.value || "0");

    if (amount.lte(0)) {
      alert("HEX 금액을 입력하세요");
      return;
    }

    // 1️⃣ allowance 확인
    const allowance = await hex.allowance(user, PUPPYWAR_ADDRESS);

    if (allowance.lt(amount)) {
      document.getElementById("statusMessage").innerText = "🔐 HEX 승인중...";
      const txApprove = await hex.approve(
        PUPPYWAR_ADDRESS,
        ethers.constants.MaxUint256
      );
      await txApprove.wait();
    }

    // 2️⃣ 게임 실행
    document.getElementById("statusMessage").innerText = "⚔️ 전투중...";
    const txPlay = await game.play(choice, amount);
    await txPlay.wait();

  } catch (e) {
    console.error(e);
    alert(e.message || "트랜잭션 실패");
  }
}

// =====================================
// 이벤트 리스너
// =====================================
async function initEvents() {
  if (!window.ethereum) return;

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const user = (await signer.getAddress()).toLowerCase();

  const game = new ethers.Contract(PUPPYWAR_ADDRESS, PUPPYWAR_ABI, signer);
  game.removeAllListeners();

  game.on("Result", (addr, home, away) => {
    if (addr.toLowerCase() !== user) return;
    battleAnimation(home, away);
  });

  game.on("Reward", (addr, amount) => {
    if (addr.toLowerCase() !== user) return;
    document.getElementById("statusMessage").innerText =
      `🎉 WIN +${amount.toString()} HEX`;
  });

  game.on("Loss", (addr, amount) => {
    if (addr.toLowerCase() !== user) return;
    document.getElementById("statusMessage").innerText =
      `💔 LOSE -${amount.toString()} HEX`;
  });
}

// =====================================
// DOM 로딩 후 실행
// =====================================
window.addEventListener("DOMContentLoaded", () => {
  initDogs();
  initEvents();

  document.getElementById("btnHome").onclick = () => playGame(1);
  document.getElementById("btnDraw").onclick = () => playGame(2);
  document.getElementById("btnAway").onclick = () => playGame(3);
});
