const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

// Get JMX file from command line
const jmxArgument = process.argv[2];

if (!jmxArgument) {
    console.error("Usage:");
    console.error("node scripts/run-jmeter.js <path-to-jmx-file>");
    console.error("");
    console.error("Example:");
    console.error(
        "node scripts/run-jmeter.js tests/load_test_20.jmx"
    );
    process.exit(1);
}

const jmxFile = path.resolve(projectRoot, jmxArgument);

// Get test name from JMX filename
const testName = path.basename(
    jmxFile,
    path.extname(jmxFile)
);

// Results paths
const resultsDir = path.join(
    projectRoot,
    "results"
);

const jtlFile = path.join(
    resultsDir,
    `${testName}.jtl`
);

const htmlReportDir = path.join(
    resultsDir,
    `${testName}_report`
);

function deleteIfExists(target) {
    if (fs.existsSync(target)) {
        console.log(`Deleting: ${target}`);

        fs.rmSync(target, {
            recursive: true,
            force: true
        });
    }
}

try {

    console.log("========================================");
    console.log("AI-Powered JMeter Test");
    console.log("========================================");

    console.log(`\nTest: ${testName}`);
    console.log(`JMX : ${jmxFile}`);

    // Validate JMX file
    if (!fs.existsSync(jmxFile)) {
        throw new Error(
            `JMX file not found: ${jmxFile}`
        );
    }

    // Create results directory if required
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, {
            recursive: true
        });
    }

    // Clean previous results
    console.log("\nCleaning previous results...");

    deleteIfExists(jtlFile);
    deleteIfExists(htmlReportDir);

    // Build JMeter command
    const command =
        `jmeter -n ` +
        `-t "${jmxFile}" ` +
        `-l "${jtlFile}" ` +
        `-e ` +
        `-o "${htmlReportDir}"`;

    console.log("\nStarting JMeter...\n");

    // Execute JMeter
    execSync(command, {
        stdio: "inherit",
        cwd: projectRoot
    });

    console.log("\n========================================");
    console.log("JMeter Test Completed");
    console.log("========================================");

    console.log(`\nJTL file    : ${jtlFile}`);
    console.log(`HTML report : ${htmlReportDir}`);
    console.log(
        `HTML index  : ${path.join(
            htmlReportDir,
            "index.html"
        )}`
    );

    console.log("\n========================================");

} catch (error) {

    console.error("\n========================================");
    console.error("JMeter Test FAILED");
    console.error("========================================");

    console.error(error.message);

    process.exit(1);
}