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
const githubToken = process.env.GITHUB_TOKEN;
const model = process.env.GITHUB_MODEL || "openai/gpt-4o-mini";
const endpoint =
    process.env.GITHUB_MODELS_ENDPOINT ||
    "https://models.github.ai/inference/chat/completions";

const summaryFile = path.resolve(
    projectRoot,
    summaryArgument
);

// --------------------------------------------------
// Validate file
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
        fs.readFileSync(
            summaryFile,
            "utf8"
        )
    );

} catch (error) {

    console.error(
        "Unable to read summary JSON."
    );

    console.error(
        error.message
    );

    process.exit(1);
}

// --------------------------------------------------
// Display performance data
// --------------------------------------------------

console.log(
    "\n========================================"
);

console.log(
    "AI PERFORMANCE ANALYSIS"
);

console.log(
    "========================================"
);

console.log(
    `\nTest: ${summary.test}`
);

// --------------------------------------------------
// Overall metrics
// --------------------------------------------------

console.log(
    "\n----------------------------------------"
);

console.log(
    "Overall Performance"
);

console.log(
    "----------------------------------------"
);

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
// API analysis
// --------------------------------------------------

console.log(
    "\n----------------------------------------"
);

console.log(
    "API Performance"
);

console.log(
    "----------------------------------------"
);

const samplers =
    summary.samplers || {};

for (
    const [
        samplerName,
        sampler
    ] of Object.entries(samplers)
    ) {

    console.log(
        `\n${samplerName}`
    );

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

Provide:

1. Overall performance assessment
2. Slowest API
3. Fastest API
4. APIs with high P95/P99 latency
5. Error analysis
6. Throughput assessment
7. Potential performance concerns
8. Recommendations
9. Whether another load/stress test is recommended

Do not invent metrics that are not present in the input.
Base all conclusions on the provided data.
`;

// --------------------------------------------------
// Request AI analysis
// --------------------------------------------------

async function requestAnalysis() {
    if (!githubToken) {
        throw new Error(
            "GITHUB_TOKEN environment variable is required."
        );
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${githubToken}`
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: aiPrompt
                }
            ],
            temperature: 0.2
        })
    });

    const responseText = await response.text();
    let result;

    try {
        result = JSON.parse(responseText);
    } catch (error) {
        throw new Error(
            `GitHub Models returned invalid JSON (HTTP ${response.status}).`
        );
    }

    if (!response.ok) {
        throw new Error(
            `GitHub Models request failed (HTTP ${response.status}): ` +
            `${result.error?.message || responseText}`
        );
    }

    const analysis = result.choices?.[0]?.message?.content;

    if (!analysis) {
        throw new Error(
            "GitHub Models response did not contain an analysis."
        );
    }

    return analysis;
}

async function main() {
    console.log(
        "\n----------------------------------------"
    );

    console.log(
        `Requesting AI analysis using ${model}...`
    );

    const analysis = await requestAnalysis();
    const outputFile = path.join(
        projectRoot,
        "results",
        `${path.basename(summaryFile, "_summary.json")}_ai_analysis.md`
    );

    fs.writeFileSync(
        outputFile,
        `# AI Performance Analysis\n\n${analysis.trim()}\n`
    );

    console.log(
        "\n----------------------------------------"
    );

    console.log(analysis.trim());

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

main().catch(error => {
    console.error("\nAI analysis failed.");
    console.error(error.message);
    process.exit(1);
});