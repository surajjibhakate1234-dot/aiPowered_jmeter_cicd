const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// --------------------------------------------------
// Get summary JSON from command line
// --------------------------------------------------

const summaryArgument = process.argv[2];

if (!summaryArgument) {
    console.error("Usage:");
    console.error(
        "node agents/analysis-agent.js results/<test>_summary.json"
    );
    process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");

const summaryFile = path.resolve(
    projectRoot,
    summaryArgument
);

// --------------------------------------------------
// Validate summary file
// --------------------------------------------------

if (!fs.existsSync(summaryFile)) {
    console.error(
        `Summary file not found: ${summaryFile}`
    );
    process.exit(1);
}

// --------------------------------------------------
// Read summary
// --------------------------------------------------

let summary;

try {
    summary = JSON.parse(
        fs.readFileSync(summaryFile, "utf8")
    );
} catch (error) {
    console.error("Unable to read summary JSON.");
    console.error(error.message);
    process.exit(1);
}

// --------------------------------------------------
// Display performance data
// --------------------------------------------------

console.log("\n========================================");
console.log("AI PERFORMANCE ANALYSIS");
console.log("========================================");

console.log(`\nTest: ${summary.test}`);

// --------------------------------------------------
// Overall metrics
// --------------------------------------------------

console.log("\n----------------------------------------");
console.log("Overall Performance");
console.log("----------------------------------------");

console.log(
    `Total Requests      : ${summary.overall.totalRequests}`
);

console.log(
    `Successful Requests : ${summary.overall.successfulRequests}`
);

console.log(
    `Failed Requests     : ${summary.overall.failedRequests}`
);

console.log(
    `Error Rate          : ${summary.overall.errorRatePercent}%`
);

console.log(
    `Average Response    : ${summary.responseTimeMs.average} ms`
);

console.log(
    `P95                 : ${summary.responseTimeMs.p95} ms`
);

console.log(
    `P99                 : ${summary.responseTimeMs.p99} ms`
);

console.log(
    `Throughput          : ${summary.throughputRequestsPerSecond} req/sec`
);

// --------------------------------------------------
// API metrics
// --------------------------------------------------

console.log("\n----------------------------------------");
console.log("API Performance");
console.log("----------------------------------------");

const samplers = summary.samplers || {};

for (const [samplerName, sampler] of Object.entries(samplers)) {

    console.log(`\n${samplerName}`);

    console.log(
        `  Requests : ${sampler.requests}`
    );

    console.log(
        `  Errors   : ${sampler.failedRequests}`
    );

    console.log(
        `  Average  : ${sampler.responseTimeMs.average} ms`
    );

    console.log(
        `  P95      : ${sampler.responseTimeMs.p95} ms`
    );

    console.log(
        `  P99      : ${sampler.responseTimeMs.p99} ms`
    );
}

// --------------------------------------------------
// Build AI prompt
// --------------------------------------------------

const aiPrompt = `
You are an expert performance testing engineer.

Analyze the following JMeter performance test results.

Test Name:
${summary.test}

Overall Metrics:
${JSON.stringify(summary.overall, null, 2)}

Response Time Metrics:
${JSON.stringify(summary.responseTimeMs, null, 2)}

Throughput:
${summary.throughputRequestsPerSecond} requests/second

Test Duration:
${summary.testDurationSeconds} seconds

Per API Metrics:
${JSON.stringify(summary.samplers, null, 2)}

Provide a professional performance analysis with these sections:

# Overall Assessment

Explain whether the test appears healthy based strictly on
the provided metrics.

# API Analysis

For every API:

- response time
- P95
- P99
- error rate
- performance observation

# Slowest API

Identify the slowest API using the provided metrics.

# Fastest API

Identify the fastest API using the provided metrics.

# Latency Analysis

Identify APIs with relatively high P95 or P99 values.

# Error Analysis

Explain the error rate and failed requests.

# Throughput Analysis

Interpret the observed throughput.

# Performance Risks

Identify potential performance concerns.

# Recommendations

Provide practical performance-testing recommendations.

# Next Test Recommendation

Recommend whether the next test should be:

- Load testing
- Stress testing
- Scalability testing
- Endurance testing

Explain why.

Important rules:

1. Do not invent metrics.
2. Do not invent SLA values.
3. Do not claim a system passed an SLA unless an SLA is provided.
4. Base conclusions only on the supplied data.
5. Clearly distinguish observations from assumptions.
`;

// --------------------------------------------------
// Run GitHub Copilot CLI
// --------------------------------------------------

function runCopilot(prompt) {

    console.log(
        "\n----------------------------------------"
    );

    console.log(
        "Requesting AI analysis using GitHub Copilot..."
    );

    console.log(
        "----------------------------------------\n"
    );

    const promptFile = path.join(
        projectRoot,
        "results",
        ".copilot_prompt.txt"
    );

    fs.writeFileSync(
        promptFile,
        prompt,
        "utf8"
    );

    try {

        const result = spawnSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                `Get-Content -Raw -LiteralPath '${promptFile}' | copilot`
            ],
            {
                cwd: projectRoot,
                encoding: "utf8",
                stdio: [
                    "ignore",
                    "pipe",
                    "pipe"
                ],
                windowsHide: true
            }
        );

        if (result.error) {
            throw new Error(
                `GitHub Copilot CLI failed.\n${result.error.message}`
            );
        }

        if (result.status !== 0) {
            throw new Error(
                `GitHub Copilot CLI failed with exit code ${result.status}.\n` +
                `${result.stderr || ""}`
            );
        }

        return (result.stdout || "").trim();

    } finally {

        if (fs.existsSync(promptFile)) {
            fs.unlinkSync(promptFile);
        }
    }
}
// --------------------------------------------------
// Main
// --------------------------------------------------

function main() {

    const analysis = runCopilot(aiPrompt);

    if (!analysis) {
        throw new Error(
            "GitHub Copilot returned an empty response."
        );
    }

    // --------------------------------------------------
    // Output file
    // --------------------------------------------------

    const testName = path.basename(
        summaryFile,
        "_summary.json"
    );

    const outputFile = path.join(
        projectRoot,
        "results",
        `${testName}_ai_analysis.md`
    );

    fs.writeFileSync(
        outputFile,
        `# AI Performance Analysis\n\n${analysis}\n`,
        "utf8"
    );

    // --------------------------------------------------
    // Display result
    // --------------------------------------------------

    console.log(
        "\n========================================"
    );

    console.log(
        "AI ANALYSIS RESULT"
    );

    console.log(
        "========================================\n"
    );

    console.log(analysis);

    console.log(
        "\n========================================"
    );

    console.log(
        `AI analysis saved to: ${outputFile}`
    );

    console.log(
        "========================================"
    );
}

try {

    main();

} catch (error) {

    console.error(
        "\nAI analysis failed."
    );

    console.error(
        error.message
    );

    process.exit(1);
}