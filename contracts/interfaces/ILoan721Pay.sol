pragma solidity ^0.6.1;

import "./IERC20.sol";
import "./IERC721.sol";


interface ILoan721Pay {
    function pay(
        address _owner,
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price
    ) external;
}