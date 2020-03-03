pragma solidity ^0.6.1;

import "./utils/SafeERC20.sol";

import "./interfaces/IERC721.sol";
import "./interfaces/IERC20.sol";


/**
    @title Atomic Erc721 Loan
    @author Victor Fage <victorfage@gmail.com>
*/
contract AtomicErc721Loan {
    using SafeERC20 for IERC20;

    // Events

    event SignedAtomicLoan(
        IERC721 _token,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price,
        bytes _ownerSignature
    );

    event CancelSignature(bytes _ownerSignature);

    event ReApproveSignature(bytes _ownerSignature);

    mapping (address => mapping (bytes => bool)) public canceledSignatures;

    // External functions

    function signedAtomicLoan(
        IERC721 _token721,
        uint256 _tokenId,
        IERC20 _token20,
        uint256 _price,
        bytes calldata _ownerSignature
    ) external {
        bytes32 _hash = keccak256(
            abi.encodePacked(
                address(this),
                _token721,
                _tokenId,
                _token20,
                _price
            )
        );

        address owner = _ecrecovery(
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _hash
                )
            ),
            _ownerSignature
        );

        require(!canceledSignatures[owner][_ownerSignature], "signedAtomicLoan: The signature was canceled");

        _token721.safeTransferFrom(owner, msg.sender, _tokenId);

        _token721.safeTransferFrom(msg.sender, owner, _tokenId);

        if (_price != 0) {
            // Charge the loan price
            require(
                _token20.safeTransferFrom(msg.sender, owner, _price),
                "signedAtomicLoan: Error transfer erc20 tokens"
            );
        }

        emit SignedAtomicLoan(_token721, _tokenId, _token20, _price, _ownerSignature);
    }

    /**
        @notice Cancel a signature

        @param _ownerSignature The signature provided by the owner
    */
    function cancelSignature(bytes calldata _ownerSignature) external {
        canceledSignatures[msg.sender][_ownerSignature] = true;

        emit CancelSignature(_ownerSignature);
    }

    /**
        @notice Re-approve a signature

        @param _ownerSignature The signature provided by the owner
    */
    function reApproveSignature(bytes calldata _ownerSignature) external {
        canceledSignatures[msg.sender][_ownerSignature] = false;

        emit ReApproveSignature(_ownerSignature);
    }

    // Internal functions

    function _ecrecovery(bytes32 _hash, bytes memory _sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := and(mload(add(_sig, 65)), 255)
        }

        if (v < 27) {
            v += 27;
        }

        return ecrecover(_hash, v, r, s);
    }
}
