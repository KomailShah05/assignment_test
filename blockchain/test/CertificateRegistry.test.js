const { expect } = require("chai");
const { ethers } = require("hardhat");

const CID = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";

describe("CertificateRegistry", function () {
  let registry, owner, issuer, outsider;

  const sample = {
    studentId: 42n,
    studentName: "Ayesha Khan",
    course: "Advanced Mathematics",
    issuedAt: 1735689600n // 2025-01-01T00:00:00Z
  };

  async function issue(signer = owner, overrides = {}) {
    const data = { ...sample, ...overrides };
    const id = await registry.computeCertificateId(data.studentId, data.course, data.issuedAt);
    await registry
      .connect(signer)
      .issueCertificate(id, data.studentId, data.studentName, data.course, CID, data.issuedAt);
    return id;
  }

  beforeEach(async function () {
    [owner, issuer, outsider] = await ethers.getSigners();
    registry = await ethers.deployContract("CertificateRegistry");
  });

  describe("deployment", function () {
    it("makes the deployer the owner and an issuer", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.issuers(owner.address)).to.equal(true);
    });
  });

  describe("issuer management", function () {
    it("lets the owner add and remove issuers", async function () {
      await expect(registry.addIssuer(issuer.address))
        .to.emit(registry, "IssuerAdded")
        .withArgs(issuer.address);
      expect(await registry.issuers(issuer.address)).to.equal(true);

      await expect(registry.removeIssuer(issuer.address))
        .to.emit(registry, "IssuerRemoved")
        .withArgs(issuer.address);
      expect(await registry.issuers(issuer.address)).to.equal(false);
    });

    it("rejects a non-owner adding an issuer", async function () {
      await expect(
        registry.connect(outsider).addIssuer(outsider.address)
      ).to.be.revertedWithCustomError(registry, "NotOwner");
    });
  });

  describe("issuing", function () {
    it("stores the certificate and emits an event", async function () {
      const id = await registry.computeCertificateId(
        sample.studentId,
        sample.course,
        sample.issuedAt
      );
      await expect(
        registry.issueCertificate(
          id,
          sample.studentId,
          sample.studentName,
          sample.course,
          CID,
          sample.issuedAt
        )
      )
        .to.emit(registry, "CertificateIssued")
        .withArgs(id, sample.studentId, CID, owner.address);

      const cert = await registry.getCertificate(id);
      expect(cert.studentName).to.equal(sample.studentName);
      expect(cert.metadataCid).to.equal(CID);
      expect(cert.revoked).to.equal(false);
      expect(cert.issuer).to.equal(owner.address);
      expect(await registry.totalCertificates()).to.equal(1n);
    });

    it("rejects an issuer that has not been granted the role", async function () {
      const id = await registry.computeCertificateId(1n, "X", 1n);
      await expect(
        registry.connect(outsider).issueCertificate(id, 1n, "N", "X", CID, 1n)
      ).to.be.revertedWithCustomError(registry, "NotIssuer");
    });

    it("rejects a duplicate certificate id", async function () {
      const id = await issue();
      await expect(
        registry.issueCertificate(
          id,
          sample.studentId,
          sample.studentName,
          sample.course,
          CID,
          sample.issuedAt
        )
      ).to.be.revertedWithCustomError(registry, "CertificateExists");
    });

    it("rejects a zero id and an empty CID", async function () {
      await expect(
        registry.issueCertificate(ethers.ZeroHash, 1n, "N", "X", CID, 1n)
      ).to.be.revertedWithCustomError(registry, "InvalidCertificateId");

      const id = await registry.computeCertificateId(1n, "X", 1n);
      await expect(
        registry.issueCertificate(id, 1n, "N", "X", "", 1n)
      ).to.be.revertedWithCustomError(registry, "EmptyMetadataCid");
    });

    it("derives the same id for the same inputs", async function () {
      const a = await registry.computeCertificateId(7n, "Physics", 100n);
      const b = await registry.computeCertificateId(7n, "Physics", 100n);
      const c = await registry.computeCertificateId(7n, "Physics", 101n);
      expect(a).to.equal(b);
      expect(a).to.not.equal(c);
    });
  });

  describe("verification", function () {
    it("reports a freshly issued certificate as valid", async function () {
      const id = await issue();
      const [isValid, cert] = await registry.verifyCertificate(id);
      expect(isValid).to.equal(true);
      expect(cert.studentName).to.equal(sample.studentName);
    });

    it("returns false for an unknown id instead of reverting", async function () {
      const [isValid, cert] = await registry.verifyCertificate(ethers.id("nope"));
      expect(isValid).to.equal(false);
      expect(cert.metadataCid).to.equal("");
    });

    it("reports a revoked certificate as invalid but still readable", async function () {
      const id = await issue();
      await expect(registry.revokeCertificate(id))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(id, owner.address);

      const [isValid, cert] = await registry.verifyCertificate(id);
      expect(isValid).to.equal(false);
      expect(cert.revoked).to.equal(true);
      expect(cert.studentName).to.equal(sample.studentName);
    });
  });

  describe("revocation", function () {
    it("rejects revoking twice", async function () {
      const id = await issue();
      await registry.revokeCertificate(id);
      await expect(registry.revokeCertificate(id)).to.be.revertedWithCustomError(
        registry,
        "AlreadyRevoked"
      );
    });

    it("rejects revoking an unknown certificate", async function () {
      await expect(
        registry.revokeCertificate(ethers.id("missing"))
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    });

    it("rejects a non-issuer revoking", async function () {
      const id = await issue();
      await expect(
        registry.connect(outsider).revokeCertificate(id)
      ).to.be.revertedWithCustomError(registry, "NotIssuer");
    });
  });

  describe("enumeration", function () {
    it("tracks issued ids in order", async function () {
      const first = await issue();
      const second = await issue(owner, { course: "Chemistry" });
      expect(await registry.totalCertificates()).to.equal(2n);
      expect(await registry.certificateIdAt(0)).to.equal(first);
      expect(await registry.certificateIdAt(1)).to.equal(second);
    });
  });
});
