const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

// Get JTL file from command line
const jtlArgument = process.argv[2];

if (!jtlArgument) {
    console.error("Usage:");
    console.error("node scripts/analyze-jtl.js <path-to-jtl-file>");
    process.exit(1);
}

const jtlFile = path.resolve(projectRoot, jtlArgument);

// Create output filename based on JTL filename
const jtlBaseName = path.basename(
    jtlFile,
    path.extname(jtlFile)
);

const outputFile = path.join(
    projectRoot,
    "results",
    `${jtlBaseName}_summary.json`
);

function percentile(values, percentileValue) {
    if (values.length === 0) {
        return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);

    const index =
        Math.ceil((percentileValue / 100) * sorted.length) - 1;

    return sorted[Math.max(0, index)];
}

function parseCsvLine(line) {
    return line.split(",");
}

try {
    console.log("========================================");
    console.log("JMeter JTL Analysis");
    console.log("========================================");

    console.log(`\nJTL file: ${jtlFile}`);

    if (!fs.existsSync(jtlFile)) {
        throw new Error(`JTL file not found: ${jtlFile}`);
    }

    const content = fs.readFileSync(jtlFile, "utf8");

    const lines = content
        .split(/\r?\n/)
        .filter(line => line.trim().length > 0);

    if (lines.length < 2) {
        throw new Error("JTL file does not contain test results.");
    }

    const headers = parseCsvLine(lines[0]);

    const index = {};

    headers.forEach((header, i) => {
        index[header.trim()] = i;
    });

    const requiredColumns = [
        "timeStamp",
        "elapsed",
        "success"
    ];

    for (const column of requiredColumns) {
        if (index[column] === undefined) {
            throw new Error(
                `Required JTL column '${column}' was not found.`
            );
        }
    }

    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const responseTimes = [];

    let firstTimestamp = null;
    let lastTimestamp = null;

    for (let i = 1; i < lines.length; i++) {

        const columns = parseCsvLine(lines[i]);

        if (columns.length < headers.length) {
            continue;
        }

        const timestamp = Number(
            columns[index.timeStamp]
        );

        const elapsed = Number(
            columns[index.elapsed]
        );

        const success =
            columns[index.success]
                .trim()
                .toLowerCase() === "true";

        if (
            Number.isNaN(timestamp) ||
            Number.isNaN(elapsed)
        ) {
            continue;
        }

        totalRequests++;

        responseTimes.push(elapsed);

        if (success) {
            successfulRequests++;
        } else {
            failedRequests++;
        }

        if (
            firstTimestamp === null ||
            timestamp < firstTimestamp
        ) {
            firstTimestamp = timestamp;
        }

        if (
            lastTimestamp === null ||
            timestamp > lastTimestamp
        ) {
            lastTimestamp = timestamp;
        }
    }

    if (totalRequests === 0) {
        throw new Error("No valid JMeter samples found.");
    }

    const averageResponseTime =
        responseTimes.reduce(
            (sum, value) => sum + value,
            0
        ) / responseTimes.length;

    const minResponseTime =
        Math.min(...responseTimes);

    const maxResponseTime =
        Math.max(...responseTimes);

    const p90 =
        percentile(responseTimes, 90);

    const p95 =
        percentile(responseTimes, 95);

    const p99 =
        percentile(responseTimes, 99);

    const errorRate =
        (failedRequests / totalRequests) * 100;

    const durationSeconds =
        firstTimestamp !== null &&
        lastTimestamp !== null
            ? (lastTimestamp - firstTimestamp) / 1000
            : 0;

    const throughput =
        durationSeconds > 0
            ? totalRequests / durationSeconds
            : 0;

    const summary = {
        test: jtlBaseName,

        totalRequests,

        successfulRequests,

        failedRequests,

        errorRatePercent:
            Number(errorRate.toFixed(2)),

        responseTimeMs: {
            average:
                Number(averageResponseTime.toFixed(2)),

            min:
            minResponseTime,

            max:
            maxResponseTime,

            p90,

            p95,

            p99
        },

        throughputRequestsPerSecond:
            Number(throughput.toFixed(2)),

        testDurationSeconds:
            Number(durationSeconds.toFixed(2))
    };

    fs.writeFileSync(
        outputFile,
        JSON.stringify(summary, null, 2)
    );

    console.log("\n========================================");
    console.log("Performance Summary");
    console.log("========================================");

    console.log(
        `Test                 : ${jtlBaseName}`
    );

    console.log(
        `Total Requests       : ${totalRequests}`
    );

    console.log(
        `Successful Requests  : ${successfulRequests}`
    );

    console.log(
        `Failed Requests      : ${failedRequests}`
    );

    console.log(
        `Error Rate           : ${errorRate.toFixed(2)}%`
    );

    console.log(
        `Average Response     : ${averageResponseTime.toFixed(2)} ms`
    );

    console.log(
        `Min Response         : ${minResponseTime} ms`
    );

    console.log(
        `Max Response         : ${maxResponseTime} ms`
    );

    console.log(
        `P90 Response         : ${p90} ms`
    );

    console.log(
        `P95 Response         : ${p95} ms`
    );

    console.log(
        `P99 Response         : ${p99} ms`
    );

    console.log(
        `Throughput           : ${throughput.toFixed(2)} req/sec`
    );

    console.log(
        `Duration             : ${durationSeconds.toFixed(2)} sec`
    );

    console.log("\n========================================");

    console.log(
        `Summary saved to: ${outputFile}`
    );

    console.log("========================================");

} catch (error) {

    console.error("\nJTL analysis failed.");
    console.error(error.message);

    process.exit(1);
}