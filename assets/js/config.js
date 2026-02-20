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

    // 광고 상품 목록 (요청하신 문구 반영)
    services: [
      {
        id: 1,
        name: "구글 Blogger 의뢰인 컨덴츠 게재",
        base: "검색 반영 빠름, 장기 노출에 유리",
        required: "사진/제품설명/기타 · 기본100개 이상의 회원 블로그에 매일100개 3000번이상 포스팅",
        pricePaw: 500
      },
         {
        id: 2,
        name: "구글 Blogger 활성화",
        base: "의뢰인 구글 Blogger에 댓글 달기 ",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건 이상",
        pricePaw: 300
      },
      {
        id: 3,
        name: "티스토리",
        base: "카카오 계열 블로그 + 구글 검색 노출 강함",
        required: "사진/제품설명/기타 · 기본 100개 이상의 회원 블로그에 매일100개 ,3000번이상 포스팅",
        pricePaw: 500
      },
       {
        id: 4,
        name: "티스토리 활성화",
        base: "의뢰인 티스토리에 댓글,좋아요,구독하기 ",
        required: "약 100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
   
  
      {
        id: 5,
        name: "유튜브 활성화",
        base: "의뢰인 유투브 채널에 댓글 좋아요 구독 ",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
      {
        id: 6,
        name: "인스타그램 게재",
        base: "해시태그 기반 노출 및 확산",
        required: "사진/설명 제공 · 100개 이상의 계정으로 매일 100개 3000회 이상 게재",
        pricePaw: 500
      },
      
      {
       id: 7,
        name: "인스타그램 확산",
        base: "의뢰인 인스타그램 채널에 좋아요 댓글 공유하기",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
         {
        id: 8,
        name: "페이스북 게재",
        base: "사진/내용 캠페인등",
        required: "100개 이상의 계정으로 매일 100개 3000회 이상 게재",
        pricePaw: 300
      },
      
      {
       id: 9,
        name: "페이스북 확산",
        base: "의뢰인 페이스북 채널에 좋아요 댓글 공유하기",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
      {
        id: 10,
        name: "카카오 오픈채팅방 활성화",
        base: "의뢰인이 지정한 오픈채팅방에 참여",
        required: "100개 이상의 계정으로 하루 500건 *30일 채팅",
        pricePaw: 300
      },
    

    ],
  },

  // ─────────────────────────────────────────────
  // 오프체인 미션 정의 (기존 유지)
  // ─────────────────────────────────────────────
missions: [
  {
    id: 1,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },
 
  {
    id: 2,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 3,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 4,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 5,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 6,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 7,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 8,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 9,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 10,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

   {
    id: 11,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

    {
    id: 12,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  },

    {
    id: 13,
    title: "하단에 가이드를 보시고 성실히 미션에 임해 주세요",
    desc: "미션 불성실 또는 누락 청구시 제재조치 합니다"
  }

],

   missionGuideCollection: "mission_guides"
};
