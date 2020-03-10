pragma solidity ^0.6.1;

import "./utils/SafeMath.sol";
import "./utils/SafeERC20.sol";

import "./interfaces/IERC20.sol";
import "./interfaces/IERC20TokenReceiver.sol";


/**
    @title Atomic Erc20 Loan
    @author Victor Fage <victorfage@gmail.com>
*/
contract AtomicErc20Loan {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    mapping (address => mapping (bytes32 => bool)) public canceledHashes;

    // Events

    event SignedAtomicLoan(
        address _owner,
        IERC20 _token20,
        uint256 _amount,
        uint256 _fee,
        bytes32 _loanHash
    );

    event CancelHash(IERC20 _token20, uint256 _fee);

    event ReApproveHash(IERC20 _token20, uint256 _fee);

    // 10000 ==  100%
    //   505 == 5.05%
    uint256 public BASE = 10000;

    // External functions

    /**
        @notice Cancel a loan hash

        @param _token20 The address of the ERC20 token contract
    */
    function signedAtomicLoan(
        IERC20 _token20,
        uint256 _fee,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        bytes32 loanHash = _calcHash(_token20, _fee);
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

        require(!canceledHashes[owner][loanHash], "signedAtomicLoan: The loan hash was canceled");

        uint256 approveAmount = _token20.allowance(owner, address(this));
        uint256 ownerPrevBal = _token20.balanceOf(owner);

        uint256 amount = approveAmount < ownerPrevBal ? approveAmount : ownerPrevBal;

        require(
            _token20.safeTransferFrom(owner, msg.sender, amount),
            "signedAtomicLoan: Error lend erc20 tokens"
        );

        uint256 price = _calcPrice(amount, _fee);

        IERC20TokenReceiver(msg.sender).onERC20Received(owner, _token20, amount, price);

        require(_token20.balanceOf(owner).sub(ownerPrevBal) == price, "signedAtomicLoan: Error recover erc20 token and pay the loan price");

        emit SignedAtomicLoan(owner, _token20, amount, _fee, loanHash);
    }

    /**
        @notice Cancel a loan hash

        @param _token20 The address of the ERC20 token contract
    */
    function cancelHash(IERC20 _token20, uint256 _fee) external {
        canceledHashes[msg.sender][_calcHash(_token20, _fee)] = true;

        emit CancelHash(_token20, _fee);
    }

    /**
        @notice Re-approve a Hash

        @param _token20 The address of the ERC20 token contract
    */
    function reApproveHash(IERC20 _token20, uint256 _fee) external {
        canceledHashes[msg.sender][_calcHash(_token20, _fee)] = false;

        emit ReApproveHash(_token20, _fee);
    }

    // Internal functions

    function _calcHash(IERC20 _token20, uint256 _fee) internal view returns(bytes32) {
        return keccak256(
            abi.encodePacked(
                address(this),
                _token20,
                _fee
            )
        );
    }

    function _calcPrice(
        uint256 _amount,
        uint256 _fee
    ) internal view returns(uint256) {
        return _amount.mul(_fee).div(BASE);
    }
}
