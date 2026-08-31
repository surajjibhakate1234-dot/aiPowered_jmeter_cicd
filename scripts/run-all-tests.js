const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const testsDirectory = path.join(projectRoot, "tests");

// --------------------------------------------------
// Find all JMX files recursively
// --------------------------------------------------

function findJmxFiles(directory) {

    let files = [];

    if (!fs.existsSync(directory)) {
        return files;
    }

    const entries = fs.readdirSync(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {

        const fullPath = path.join(
            directory,
            entry.name
        );

        if (entry.isDirectory()) {

            files = files.concat(
                findJmxFiles(fullPath)
            );

        } else if (
            entry.isFile() &&
            entry.name.toLowerCase().endsWith(".jmx")
        ) {

            files.push(fullPath);
        }
    }

    return files;
}

// --------------------------------------------------
// Main
// --------------------------------------------------

function main() {

    console.log("\n========================================");
    console.log("AI-POWERED JMETER TEST FRAMEWORK");
    console.log("========================================");

    console.log("\nSearching for JMX files...");
    console.log(`Tests directory: ${testsDirectory}`);

    const jmxFiles = findJmxFiles(testsDirectory);

    // --------------------------------------------------
    // Validate
    // --------------------------------------------------

    if (jmxFiles.length === 0) {

        console.error(
            "\nNo JMX files found under tests/."
        );

        process.exit(1);
    }

    // --------------------------------------------------
    // Sort files
    // --------------------------------------------------

    jmxFiles.sort();

    console.log(
        `\nFound ${jmxFiles.length} JMX file(s):`
    );

    jmxFiles.forEach((file, index) => {

        const relativePath =
            path.relative(
                projectRoot,
                file
            );

        console.log(
            `${index + 1}. ${relativePath}`
        );
    });

    // --------------------------------------------------
    // Execute tests one by one
    // --------------------------------------------------

    const results = [];

    for (let i = 0; i < jmxFiles.length; i++) {

        const jmxFile = jmxFiles[i];

        const relativeJmxPath =
            path.relative(
                projectRoot,
                jmxFile
            );

        console.log("\n");
        console.log("========================================");
        console.log(
            `TEST ${i + 1} OF ${jmxFiles.length}`
        );
        console.log("========================================");

        console.log(
            `JMX: ${relativeJmxPath}`
        );

        console.log("========================================");

        const result = spawnSync(
            process.execPath,
            [
                path.join(
                    projectRoot,
                    "scripts",
                    "run-test.js"
                ),
                relativeJmxPath
            ],
            {
                cwd: projectRoot,
                stdio: "inherit",
                shell: false
            }
        );

        const testName =
            path.basename(
                jmxFile,
                path.extname(jmxFile)
            );

        if (result.status === 0) {

            console.log("\n----------------------------------------");
            console.log(
                `PASSED: ${testName}`
            );
            console.log("----------------------------------------");

            results.push({
                test: testName,
                file: relativeJmxPath,
                status: "PASSED"
            });

        } else {

            console.error("\n----------------------------------------");
            console.error(
                `FAILED: ${testName}`
            );
            console.error("----------------------------------------");

            results.push({
                test: testName,
                file: relativeJmxPath,
                status: "FAILED"
            });

            // Continue with the next JMX test.
            console.log(
                "Continuing with the next JMX test..."
            );
        }
    }

    // --------------------------------------------------
    // Final execution summary
    // --------------------------------------------------

    console.log("\n\n========================================");
    console.log("ALL JMETER TESTS COMPLETED");
    console.log("========================================");

    console.log("\nExecution Summary:");

    results.forEach((result, index) => {

        console.log(
            `${index + 1}. ${result.test} -> ${result.status}`
        );
    });

    const passed =
        results.filter(
            result => result.status === "PASSED"
        ).length;

    const failed =
        results.filter(
            result => result.status === "FAILED"
        ).length;

    console.log("\n----------------------------------------");
    console.log(`Total Tests  : ${results.length}`);
    console.log(`Passed       : ${passed}`);
    console.log(`Failed       : ${failed}`);
    console.log("----------------------------------------");

    // --------------------------------------------------
    // Fail GitHub Actions if any test failed
    // --------------------------------------------------

    if (failed > 0) {

        console.error(
            "\nOne or more JMeter tests failed."
        );

        process.exit(1);
    }

    console.log(
        "\nAll JMeter tests completed successfully."
    );

    process.exit(0);
}

main();