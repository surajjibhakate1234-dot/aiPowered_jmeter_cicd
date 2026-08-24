const fs = require("fs");
const path = require("path");

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
    console.error(`Summary file not found: ${summaryFile}`);
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
// AI Prompt
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

Provide a professional performance analysis using exactly these sections:

# Overall Assessment

Explain whether the test appears healthy based strictly on
the provided metrics.

# API Analysis

Analyze every API.

For each API include:

- Average response time
- P95
- P99
- Error rate
- Performance observation

# Slowest API

Identify the slowest API based on average response time.

# Fastest API

Identify the fastest API based on average response time.

# Latency Analysis

Identify APIs with relatively high P95 or P99 latency.

Pay particular attention to tail latency.

# Error Analysis

Explain the number of failed requests and error rate.

# Throughput Analysis

Interpret the observed throughput.

Do not claim that throughput is good or bad without sufficient
context.

# Performance Risks

Identify potential performance concerns based only on the
provided metrics.

# Recommendations

Provide practical performance-testing recommendations.

# Next Test Recommendation

Recommend the most appropriate next test:

- Load testing
- Stress testing
- Scalability testing
- Endurance testing

Explain the reasoning.

Important rules:

1. Do not invent metrics.
2. Do not invent SLA values.
3. Do not claim an SLA was passed unless an SLA is provided.
4. Do not invent infrastructure information.
5. Do not assume database, CPU, memory, network, or GC problems without evidence.
6. Clearly distinguish observations from assumptions.
7. Use only the supplied JMeter results.
`;

// --------------------------------------------------
// GitHub Models configuration
// --------------------------------------------------

const githubToken = process.env.GITHUB_TOKEN;

const model =
    process.env.GITHUB_MODEL ||
    "openai/gpt-4o-mini";

const endpoint =
    process.env.GITHUB_MODELS_ENDPOINT ||
    "https://models.github.ai/inference/chat/completions";

// --------------------------------------------------
// Request AI analysis using GitHub Models
// --------------------------------------------------

async function requestAIAnalysis() {

    if (!githubToken) {
        throw new Error(
            "GITHUB_TOKEN environment variable is required."
        );
    }

    console.log(
        "\n----------------------------------------"
    );

    console.log(
        "Requesting AI analysis using GitHub Models..."
    );

    console.log(
        `Model: ${model}`
    );

    console.log(
        "----------------------------------------"
    );

    const response = await fetch(
        endpoint,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${githubToken}`
            },

            body: JSON.stringify({
                model: model,

                messages: [
                    {
                        role: "system",
                        content:
                            "You are an expert performance testing engineer."
                    },
                    {
                        role: "user",
                        content: aiPrompt
                    }
                ],

                temperature: 0.2
            })
        }
    );

    const responseText =
        await response.text();

    let result;

    try {

        result =
            JSON.parse(responseText);

    } catch (error) {

        throw new Error(
            `GitHub Models returned invalid JSON. HTTP ${response.status}.`
        );
    }

    if (!response.ok) {

        throw new Error(
            `GitHub Models request failed. ` +
            `HTTP ${response.status}: ` +
            `${result.error?.message || responseText}`
        );
    }

    const analysis =
        result.choices?.[0]?.message?.content;

    if (!analysis) {

        throw new Error(
            "GitHub Models response did not contain an analysis."
        );
    }

    return analysis.trim();
}

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {

    const analysis =
        await requestAIAnalysis();

    if (!analysis) {

        throw new Error(
            "AI returned an empty response."
        );
    }

    // --------------------------------------------------
    // Output file
    // --------------------------------------------------

    const testName =
        path.basename(
            summaryFile,
            "_summary.json"
        );

    const outputFile =
        path.join(
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

// --------------------------------------------------
// Execute
// --------------------------------------------------

main().catch(error => {

    console.error(
        "\nAI analysis failed."
    );

    console.error(
        error.message
    );

    process.exit(1);
});