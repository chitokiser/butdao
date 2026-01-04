// /assets/js/config.js
window.APP = {
  chain: {
    name: "opBNB Mainnet",
    chainId: 204,
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    blockExplorer: "https://opbnbscan.com",
  },

  contracts: {
    a2e: "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3",
  },

  // a2e 컨트랙트 ABI (현재 pasted.sol 기준)
  a2eAbi: [
    // views
    "function admin() view returns (address)",
    "function staff(address) view returns (uint8)",
    "function totalMember() view returns (uint256)",
    "function nextId() view returns (uint256)",
    "function idOf(address) view returns (uint256)",

    "function price() view returns (uint256)",
    "function mentoFee() view returns (uint256)",
    "function claimCooldown() view returns (uint256)",
    "function withdrawCooldown() view returns (uint256)",
    "function seizeGrace() view returns (uint256)",

    "function adprice(uint256) view returns (uint256)",
    "function pending(uint256,uint256) view returns (uint8)",
    "function pendingCount() view returns (uint256)",
    "function pendingAt(uint256) view returns (uint256 id, uint256 missionId, address owner, uint64 reqAt, bytes32 proof)",

    "function myInfo(uint256) view returns (address owner, address mento, uint256 level, uint256 exp, uint256 mypay, uint256 totalpay, uint256 memberUntil, bool blacklisted)",
    "function claimInfo(uint256,uint256) view returns (uint8 status, uint64 reqAt, bytes32 proof, uint256 lastAt, uint256 price_)",
    "function contractHexBalance() view returns (uint256)",

    "function getDelinquents(uint256,uint256) view returns (uint256[] ids, address[] owners, uint64[] memberUntil)",

    // immutables (public getters)
    "function hexToken() view returns (address)",
    "function butbank() view returns (address)",

    // user tx
    "function join(address mento) returns (uint256)",
    "function renew(uint256 id, uint256 months)",
    "function claim(uint256 id, uint256 missionId, bytes32 proof)",
    "function cancelClaim(uint256 id, uint256 missionId)",
    "function withdraw(uint256 id)",

    // staff tx
    "function approveClaim(uint256 id, uint256 missionId)",
    "function rejectClaim(uint256 id, uint256 missionId)",
    "function setAdPrice(uint256 missionId, uint256 v)",
    "function setTotalMember(uint256 p)",
    "function setPrice(uint256 v)",
    "function setMentoFee(uint256 v)",
    "function setBlacklist(uint256 id, bool b)",
    "function setLevel(uint256 id, uint8 lv)",
    "function flushFee()",

    // events (옵션)
    "event Joined(uint256 indexed id, address indexed owner, address indexed mento, uint256 paid, uint256 until)",
    "event Renewed(uint256 indexed id, uint256 months, uint256 paid, uint256 until)",
    "event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof)",
    "event ClaimApprove(uint256 indexed id, uint256 indexed missionId, uint256 reward)",
    "event ClaimReject(uint256 indexed id, uint256 indexed missionId)",
    "event ClaimCancel(uint256 indexed id, uint256 indexed missionId)",
    "event Withdraw(uint256 indexed id, address indexed to, uint256 amount)",
  ],

  // ERC20 최소 ABI (approve/allowance/decimals/symbol)
  erc20Abi: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ],

  // 오프체인 미션 설명(예시). 여기 내용만 바꾸면 카드에 바로 반영됩니다.
  missions: [
    {
      id: 1,
      title: "광고 미션 1",
      desc: "광고주 페이지 방문 후 특정 액션 수행",
      guide: "예: 광고주 링크 클릭 → 스크롤 10초 → 특정 버튼 캡처",
      proofExample: "예: url=https://...; screenshot_hash=...; note=...",
    },
    {
      id: 2,
      title: "광고 미션 2",
      desc: "SNS 공유 미션",
      guide: "예: 인스타/페북 공유 후 공유 링크 제출",
      proofExample: "예: share_url=https://...; post_id=...",
    },
    {
      id: 3,
      title: "광고 미션 3",
      desc: "댓글/리뷰 작성 미션",
      guide: "예: 지정 문구 포함 댓글 작성 후 링크 제출",
      proofExample: "예: comment_url=https://...; username=...",
    },
  ],
};
