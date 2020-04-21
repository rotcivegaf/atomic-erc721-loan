pragma solidity ^0.6.1;

import "./utils/SafeMath.sol";
import "./utils/SafeERC20.sol";

import "./interfaces/IERC721.sol";
import "./interfaces/ILoan721Pay.sol";
import "./interfaces/IERC20.sol";


contract AtomicErc721Loan {
    using SafeMath for uint256;

    mapping (address => mapping (bytes32 => bool)) public canceledHashes;
    mapping (bytes32 => Loan) public loans;

    struct Loan {
        address owner;
        IERC721 token721;
        uint256 tokenId;
        IERC20 token20;
        uint256 price;
    }

    // Events

    event AtomicLoan(
        address _owner,
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    );

    event ApprobeAtomicLoan(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    );

    event CancelHash(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    );

    event ReApproveHash(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    );

    // External functions

    function approbeAtomicLoan(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    ) external {
        bytes32 loanHash = _calcHash(_token721, _tokenId, _token20, _price);

        if(canceledHashes[msg.sender][loanHash])
            reApproveHash(_token721, _tokenId, _token20, _price);

        loans[loanHash] = Loan({
            owner: msg.sender,
            token721: _token721,
            tokenId: _tokenId,
            token20: _token20,
            price: _price
        });

        emit ApprobeAtomicLoan(_token721, _tokenId, _token20, _price);
    }

    /**
        @notice Cancel a loan hash

        @param _token20 The address of the ERC20 token contract
    */
    function cancelHash(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    ) external {
        canceledHashes[msg.sender][_calcHash(_token721, _tokenId, _token20, _price)] = true;

        emit CancelHash(_token721, _tokenId, _token20, _price);
    }

    /**
        @notice Re-approve a Hash

        @param _token20 The address of the ERC20 token contract
    */
    function reApproveHash(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    ) public {
        canceledHashes[msg.sender][_calcHash(_token721, _tokenId, _token20, _price)] = false;

        emit ReApproveHash(_token721, _tokenId, _token20, _price);
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
        bytes32 loanHash = _calcHash(_token721, _tokenId, _token20, _price);
        address owner = ecrecover(
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    loanHash
                )
            ),
            _v,
            _r,
            _s
        );

        _atomicLoan(
            owner,
            _token721,
            _tokenId,
            _token20,
            _price,
            loanHash
        );
    }

    function atomicLoan(bytes32 _loanHash) external {
        Loan storage loan = loans[_loanHash];

        _atomicLoan(
            loan.owner,
            loan.token721,
            loan.tokenId,
            loan.token20,
            loan.price,
            _loanHash
        );
    }

    // Internal functions

    function _calcHash(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    ) internal view returns(bytes32) {
        return keccak256(
            abi.encodePacked(
                address(this),
                _token721,
                _tokenId,
                _token20,
                _price
            )
        );
    }

    function _atomicLoan(
        address _owner,
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price,
        bytes32 _loanHash
    ) internal {
        require(!canceledHashes[_owner][_loanHash], "_atomicLoan: The loan hash was canceled");

        uint256 ownerPrevBal = _token20.balanceOf(_owner);

        _token721.safeTransferFrom(_owner, msg.sender, _tokenId);

        ILoan721Pay(msg.sender).pay(_owner, _token721, _tokenId, _token20, _price);

        require(_token721.ownerOf(_tokenId) == _owner, "_atomicLoan: Error return erc721 token");

        require(_token20.balanceOf(_owner).sub(ownerPrevBal) == _price, "_atomicLoan: Error pay the loan price");

        emit AtomicLoan(_owner, _token721, _tokenId, _token20, _price);
    }
}