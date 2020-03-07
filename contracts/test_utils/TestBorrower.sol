pragma solidity ^0.6.1;

import "../utils/SafeERC20.sol";

import "../interfaces/IERC20.sol";
import "../interfaces/IBorrower.sol";
import "../AtomicErc20Loan.sol";


contract TestBorrower is IBorrower {
    using SafeERC20 for IERC20;

    AtomicErc20Loan public atomicErc20Loan;
    bool public returnTokens = true;

    constructor (AtomicErc20Loan _atomicErc20Loan) public {
        atomicErc20Loan = _atomicErc20Loan;
    }

    function setReturnTokens(bool _returnTokens) external {
        returnTokens = _returnTokens;
    }

    function signedAtomicLoan(
        IERC20 _token20,
        uint256 _amount,
        uint256 _price,
        bytes calldata _ownerSignature
    ) external {
        atomicErc20Loan.signedAtomicLoan(
            _token20,
            _amount,
            _price,
            _ownerSignature
        );
    }

    function onERC20Received(IERC20 _token, uint256 _amount, uint256 _price) external override {
        if (returnTokens)
            require(_token.safeApprove(address(atomicErc20Loan), _amount + _price), "onERC20Received: error approving atomicErc20Loan");
        else
            returnTokens = true;
    }
}