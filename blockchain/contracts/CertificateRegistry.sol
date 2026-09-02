// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertificateRegistry
/// @notice On-chain registry for student achievement certificates.
///         Only the full metadata lives on IPFS; the chain stores the CID
///         plus the minimum needed to verify a certificate independently.
contract CertificateRegistry {
    struct Certificate {
        uint256 studentId;
        string studentName;
        string course;
        string metadataCid;
        uint64 issuedAt;
        address issuer;
        bool revoked;
    }

    address public owner;

    mapping(address => bool) public issuers;
    mapping(bytes32 => Certificate) private _certificates;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _certificateIds;

    event IssuerAdded(address indexed account);
    event IssuerRemoved(address indexed account);
    event CertificateIssued(
        bytes32 indexed certificateId,
        uint256 indexed studentId,
        string metadataCid,
        address indexed issuer
    );
    event CertificateRevoked(bytes32 indexed certificateId, address indexed revokedBy);

    error NotOwner();
    error NotIssuer();
    error InvalidCertificateId();
    error CertificateExists();
    error CertificateNotFound();
    error AlreadyRevoked();
    error EmptyMetadataCid();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyIssuer() {
        if (!issuers[msg.sender]) revert NotIssuer();
        _;
    }

    constructor() {
        owner = msg.sender;
        issuers[msg.sender] = true;
        emit IssuerAdded(msg.sender);
    }

    function addIssuer(address account) external onlyOwner {
        issuers[account] = true;
        emit IssuerAdded(account);
    }

    function removeIssuer(address account) external onlyOwner {
        issuers[account] = false;
        emit IssuerRemoved(account);
    }

    /// @notice Deterministic id so the same certificate cannot be issued twice
    ///         and so a verifier can recompute the id from its inputs.
    function computeCertificateId(
        uint256 studentId,
        string calldata course,
        uint64 issuedAt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(studentId, course, issuedAt));
    }

    function issueCertificate(
        bytes32 certificateId,
        uint256 studentId,
        string calldata studentName,
        string calldata course,
        string calldata metadataCid,
        uint64 issuedAt
    ) external onlyIssuer {
        if (certificateId == bytes32(0)) revert InvalidCertificateId();
        if (_exists[certificateId]) revert CertificateExists();
        if (bytes(metadataCid).length == 0) revert EmptyMetadataCid();

        _certificates[certificateId] = Certificate({
            studentId: studentId,
            studentName: studentName,
            course: course,
            metadataCid: metadataCid,
            issuedAt: issuedAt,
            issuer: msg.sender,
            revoked: false
        });
        _exists[certificateId] = true;
        _certificateIds.push(certificateId);

        emit CertificateIssued(certificateId, studentId, metadataCid, msg.sender);
    }

    function revokeCertificate(bytes32 certificateId) external onlyIssuer {
        if (!_exists[certificateId]) revert CertificateNotFound();
        if (_certificates[certificateId].revoked) revert AlreadyRevoked();

        _certificates[certificateId].revoked = true;
        emit CertificateRevoked(certificateId, msg.sender);
    }

    /// @notice Primary verification entry point. Never reverts for an unknown
    ///         id, so a public verifier page can call it with arbitrary input.
    function verifyCertificate(bytes32 certificateId)
        external
        view
        returns (bool isValid, Certificate memory certificate)
    {
        if (!_exists[certificateId]) {
            return (false, certificate);
        }
        certificate = _certificates[certificateId];
        isValid = !certificate.revoked;
    }

    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) {
        if (!_exists[certificateId]) revert CertificateNotFound();
        return _certificates[certificateId];
    }

    function totalCertificates() external view returns (uint256) {
        return _certificateIds.length;
    }

    function certificateIdAt(uint256 index) external view returns (bytes32) {
        return _certificateIds[index];
    }
}
