pragma solidity ^0.6.1;

import "../utils/SafeERC20.sol";

import "../interfaces/IERC20.sol";
import "../interfaces/IERC20TokenReceiver.sol";
import "../AtomicErc20Loan.sol";


contract TestBorrower20 is IERC20TokenReceiver {
    using SafeERC20 for IERC20;

    AtomicErc20Loan public atomicErc20Loan;

    enum Action { RETURN_PAY, NOT_RETURN, NOT_PAY }
    Action public action;

    constructor (AtomicErc20Loan _atomicErc20Loan) public {
        atomicErc20Loan = _atomicErc20Loan;
    }

    function setNotReturn() external {
        action = Action.NOT_RETURN;
    }

    function setNotPay() external {
        action = Action.NOT_PAY;
    }

    function signedAtomicLoan(
        IERC20 _token20,
        uint256 _fee,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        atomicErc20Loan.signedAtomicLoan(
            _token20,
            _fee,
            _v,
            _r,
            _s
        );
    }

    function batchSignedAtomicLoan(
        IERC20[] calldata _token20,
        uint256[] calldata _fee,
        uint8[] calldata _v,
        bytes32[] calldata _r,
        bytes32[] calldata _s
    ) external {
        for (uint256 i; i < _token20.length; i ++)
            atomicErc20Loan.signedAtomicLoan(
                _token20[i],
                _fee[i],
                _v[i],
                _r[i],
                _s[i]
            );
    }

    function onERC20Received(address _owner, IERC20 _token, uint256 _amount, uint256 _price) external override {
        if (action == Action.RETURN_PAY)
            require(_token.safeTransfer(_owner, _amount + _price),"onERC20Received: error transfer atomicErc20Loan");
        else if (action == Action.NOT_PAY)
            require(_token.safeTransfer(_owner, _amount),"onERC20Received: error transfer atomicErc20Loan");

        action = Action.RETURN_PAY;
    }
}