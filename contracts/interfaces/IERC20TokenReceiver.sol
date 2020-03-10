pragma solidity ^0.6.1;

import "./IERC20.sol";


interface IERC20TokenReceiver {
    function onERC20Received(address _owner, IERC20 _token, uint256 _amount, uint256 _price) external;
}