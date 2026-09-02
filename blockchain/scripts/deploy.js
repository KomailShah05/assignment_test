const fs = require("fs");
const path = require("path");
const { ethers, artifacts, network } = require("hardhat");

// Writes the deployed address + ABI where the frontend can import them, so a
// reviewer never has to copy an address by hand after `npm run deploy:local`.
const FRONTEND_TARGET = path.resolve(__dirname, "../../frontend/src/domains/certificate/contract");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with ${deployer.address} on "${network.name}"`);

  const registry = await ethers.deployContract("CertificateRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`CertificateRegistry deployed to ${address}`);

  const { abi } = await artifacts.readArtifact("CertificateRegistry");
  fs.mkdirSync(FRONTEND_TARGET, { recursive: true });
  fs.writeFileSync(
    path.join(FRONTEND_TARGET, "certificate-registry.json"),
    JSON.stringify({ address, abi, network: network.name }, null, 2) + "\n"
  );
  console.log(`Wrote ABI + address to ${FRONTEND_TARGET}/certificate-registry.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
