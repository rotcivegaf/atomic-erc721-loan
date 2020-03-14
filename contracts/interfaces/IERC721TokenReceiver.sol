pragma solidity ^0.6.1;


interface IERC721TokenReceiver {
    function onERC721Received(address _operator, address _from, uint256 _tokenId, bytes calldata _data) external returns(bytes4);
    function onERC721Received(address _from, uint256 _assetId, bytes calldata _data) external returns(bytes4);
}