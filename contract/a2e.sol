// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
}

interface IbutBank {
    function totalfeeup(uint256 amount) external;
}

contract a2e{
    // ===== custom errors =====
    error NA();   // not admin
    error NS();   // not staff
    error Z();    // zero/invalid
    error ID();   // invalid id
    error OW();   // not owner
    error EX();   // expired/grace not passed
    error LV();   // not member
    error BL();   // blacklisted
    error CD();   // cooldown
    error AP();   // already pending
    error NP();   // not pending
    error SOLD(); // member over
    error TF();   // transfer failed
    error RG();   // bad range

    IERC20 public immutable hexToken;
    IbutBank public immutable butbank;

    address public admin;
    mapping(address => uint8) public staff; // >=5

    // 가입 제한
    uint256 public totalMember;

    struct User {
        address owner;
        address mento;
        uint64  memberUntil;
        uint64  lastWithdraw;
        uint8   level;   // 0 none, 1+ member
        uint8   black;   // 1 black
        uint256 exp;
        uint256 mypay;
        uint256 totalpay;
    }

    uint256 public nextId = 1;
    mapping(uint256 => User) public users;     // id => User
    mapping(address => uint256) public idOf;   // wallet => id

    // config
    uint256 public price;
    uint256 public mentoFee;
    uint256 public claimCooldown = 1 days;
    uint256 public withdrawCooldown = 1 days;
    uint256 public seizeGrace = 7 days;

    // missions
    mapping(uint256 => uint256) public adprice;

    // claim status
    // 0 none, 1 pending, 2 canceled/rejected, 3 approved
    mapping(uint256 => mapping(uint256 => uint8)) public pending;
    mapping(uint256 => mapping(uint256 => uint64))  public requestedAt;
    mapping(uint256 => mapping(uint256 => bytes32)) public proofHash;
    mapping(uint256 => mapping(uint256 => uint256)) public lastClaimAt;

    // pending list (심사중만)
    struct PendingKey {
        uint256 id;
        uint256 missionId;
    }
    PendingKey[] private pendingList;
    mapping(bytes32 => uint256) private pendingIndex; // index+1

    // fee -> butbank
    uint256 public feeAcc;
    uint256 public feeThreshold;
    uint256 public feeRate = 1000; // 10%
    uint256 public constant FEE_BASE = 10000;

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
    event TotalMemberSet(uint256 totalMember);
    event Joined(uint256 indexed id, address indexed owner, address indexed mento, uint256 paid, uint256 until);
    event Renewed(uint256 indexed id, uint256 months, uint256 paid, uint256 until);
    event OwnerChanged(uint256 indexed id, address indexed oldOwner, address indexed newOwner);

    event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof);
    event ClaimCancel(uint256 indexed id, uint256 indexed missionId);
    event ClaimApprove(uint256 indexed id, uint256 indexed missionId, uint256 reward);
    event ClaimReject(uint256 indexed id, uint256 indexed missionId);

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
    totalMember = 100;

    // genesis member (id = 1)
    uint256 id_ = nextId; // nextId is 1
    users[id_] = User({
        owner: msg.sender,
        mento: msg.sender,                     // 셀프 멘토(가장 안전)
        memberUntil: uint64(block.timestamp + 3650 days), // 충분히 길게
        lastWithdraw: 0,
        level: 2,                              // 멘토로 쓰려면 2 권장 (1도 가능)
        black: 0,
        exp: 0,
        mypay: 0,
        totalpay: 0
    });
    idOf[msg.sender] = id_;
    nextId = id_ + 1; // nextId = 2

    emit Joined(id_, msg.sender, msg.sender, 0, users[id_].memberUntil);
}

    // ===== admin/config =====
    function transferOwnership(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert Z();
        admin = newAdmin;
    }

    function setStaff(address a, uint8 lvl) external onlyAdmin {
        staff[a] = lvl;
        emit StaffSet(a, lvl);
    }

    function setTotalMember(uint256 p) external onlyStaff {
        totalMember = p;
        emit TotalMemberSet(p);
    }

    function setPrice(uint256 v) external onlyStaff { price = v; }
    function setMentoFee(uint256 v) external onlyStaff { mentoFee = v; }
    function setClaimCooldown(uint256 v) external onlyStaff { claimCooldown = v; }
    function setWithdrawCooldown(uint256 v) external onlyStaff { withdrawCooldown = v; }
    function setSeizeGrace(uint256 v) external onlyStaff { seizeGrace = v; }

    function setFeeThreshold(uint256 v) external onlyStaff { feeThreshold = v; }
    function setFeeRate(uint256 v) external onlyStaff {
        if (v > FEE_BASE) revert Z();
        feeRate = v;
    }

    function setBlacklist(uint256 id_, bool b) external onlyStaff validId(id_) {
        users[id_].black = b ? 1 : 0;
    }

    function setLevel(uint256 id_, uint8 lv) external onlyStaff validId(id_) {
        users[id_].level = lv;
    }

    function setAdPrice(uint256 missionId, uint256 v) external onlyStaff {
        adprice[missionId] = v;
    }

    // ===== pending list utils =====
    function _pkey(uint256 id_, uint256 missionId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(id_, missionId));
    }

    function _addPending(uint256 id_, uint256 missionId) internal {
        bytes32 k = _pkey(id_, missionId);
        if (pendingIndex[k] != 0) return;
        pendingList.push(PendingKey({ id: id_, missionId: missionId }));
        pendingIndex[k] = pendingList.length; // index+1
    }

    function _removePending(uint256 id_, uint256 missionId) internal {
        bytes32 k = _pkey(id_, missionId);
        uint256 idxPlus = pendingIndex[k];
        if (idxPlus == 0) return;

        uint256 idx = idxPlus - 1;
        uint256 last = pendingList.length - 1;

        if (idx != last) {
            PendingKey memory tail = pendingList[last];
            pendingList[idx] = tail;
            pendingIndex[_pkey(tail.id, tail.missionId)] = idx + 1;
        }

        pendingList.pop();
        delete pendingIndex[k];
    }

 // ===== join/renew =====
function join(address mento) external nonReentrant returns (uint256 id_) {
    if (idOf[msg.sender] != 0) revert Z();          // 이미 가입
    if (nextId > totalMember) revert SOLD();        // 정원 초과

    // 멘토 필수 + 기본 검증
    if (mento == address(0)) revert Z();            // 멘토 주소 필수
    if (mento == msg.sender) revert Z();            // 자기 자신 멘토 금지

    // 멘토가 "기존회원"인지 확인: idOf[mento]가 있어야 하고, level>0 이어야 함
    uint256 mid = idOf[mento];
    if (mid == 0) revert Z();                       // 멘토 미가입
    User storage mu = users[mid];
    if (mu.level == 0) revert Z();                  // 멘토가 회원 아님(안전)
    if (mu.black == 1) revert BL();                 // 블랙 멘토 금지(원하면 제거 가능)
    if (mu.memberUntil < block.timestamp) revert EX(); // 연체 멘토 금지(원하면 제거 가능)

    uint256 cost = price;
    if (cost == 0) revert Z();
    if (!hexToken.transferFrom(msg.sender, address(this), cost)) revert TF();

    id_ = nextId;
    nextId++;

    users[id_] = User({
        owner: msg.sender,
        mento: mento,
        memberUntil: uint64(block.timestamp + 30 days),
        lastWithdraw: 0,
        level: 1,
        black: 0,
        exp: 0,
        mypay: 0,
        totalpay: 0
    });

    idOf[msg.sender] = id_;
    _takeFee(cost);

    emit Joined(id_, msg.sender, mento, cost, users[id_].memberUntil);
}


    function renew(uint256 id_, uint256 months) external nonReentrant validId(id_) onlyIdOwner(id_) {
        if (months == 0) revert Z();

        uint256 cost = price * months;
        if (cost == 0) revert Z();
        if (!hexToken.transferFrom(msg.sender, address(this), cost)) revert TF();

        User storage u = users[id_];
        uint256 base = u.memberUntil;
        if (base < block.timestamp) base = block.timestamp;
        u.memberUntil = uint64(base + (months * 30 days));

        _takeFee(cost);
        emit Renewed(id_, months, cost, u.memberUntil);
    }

    // 연체 + 유예기간 이후 소유권 변경
    function seizeOwner(uint256 id_, address newOwner) external onlyStaff validId(id_) {
        if (newOwner == address(0)) revert Z();

        User storage u = users[id_];
        address old = u.owner;
        if (old == address(0)) revert Z();

        if (block.timestamp <= uint256(u.memberUntil) + seizeGrace) revert EX();
        if (idOf[newOwner] != 0) revert Z();

        if (idOf[old] == id_) idOf[old] = 0;
        u.owner = newOwner;
        idOf[newOwner] = id_;

        emit OwnerChanged(id_, old, newOwner);
    }

    function transferId(uint256 id_, address newOwner) external validId(id_) onlyIdOwner(id_) {
        if (newOwner == address(0)) revert Z();
        if (idOf[newOwner] != 0) revert Z();

        address old = users[id_].owner;
        users[id_].owner = newOwner;
        idOf[old] = 0;
        idOf[newOwner] = id_;

        emit OwnerChanged(id_, old, newOwner);
    }

    // ===== claim/approve/reject =====
    function claim(uint256 id_, uint256 missionId, bytes32 proof) external validId(id_) onlyIdOwner(id_) {
        User storage u = users[id_];
        if (u.black == 1) revert BL();
        if (u.level == 0) revert LV();
        if (u.memberUntil < block.timestamp) revert EX();

        uint256 base = adprice[missionId];
        if (base == 0) revert Z();

        uint256 last = lastClaimAt[id_][missionId];
        if (block.timestamp < last + claimCooldown) revert CD();

        if (pending[id_][missionId] == 1) revert AP();

        pending[id_][missionId] = 1;
        requestedAt[id_][missionId] = uint64(block.timestamp);
        proofHash[id_][missionId] = proof;

        _addPending(id_, missionId);

        emit ClaimReq(id_, missionId, proof);
    }

    function cancelClaim(uint256 id_, uint256 missionId) external validId(id_) onlyIdOwner(id_) {
        if (pending[id_][missionId] != 1) revert NP();

        pending[id_][missionId] = 2;
        lastClaimAt[id_][missionId] = block.timestamp;
        _removePending(id_, missionId);

        emit ClaimCancel(id_, missionId);
    }

    function approveClaim(uint256 id_, uint256 missionId) external onlyStaff validId(id_) {
        if (pending[id_][missionId] != 1) revert NP();

        uint256 base = adprice[missionId];
        if (base == 0) revert Z();

        uint256 grade = users[id_].level;
        uint256 reward = (base * grade) / 10;

        users[id_].mypay += reward;
        users[id_].exp += reward / 1e16;

        pending[id_][missionId] = 3;
        lastClaimAt[id_][missionId] = block.timestamp;

        _removePending(id_, missionId);

        emit ClaimApprove(id_, missionId, reward);
    }

    function rejectClaim(uint256 id_, uint256 missionId) external onlyStaff validId(id_) {
        if (pending[id_][missionId] != 1) revert NP();

        pending[id_][missionId] = 2;
        lastClaimAt[id_][missionId] = block.timestamp;

        _removePending(id_, missionId);

        emit ClaimReject(id_, missionId);
    }

    // ===== withdraw =====
    function withdraw(uint256 id_) external nonReentrant validId(id_) onlyIdOwner(id_) {
        User storage u = users[id_];
        if (u.black == 1) revert BL();
        if (u.level == 0) revert LV();
        if (u.memberUntil < block.timestamp) revert EX();

        uint256 lastW = u.lastWithdraw;
        if (block.timestamp < lastW + withdrawCooldown) revert CD();

        uint256 amount = u.mypay;
        if (amount == 0) revert Z();

        u.mypay = 0;
        u.totalpay += amount;
        u.lastWithdraw = uint64(block.timestamp);

        address mento = u.mento;
        if (mento != address(0) && mentoFee != 0) {
            uint256 mid = idOf[mento];
            if (mid != 0 && users[mid].level != 0 && users[mid].black == 0) {
                uint256 cut = (amount * mentoFee) / 100;
                users[mid].mypay += cut;
            }
        }

        if (!hexToken.transfer(msg.sender, amount)) revert TF();
        emit Withdraw(id_, msg.sender, amount);
    }

    // ===== fee =====
    function _takeFee(uint256 gross) internal {
        if (feeRate == 0) return;
        feeAcc += (gross * feeRate) / FEE_BASE;
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

    function flushFee() external onlyStaff nonReentrant {
        _flushFee();
    }

    // ===== admin 업무용 get =====
    function pendingCount() external view returns (uint256) {
        return pendingList.length;
    }

function pendingAt(uint256 index)
    external
    view
    onlyStaff
    returns (
        uint256 id,
        uint256 missionId,
        address owner,
        uint64 reqAt,
        bytes32 proof
    )
{
    require(index < pendingList.length, "OOB");
    PendingKey memory pk = pendingList[index];
    id = pk.id;
    missionId = pk.missionId;
    owner = users[id].owner;
    reqAt = requestedAt[id][missionId];
    proof = proofHash[id][missionId];
}


    // ===== 연체자 get =====
    function getDelinquents(uint256 startId, uint256 endId)
        external
        view
        onlyStaff
        returns (
            uint256[] memory ids,
            address[] memory owners,
            uint64[] memory memberUntil
        )
    {
        if (startId == 0 || endId < startId) revert RG();
        if (endId >= nextId) endId = nextId - 1;

        uint256 c = 0;
        for (uint256 id_ = startId; id_ <= endId; id_++) {
            User storage u = users[id_];
            if (u.owner != address(0) && u.level != 0 && u.memberUntil < block.timestamp) c++;
        }

        ids = new uint256[](c);
        owners = new address[](c);
        memberUntil = new uint64[](c);

        uint256 k = 0;
        for (uint256 id_ = startId; id_ <= endId; id_++) {
            User storage u = users[id_];
            if (u.owner != address(0) && u.level != 0 && u.memberUntil < block.timestamp) {
                ids[k] = id_;
                owners[k] = u.owner;
                memberUntil[k] = u.memberUntil;
                k++;
            }
        }
    }

    // ===== views =====
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
            uint8 status,
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

    function contractHexBalance() external view returns (uint256) {
        return hexToken.balanceOf(address(this));
    }
}
