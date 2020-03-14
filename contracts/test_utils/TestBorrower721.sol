pragma solidity ^0.6.1;

import "../interfaces/IERC721.sol";
import "../interfaces/IERC721TokenReceiver.sol";
import "../interfaces/ILoan721Pay.sol";
import "../AtomicErc721Loan.sol";


contract TestBorrower721 is IERC721TokenReceiver, ILoan721Pay {
    using SafeERC20 for IERC20;
    AtomicErc721Loan public atomicErc721Loan;
    bool public returnToken = true;
    bool public payPrice = true;

    bytes4 private constant ERC721_RECEIVED = 0x150b7a02;
    bytes4 private constant ERC721_RECEIVED_LEGACY = 0xf0b9e5ba;

    constructor (AtomicErc721Loan _atomicErc721Loan) public {
        atomicErc721Loan = _atomicErc721Loan;
    }

    function setPayPrice(bool _payPrice) external {
        payPrice = _payPrice;
    }

    function setReturnToken(bool _returnToken) external {
        returnToken = _returnToken;
    }

    function signedAtomicLoan(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        atomicErc721Loan.signedAtomicLoan(
            _token721,
            _tokenId,
            _token20,
            _price,
            _v,
            _r,
            _s
        );
    }

    function onERC721Received(address, address _from, uint256 _tokenId, bytes calldata) external override returns(bytes4) {
        _onERC721Received(_from, _tokenId);

        return ERC721_RECEIVED;
    }

    function onERC721Received(address _from, uint256 _tokenId, bytes calldata) external override returns(bytes4) {
        _onERC721Received(_from, _tokenId);

        return ERC721_RECEIVED_LEGACY;
    }

    function pay(
        address _owner,
        IERC721,
        uint256,
        IERC20 _token20,
        uint256 _price
    ) external override {
        if (payPrice)
            require(_token20.safeTransfer(_owner, _price), "pay: error transfer erc20 tokens");
        payPrice = true;
    }

    function _onERC721Received(address _from, uint256 _tokenId) internal {
        if (returnToken)
            IERC721(msg.sender).transferFrom(address(this), _from, _tokenId);
        returnToken = true;
    }
}