pragma solidity ^0.6.1;

import "./IERC20.sol";


interface IBorrower {
    function onERC20Received(IERC20 _token, uint256 _amount, uint256 _price) external;
}
