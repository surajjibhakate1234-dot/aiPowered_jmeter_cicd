const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

const jmxArgument = process.argv[2];

if (!jmxArgument) {
    console.error("Usage:");
    console.error("npm run test -- tests/<test-file>.jmx");
    process.exit(1);
}

const jmxFile = path.resolve(projectRoot, jmxArgument);

if (!fs.existsSync(jmxFile)) {
    console.error(`JMX file not found: ${jmxFile}`);
    process.exit(1);
}

const testName = path.basename(
    jmxFile,
    path.extname(jmxFile)
);

const jtlFile = path.join(
    "results",
    `${testName}.jtl`
);

try {

    console.log("\n========================================");
    console.log("STEP 1 - Running JMeter");
    console.log("========================================\n");

    execSync(
        `node scripts/run-jmeter.js "${jmxArgument}"`,
        {
            stdio: "inherit",
            cwd: projectRoot
        }
    );

    console.log("\n========================================");
    console.log("STEP 2 - Analyzing JTL");
    console.log("========================================\n");

    execSync(
        `node scripts/analyze-jtl.js "${jtlFile}"`,
        {
            stdio: "inherit",
            cwd: projectRoot
        }
    );

    // console.log("\n========================================");
    // console.log("STEP 3 - AI Performance Analysis");
    // console.log("========================================\n");
    //
    // execSync(
    //     `node agents/analysis-agent.js "results/${testName}_summary.json"`,
    //     {
    //         stdio: "inherit",
    //         cwd: projectRoot
    //     }
    // );

    console.log("\n========================================");
    console.log("STEP 3 - AI Performance Analysis");
    console.log("========================================\n");

    execSync(
        `node agents/analysis-agent.js "results/${testName}_summary.json"`,
        {
            stdio: "inherit",
            cwd: projectRoot
        }
    );

    console.log("\n========================================");
    console.log("TEST PIPELINE COMPLETED");
    console.log("========================================");

    console.log(`\nTest: ${testName}`);
    console.log(`JTL : results/${testName}.jtl`);
    console.log(
        `Report: results/${testName}_report/index.html`
    );
    console.log(
        `Summary: results/${testName}_summary.json`
    );
    // console.log(
    //     `AI Analysis: results/${testName}_ai_analysis.md`
    // );

    console.log(
        `AI Analysis: results/${testName}_ai_analysis.md`
    );

} catch (error) {

    console.error("\n========================================");
    console.error("TEST PIPELINE FAILED");
    console.error("========================================");

    process.exit(1);
}