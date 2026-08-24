const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

// --------------------------------------------------
// Get JTL file from command line
// --------------------------------------------------

const jtlArgument = process.argv[2];

if (!jtlArgument) {
    console.error("Usage:");
    console.error(
        "node scripts/analyze-jtl.js results/<test-file>.jtl"
    );
    process.exit(1);
}

const jtlFile = path.resolve(projectRoot, jtlArgument);

// --------------------------------------------------
// Output file
// --------------------------------------------------

const jtlBaseName = path.basename(
    jtlFile,
    path.extname(jtlFile)
);

const outputFile = path.join(
    projectRoot,
    "results",
    `${jtlBaseName}_summary.json`
);

// --------------------------------------------------
// Percentile calculation
// --------------------------------------------------

function percentile(values, percentileValue) {

    if (values.length === 0) {
        return 0;
    }

    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const index =
        Math.ceil(
            (percentileValue / 100) *
            sorted.length
        ) - 1;

    return sorted[Math.max(0, index)];
}

// --------------------------------------------------
// CSV parser
// --------------------------------------------------

function parseCsvLine(line) {

    return line.split(",");
}

// --------------------------------------------------
// Main
// --------------------------------------------------

try {

    console.log("========================================");
    console.log("JMeter JTL Analysis");
    console.log("========================================");

    console.log(`\nJTL file: ${jtlFile}`);

    // --------------------------------------------------
    // Validate JTL
    // --------------------------------------------------

    if (!fs.existsSync(jtlFile)) {

        throw new Error(
            `JTL file not found: ${jtlFile}`
        );
    }

    // --------------------------------------------------
    // Read JTL
    // --------------------------------------------------

    const content =
        fs.readFileSync(
            jtlFile,
            "utf8"
        );

    const lines =
        content
            .split(/\r?\n/)
            .filter(
                line => line.trim().length > 0
            );

    if (lines.length < 2) {

        throw new Error(
            "JTL file does not contain test results."
        );
    }

    // --------------------------------------------------
    // Headers
    // --------------------------------------------------

    const headers =
        parseCsvLine(lines[0]);

    const index = {};

    headers.forEach(
        (header, i) => {

            index[
                header.trim()
            ] = i;

        }
    );

    // --------------------------------------------------
    // Required columns
    // --------------------------------------------------

    const requiredColumns = [
        "timeStamp",
        "elapsed",
        "label",
        "success"
    ];

    for (
        const column of requiredColumns
    ) {

        if (
            index[column] === undefined
        ) {

            throw new Error(
                `Required JTL column '${column}' was not found.`
            );
        }
    }

    // --------------------------------------------------
    // Overall metrics
    // --------------------------------------------------

    let totalRequests = 0;

    let successfulRequests = 0;

    let failedRequests = 0;

    const responseTimes = [];

    let firstTimestamp = null;

    let lastTimestamp = null;

    // --------------------------------------------------
    // Per sampler metrics
    // --------------------------------------------------

    const samplers = {};

    // --------------------------------------------------
    // Process each JTL row
    // --------------------------------------------------

    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const columns =
            parseCsvLine(lines[i]);

        if (
            columns.length <
            headers.length
        ) {

            continue;
        }

        const timestamp =
            Number(
                columns[index.timeStamp]
            );

        const elapsed =
            Number(
                columns[index.elapsed]
            );

        const label =
            columns[index.label]
                .trim();

        const success =
            columns[index.success]
                .trim()
                .toLowerCase() === "true";

        // Ignore invalid rows

        if (
            Number.isNaN(timestamp) ||
            Number.isNaN(elapsed) ||
            !label
        ) {

            continue;
        }

        // --------------------------------------------------
        // Overall
        // --------------------------------------------------

        totalRequests++;

        responseTimes.push(
            elapsed
        );

        if (success) {

            successfulRequests++;

        } else {

            failedRequests++;

        }

        if (
            firstTimestamp === null ||
            timestamp < firstTimestamp
        ) {

            firstTimestamp =
                timestamp;
        }

        if (
            lastTimestamp === null ||
            timestamp > lastTimestamp
        ) {

            lastTimestamp =
                timestamp;
        }

        // --------------------------------------------------
        // Sampler
        // --------------------------------------------------

        if (!samplers[label]) {

            samplers[label] = {

                requests: 0,

                successfulRequests: 0,

                failedRequests: 0,

                responseTimes: []

            };
        }

        samplers[label].requests++;

        samplers[label]
            .responseTimes
            .push(elapsed);

        if (success) {

            samplers[label]
                .successfulRequests++;

        } else {

            samplers[label]
                .failedRequests++;
        }
    }

    // --------------------------------------------------
    // Validate
    // --------------------------------------------------

    if (
        totalRequests === 0
    ) {

        throw new Error(
            "No valid JMeter samples found."
        );
    }

    // --------------------------------------------------
    // Overall calculations
    // --------------------------------------------------

    const averageResponseTime =
        responseTimes.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        responseTimes.length;

    const minResponseTime =
        Math.min(
            ...responseTimes
        );

    const maxResponseTime =
        Math.max(
            ...responseTimes
        );

    const p90 =
        percentile(
            responseTimes,
            90
        );

    const p95 =
        percentile(
            responseTimes,
            95
        );

    const p99 =
        percentile(
            responseTimes,
            99
        );

    const errorRate =
        (
            failedRequests /
            totalRequests
        ) *
        100;

    const durationSeconds =
        firstTimestamp !== null &&
        lastTimestamp !== null
            ? (
                lastTimestamp -
                firstTimestamp
            ) / 1000
            : 0;

    const throughput =
        durationSeconds > 0
            ? totalRequests /
              durationSeconds
            : 0;

    // --------------------------------------------------
    // Build sampler summary
    // --------------------------------------------------

    const samplerSummary = {};

    for (
        const [
            samplerName,
            sampler
        ] of Object.entries(
            samplers
        )
    ) {

        const times =
            sampler.responseTimes;

        const samplerAverage =
            times.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
            times.length;

        const samplerMin =
            Math.min(
                ...times
            );

        const samplerMax =
            Math.max(
                ...times
            );

        const samplerP90 =
            percentile(
                times,
                90
            );

        const samplerP95 =
            percentile(
                times,
                95
            );

        const samplerP99 =
            percentile(
                times,
                99
            );

        const samplerErrorRate =
            (
                sampler.failedRequests /
                sampler.requests
            ) *
            100;

        samplerSummary[
            samplerName
        ] = {

            requests:
                sampler.requests,

            successfulRequests:
                sampler.successfulRequests,

            failedRequests:
                sampler.failedRequests,

            errorRatePercent:
                Number(
                    samplerErrorRate
                        .toFixed(2)
                ),

            responseTimeMs: {

                average:
                    Number(
                        samplerAverage
                            .toFixed(2)
                    ),

                min:
                    samplerMin,

                max:
                    samplerMax,

                p90:
                    samplerP90,

                p95:
                    samplerP95,

                p99:
                    samplerP99
            }
        };
    }

    // --------------------------------------------------
    // Final summary
    // --------------------------------------------------

    const summary = {

        test:
            jtlBaseName,

        overall: {

            totalRequests,

            successfulRequests,

            failedRequests,

            errorRatePercent:
                Number(
                    errorRate.toFixed(2)
                )
        },

        responseTimeMs: {

            average:
                Number(
                    averageResponseTime
                        .toFixed(2)
                ),

            min:
                minResponseTime,

            max:
                maxResponseTime,

            p90,

            p95,

            p99
        },

        throughputRequestsPerSecond:
            Number(
                throughput.toFixed(2)
            ),

        testDurationSeconds:
            Number(
                durationSeconds.toFixed(2)
            ),

        samplers:
            samplerSummary
    };

    // --------------------------------------------------
    // Save JSON
    // --------------------------------------------------

    fs.writeFileSync(
        outputFile,
        JSON.stringify(
            summary,
            null,
            2
        )
    );

    // --------------------------------------------------
    // Console output
    // --------------------------------------------------

    console.log(
        "\n========================================"
    );

    console.log(
        "Overall Performance Summary"
    );

    console.log(
        "========================================"
    );

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

    // --------------------------------------------------
    // Sampler output
    // --------------------------------------------------

    console.log(
        "\n========================================"
    );

    console.log(
        "Per API / Sampler Performance"
    );

    console.log(
        "========================================"
    );

    for (
        const [
            samplerName,
            sampler
        ] of Object.entries(
            samplerSummary
        )
    ) {

        console.log(
            `\n${samplerName}`
        );

        console.log(
            `  Requests       : ${sampler.requests}`
        );

        console.log(
            `  Successful     : ${sampler.successfulRequests}`
        );

        console.log(
            `  Failed         : ${sampler.failedRequests}`
        );

        console.log(
            `  Error Rate     : ${sampler.errorRatePercent}%`
        );

        console.log(
            `  Average        : ${sampler.responseTimeMs.average} ms`
        );

        console.log(
            `  P95            : ${sampler.responseTimeMs.p95} ms`
        );

        console.log(
            `  P99            : ${sampler.responseTimeMs.p99} ms`
        );
    }

    console.log(
        "\n========================================"
    );

    console.log(
        `Summary saved to: ${outputFile}`
    );

    console.log(
        "========================================"
    );

} catch (error) {

    console.error(
        "\nJTL analysis failed."
    );

    console.error(
        error.message
    );

    process.exit(1);
}