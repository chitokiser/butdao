// /assets/js/config.js
window.APP = {
  // ─────────────────────────────────────────────
  // Chain
  // ─────────────────────────────────────────────
  chain: {
    name: "opBNB Mainnet",
    chainId: 204,
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    blockExplorer: "https://opbnbscan.com",
  },

  // ─────────────────────────────────────────────
  // Contracts
  // ─────────────────────────────────────────────
  contracts: {
    // A2E 메인 컨트랙트 (결제 수령 주소로도 사용)
    a2e: "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3",

    // 결제 토큰 (HexStableToken)
    hexToken: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464",
  },

  // ─────────────────────────────────────────────
  // ABI
  // ─────────────────────────────────────────────
  a2eAbi: [
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

    "function hexToken() view returns (address)",
    "function butbank() view returns (address)",

    "function join(address mento) returns (uint256)",
    "function renew(uint256 id, uint256 months)",
    "function claim(uint256 id, uint256 missionId, bytes32 proof)",
    "function cancelClaim(uint256 id, uint256 missionId)",
    "function withdraw(uint256 id)",

    "function approveClaim(uint256 id, uint256 missionId)",
    "function rejectClaim(uint256 id, uint256 missionId)",
    "function setAdPrice(uint256 missionId, uint256 v)",
    "function setTotalMember(uint256 p)",
    "function setPrice(uint256 v)",
    "function setMentoFee(uint256 v)",
    "function setBlacklist(uint256 id, bool b)",
    "function setLevel(uint256 id, uint8 lv)",
    "function flushFee()",

    "event Joined(uint256 indexed id, address indexed owner, address indexed mento, uint256 paid, uint256 until)",
    "event Renewed(uint256 indexed id, uint256 months, uint256 paid, uint256 until)",
    "event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof)",
    "event ClaimApprove(uint256 indexed id, uint256 indexed missionId, uint256 reward)",
    "event ClaimReject(uint256 indexed id, uint256 indexed missionId)",
    "event ClaimCancel(uint256 indexed id, uint256 indexed missionId)",
    "event Withdraw(uint256 indexed id, address indexed to, uint256 amount)",
  ],

  erc20Abi: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function transfer(address,uint256) returns (bool)",
  ],

  // ─────────────────────────────────────────────
  // Firebase (Firestore / Auth)
  // ─────────────────────────────────────────────
  firebase: {
    apiKey: "AIzaSyCoeMQt7UZzNHFt22bnGv_-6g15BnwCEBA",
    authDomain: "puppi-d67a1.firebaseapp.com",
    projectId: "puppi-d67a1",
    storageBucket: "puppi-d67a1.firebasestorage.app",
    messagingSenderId: "552900371836",
    appId: "1:552900371836:web:88fb6c6a7d3ca3c84530f9",
    measurementId: "G-9TZ81RW0PL",
    appCheckSiteKey: "6LduZMErAAAAAJHFSyn2sQMusMCrjFOpQ0YrrbHz",
  },

  // ─────────────────────────────────────────────
  // 광고(의뢰) 설정 병합
  // ─────────────────────────────────────────────
  ads: {
    // Firestore 컬렉션명
    ordersCollection: "ad_orders",

    // 결제 설정: HEX 토큰을 a2e 주소로 transfer
    payment: {
      chainId: 204,
      tokenSymbol: "HEX",
      tokenAddress: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464",
      receiver: "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3",
      explorerTx: "https://opbnbscan.com/tx/",
      decimalsFallback: 18,
    },

    // 상품 목록 (요청하신 문구 반영)
    services: [
      {
        id: 1,
        name: "구글 Blogger",
        base: "검색 반영 빠름, 장기 노출에 유리",
        required: "사진/제품설명/기타 · 약 100개 이상의 회원 블로그에 월 5회, 총 500회 게재",
        pricePaw: 300
      },
      {
        id: 2,
        name: "티스토리",
        base: "카카오 계열 블로그 + 구글 검색 노출 강함",
        required: "사진/제품설명/기타 · 약 100개 이상의 회원 블로그에 월 5회, 총 500회 게재",
        pricePaw: 300
      },
      {
        id: 3,
        name: "네이버 블로그",
        base: "국내 사용자 인지도 높음, 지역 키워드에 유리",
        required: "사진/제품설명/기타 · 약 100개 이상의 회원 블로그에 월 5회, 총 500회 게재",
        pricePaw: 300
      },
      {
        id: 4,
        name: "댓글 바이럴",
        base: "키워드 검색 후 블로그·유튜브·인스타그램 등 모든 콘텐츠에 댓글 작업",
        required: "100개 이상의 계정으로 총 3,000개 이상 댓글 작업",
        pricePaw: 100
      },
      {
        id: 5,
        name: "페이스북 게시",
        base: "다수 계정 기반 페이스북 콘텐츠 노출",
        required: "사진/설명 제공 · 100개 이상의 페이스북 계정으로 월 10회, 총 1000회 게재",
        pricePaw: 500
      },
      {
        id: 6,
        name: "SNS 연계 패키지",
        base: "블로그 + SNS 연계 노출",
        required: "사진/설명 제공 · 블로그 + 페이스북/인스타그램 동시 게시 하루 5회씩",
        pricePaw: 200
      },
      {
        id: 7,
        name: "유튜브 영상 리뷰 및 좋아요",
        base: "영상 기반 콘텐츠 신뢰도 강화",
        required: "해당 유튜브 콘텐츠에 서로 다른 계정으로 하루 100개씩, 총 3,000회 반응",
        pricePaw: 300
      },
      {
        id: 8,
        name: "유튜브 댓글 패키지",
        base: "유튜브 영상 초기 반응 활성화",
        required: "100개 이상의 계정으로 총 2,000개 이상 댓글 게재",
        pricePaw: 200
      },
      {
        id: 9,
        name: "인스타그램 확산",
        base: "해시태그 기반 노출 및 확산",
        required: "사진/설명 제공 · 100개 이상의 계정으로 게시물 및 스토리 5회씩 500회 게재",
        pricePaw: 300
      },
      {
        id: 10,
        name: "종합 바이럴 패키지",
        base: "블로그 + SNS + 댓글 종합 노출",
        required: "블로그·SNS·댓글 작업 포함 · 100개 이상의 계정으로 총 15,000회 이상 종합 게재",
        pricePaw: 700
      }
    ],
  },

  // ─────────────────────────────────────────────
  // 오프체인 미션 정의 (기존 유지)
  // ─────────────────────────────────────────────
  missions: [
    { id: 1, title: "구글 블로거", desc: "자신 블로그에 광고주 의뢰글 올리기" },
    { id: 2, title: "티스토리", desc: "SNS 공유 미션" },
    { id: 3, title: "네이버 블로그", desc: "댓글 또는 리뷰 작성" },
    { id: 4, title: "페이스북 활동", desc: "페이스북 게시/공유" },
    { id: 5, title: "단체 채팅방 참여", desc: "지정 채팅방 참여" },
    { id: 6, title: "네이버 밴드", desc: "밴드 게시글/댓글" },
  ],
};
