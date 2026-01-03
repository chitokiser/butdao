// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address from, address to, uint256 v) external returns (bool);
}

interface IbutBank {
    function totalfeeup(uint256 amount) external;
}

/*
a2e id-slot model (연체 시 owner 교체 가능)
- 사용자 권한은 "id의 owner"로 체크
- 회원권, 미션요청, 적립금은 id에 귀속
- join/payMembership 결제액의 10% 누적 → feeThreshold 이상이면 butbank로 자동 이체
- ID(구글/카카오 등)는 온체인 저장 금지(오프체인)
*/
contract a2e {
    error NA(); // not admin
    error NS(); // not staff
    error Z();  // invalid/zero
    error TF(); // transfer fail
    error LV(); // not member
    error EX(); // expired
    error AP(); // already pending
    error NP(); // no pending
    error CD(); // cooldown
    error MT(); // invalid mentor
    error OW(); // not owner
    error ID(); // invalid id

    IERC20 public immutable hexToken;
    IbutBank public butbank;
    address public admin;

    mapping(address => uint8) public staff; // >=5

    // membership
    uint256 public price; // 월 회비(HEX 18d)
    uint256 public claimCooldown = 1 days;
    uint256 public withdrawCooldown = 1 days;

    // 연체 후 owner 교체 가능 유예기간
    uint256 public seizeGrace = 7 days;

    // mentor
    uint256 public mentoFee; // 0~100 (%), 기본 10

    // fee to butbank
    uint256 public constant FEE_BASE = 10000;
    uint256 public constant FEE_RATE = 1000; // 10%
    uint256 public feeAcc;
    uint256 public feeThreshold; // 0이면 자동이체 비활성

    // ids
    uint256 public nextId = 1;
    mapping(address => uint256) public idOf; // 주소가 현재 소유한 id(단일 슬롯 모델)

    struct User {
        address owner;       // 현재 주인(연체 시 교체됨)
        address mento;       // 멘토(선택)
        uint64 level;        // 0 none, 1 member
        uint64 black;        // 0/1
        uint64 lastWithdraw; // timestamp
        uint256 memberUntil; // 만료시각
        uint256 exp;
        uint256 mypay;
        uint256 totalpay;
    }

    mapping(uint256 => User) public users;

    // missions
    mapping(uint256 => uint256) public adprice; // missionId -> reward base
    mapping(uint256 => mapping(uint256 => bool)) public pending;         // id => missionId => pending
    mapping(uint256 => mapping(uint256 => uint64)) public requestedAt;   // id => missionId => ts
    mapping(uint256 => mapping(uint256 => bytes32)) public proofHash;    // id => missionId => proof
    mapping(uint256 => mapping(uint256 => uint256)) public lastClaimAt;  // id => missionId => ts

    // reentrancy
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "R");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NA();
        _;
    }

    modifier onlyStaff() {
        if (staff[msg.sender] < 5) revert NS();
        _;
    }

    modifier validId(uint256 id_) {
        if (id_ == 0 || id_ >= nextId) revert ID();
        _;
    }

    modifier onlyIdOwner(uint256 id_) {
        if (users[id_].owner != msg.sender) revert OW();
        _;
    }

    event StaffSet(address indexed a, uint8 lvl);
    event Joined(uint256 indexed id, address indexed owner, address indexed mento, uint256 paid, uint256 until);
    event Renewed(uint256 indexed id, uint256 months, uint256 paid, uint256 until);
    event OwnerChanged(uint256 indexed id, address indexed oldOwner, address indexed newOwner);
    event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof);
    event ClaimRes(uint256 indexed id, uint256 indexed missionId, uint256 reward);
    event Withdraw(uint256 indexed id, address indexed to, uint256 amount);
    event FeeMoved(uint256 amount);

    constructor(address _hexToken, address _butbank) {
        if (_hexToken == address(0) || _butbank == address(0)) revert Z();
        hexToken = IERC20(_hexToken);
        butbank = IbutBank(_butbank);

        admin = msg.sender;
        staff[msg.sender] = 10;

        price = 10e18;
        mentoFee = 10;
        feeThreshold = 10e18;
    }

    // admin ops
    function transferOwnership(address n) external onlyAdmin {
        if (n == address(0)) revert Z();
        admin = n;
    }

    function setStaff(address a, uint8 lvl) external onlyAdmin {
        staff[a] = lvl;
        emit StaffSet(a, lvl);
    }

    function setButbank(address b) external onlyAdmin {
        if (b == address(0)) revert Z();
        butbank = IbutBank(b);
    }

    function setPrice(uint256 p) external onlyAdmin {
        if (p == 0) revert Z();
        price = p;
    }

    function setMentoFee(uint256 pct) external onlyAdmin {
        if (pct > 100) revert Z();
        mentoFee = pct;
    }

    function setCooldowns(uint256 claimCd, uint256 withdrawCd) external onlyAdmin {
        claimCooldown = claimCd;
        withdrawCooldown = withdrawCd;
    }

    function setFeeThreshold(uint256 th) external onlyAdmin {
        feeThreshold = th; // 0이면 자동이체 off
    }

    function setSeizeGrace(uint256 g) external onlyAdmin {
        seizeGrace = g;
    }

    function setAdPrice(uint256 missionId, uint256 p) external onlyStaff {
        adprice[missionId] = p; // 0이면 비활성
    }

    function setBlacklist(uint256 id_, bool b) external onlyAdmin validId(id_) {
        users[id_].black = b ? 1 : 0;
    }

    // join: 새 id 생성(단일 슬롯 모델: 주소는 1개 id만 소유)
    function join(address mento) external nonReentrant {
        if (idOf[msg.sender] != 0) revert Z(); // 이미 id 보유
        if (mento != address(0)) {
            uint256 mid = idOf[mento];
            if (mid == 0) revert MT();
            if (users[mid].level == 0) revert MT();
        }

        if (!hexToken.transferFrom(msg.sender, address(this), price)) revert TF();

        uint256 id_ = nextId;
        nextId = id_ + 1;

        idOf[msg.sender] = id_;

        User storage u = users[id_];
        u.owner = msg.sender;
        u.mento = mento;
        u.level = 1;
        u.memberUntil = block.timestamp + 30 days;

        _takeFee(price);

        emit Joined(id_, msg.sender, mento, price, u.memberUntil);
    }

    // 갱신: id owner만 가능
    function payMembership(uint256 id_, uint256 months) external nonReentrant validId(id_) onlyIdOwner(id_) {
        if (months == 0) revert Z();
        User storage u = users[id_];
        if (u.level == 0) revert LV();

        uint256 cost = price * months;
        if (!hexToken.transferFrom(msg.sender, address(this), cost)) revert TF();

        uint256 base = u.memberUntil;
        if (base < block.timestamp) base = block.timestamp;
        u.memberUntil = base + (months * 30 days);

        _takeFee(cost);

        emit Renewed(id_, months, cost, u.memberUntil);
    }

    // 연체/운영 목적 owner 교체
    // 조건: memberUntil + seizeGrace < now (연체 유예 지나야)
    function seizeOwner(uint256 id_, address newOwner) external onlyAdmin validId(id_) {
        if (newOwner == address(0)) revert Z();

        User storage u = users[id_];
        if (u.owner == address(0)) revert Z();

        // 연체 조건
        if (block.timestamp <= u.memberUntil + seizeGrace) revert EX();

        address old = u.owner;

        // 기존 소유자 address->id 연결 제거(단일 슬롯 모델)
        if (idOf[old] == id_) {
            idOf[old] = 0;
        }

        // 새 소유자가 이미 다른 id를 가지고 있으면 불가(단일 슬롯 유지)
        if (idOf[newOwner] != 0) revert Z();

        u.owner = newOwner;
        idOf[newOwner] = id_;

        emit OwnerChanged(id_, old, newOwner);
    }

    // 유저 자발적 양도(운영상 필요하면)
    function transferId(uint256 id_, address newOwner) external validId(id_) onlyIdOwner(id_) {
        if (newOwner == address(0)) revert Z();
        if (idOf[newOwner] != 0) revert Z();

        address old = users[id_].owner;

        users[id_].owner = newOwner;
        idOf[old] = 0;
        idOf[newOwner] = id_;

        emit OwnerChanged(id_, old, newOwner);
    }

    // claim: id owner만 가능
    function claim(uint256 id_, uint256 missionId, bytes32 proof) external validId(id_) onlyIdOwner(id_) {
        User storage u = users[id_];
        if (u.black == 1) revert Z();
        if (u.level == 0) revert LV();
        if (u.memberUntil < block.timestamp) revert EX();

        uint256 last = lastClaimAt[id_][missionId];
        if (block.timestamp < last + claimCooldown) revert CD();

        if (pending[id_][missionId]) revert AP();
        if (adprice[missionId] == 0) revert Z();

        pending[id_][missionId] = true;
        requestedAt[id_][missionId] = uint64(block.timestamp);
        proofHash[id_][missionId] = proof;

        emit ClaimReq(id_, missionId, proof);
    }

    function cancelClaim(uint256 id_, uint256 missionId) external validId(id_) onlyIdOwner(id_) {
        if (!pending[id_][missionId]) revert NP();

        pending[id_][missionId] = false;
        lastClaimAt[id_][missionId] = block.timestamp;

        delete requestedAt[id_][missionId];
        delete proofHash[id_][missionId];
    }

    // staff 승인
    function resolveClaim(uint256 id_, uint256 missionId) external onlyStaff validId(id_) {
        if (!pending[id_][missionId]) revert NP();

        uint256 base = adprice[missionId];
        if (base == 0) revert Z();

        uint256 reward = base;

        users[id_].mypay += reward;
        users[id_].exp += reward / 1e16;

        pending[id_][missionId] = false;
        lastClaimAt[id_][missionId] = block.timestamp;

        delete requestedAt[id_][missionId];
        delete proofHash[id_][missionId];

        emit ClaimRes(id_, missionId, reward);
    }

    // withdraw: id owner만 가능, 출금은 "현재 owner"에게 나감
    function withdraw(uint256 id_) external nonReentrant validId(id_) onlyIdOwner(id_) {
        User storage u = users[id_];
        if (u.level == 0) revert LV();
        if (u.memberUntil < block.timestamp) revert EX();
        if (u.black == 1) revert Z();

        uint256 lastW = u.lastWithdraw;
        if (block.timestamp < lastW + withdrawCooldown) revert CD();

        uint256 amount = u.mypay;
        if (amount == 0) revert Z();

        u.mypay = 0;
        u.totalpay += amount;
        u.lastWithdraw = uint64(block.timestamp);

        // 멘토 수당: 출금액의 mentoFee%를 멘토 id의 mypay로 적립
        address mento = u.mento;
        if (mento != address(0) && mentoFee != 0) {
            uint256 mid = idOf[mento];
            if (mid != 0 && users[mid].level != 0) {
                uint256 cut = (amount * mentoFee) / 100;
                users[mid].mypay += cut;
            }
        }

        if (!hexToken.transfer(msg.sender, amount)) revert TF();
        emit Withdraw(id_, msg.sender, amount);
    }

    function _takeFee(uint256 gross) internal {
        feeAcc += (gross * FEE_RATE) / FEE_BASE;
        _flushFee();
    }

    function _flushFee() internal {
        uint256 th = feeThreshold;
        if (th == 0) return;
        uint256 acc = feeAcc;
        if (acc < th) return;

        feeAcc = 0;

        if (!hexToken.transfer(address(butbank), acc)) revert TF();
        butbank.totalfeeup(acc);
        emit FeeMoved(acc);
    }

    function flushFee() external onlyAdmin nonReentrant {
        _flushFee();
    }

    // view helpers
    function myInfo(uint256 id_)
        external
        view
        validId(id_)
        returns (
            address owner,
            address mento,
            uint256 level,
            uint256 exp,
            uint256 mypay,
            uint256 totalpay,
            uint256 memberUntil,
            bool blacklisted
        )
    {
        User storage u = users[id_];
        return (u.owner, u.mento, u.level, u.exp, u.mypay, u.totalpay, u.memberUntil, u.black == 1);
    }

    function claimInfo(uint256 id_, uint256 missionId)
        external
        view
        validId(id_)
        returns (
            bool isPending,
            uint64 reqAt,
            bytes32 proof,
            uint256 lastAt,
            uint256 price_
        )
    {
        return (
            pending[id_][missionId],
            requestedAt[id_][missionId],
            proofHash[id_][missionId],
            lastClaimAt[id_][missionId],
            adprice[missionId]
        );
    }
}
