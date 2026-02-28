import { ethers } from "hardhat";

async function main() {
    console.log("Deploying BatchCallDelegation to Monad Testnet...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

    // Deploy BatchCallDelegation
    const BatchCallDelegation = await ethers.getContractFactory("BatchCallDelegation");
    const batch = await BatchCallDelegation.deploy();
    await batch.waitForDeployment();
    const batchAddr = await batch.getAddress();
    console.log("BatchCallDelegation deployed to:", batchAddr);

    // Deploy MockERC20 for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Test Token", "TEST", 1_000_000);
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log("MockERC20 deployed to:", tokenAddr);

    console.log("\n--- Deployment Complete ---");
    console.log(`\nUpdate BATCH_DELEGATION_ADDRESS in src/hooks/useEIP7702.ts:`);
    console.log(`  export const BATCH_DELEGATION_ADDRESS = '${batchAddr}' as \`0x\${string}\``);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
