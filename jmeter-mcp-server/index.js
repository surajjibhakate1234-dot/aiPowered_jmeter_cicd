const fs = require("fs");
const path = require("path");

const {
    McpServer
} = require("@modelcontextprotocol/sdk/server/mcp.js");

const {
    StdioServerTransport
} = require("@modelcontextprotocol/sdk/server/stdio.js");

const {
    z
} = require("zod");

// --------------------------------------------------
// MCP Server
// --------------------------------------------------

const server = new McpServer({
    name: "jmeter-mcp-server",
    version: "1.0.0"
});

// --------------------------------------------------
// Helper
// --------------------------------------------------

function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// --------------------------------------------------
// Tool: Create JMeter JMX
// --------------------------------------------------

server.tool(
    "create_jmeter_test",

    "Create a JMeter performance test JMX file with Thread Group, HTTP Request and Response Assertion.",

    {
        testType: z.enum([
            "load",
            "stress",
            "scalability",
            "endurance"
        ]),

        fileName: z.string()
            .regex(
                /^[a-zA-Z0-9_-]+\.jmx$/,
                "fileName must end with .jmx"
            ),

        users: z.number()
            .int()
            .positive(),

        rampUp: z.number()
            .int()
            .nonnegative(),

        duration: z.number()
            .int()
            .positive(),

        method: z.enum([
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
        ]),

        endpoint: z.string(),

        host: z.string()
            .default("jsonplaceholder.typicode.com"),

        protocol: z.enum([
            "http",
            "https"
        ])
            .default("https"),

        expectedStatus: z.string()
            .default("200"),

        requestBody: z.string()
            .optional(),

        assertionText: z.string()
            .optional()
    },

    async ({
        testType,
        fileName,
        users,
        rampUp,
        duration,
        method,
        endpoint,
        host,
        protocol,
        expectedStatus,
        requestBody,
        assertionText
    }) => {

        // --------------------------------------------------
        // Project paths
        // --------------------------------------------------

        const projectRoot =
            path.resolve(__dirname, "..");

        const testDirectory =
            path.join(
                projectRoot,
                "tests",
                `${testType}_test`
            );

        fs.mkdirSync(
            testDirectory,
            {
                recursive: true
            }
        );

        const jmxFile =
            path.join(
                testDirectory,
                fileName
            );

        // --------------------------------------------------
        // HTTP body
        // --------------------------------------------------

        let bodyElement = "";

        if (
            requestBody &&
            ["POST", "PUT", "PATCH"].includes(method)
        ) {

            bodyElement = `
          <elementProp
              name="HTTPsampler.Arguments"
              elementType="Arguments">

            <collectionProp
                name="Arguments.arguments">

              <elementProp
                  name=""
                  elementType="HTTPArgument">

                <boolProp name="HTTPArgument.always_encode">
                  false
                </boolProp>

                <stringProp name="Argument.value">
                  ${escapeXml(requestBody)}
                </stringProp>

                <stringProp name="Argument.metadata">
                  =
                </stringProp>

                <boolProp name="HTTPArgument.use_equals">
                  true
                </boolProp>

              </elementProp>

            </collectionProp>

          </elementProp>
`;
        } else {

            bodyElement = `
          <elementProp
              name="HTTPsampler.Arguments"
              elementType="Arguments">

            <collectionProp
                name="Arguments.arguments"/>

          </elementProp>
`;
        }

        // --------------------------------------------------
        // Response assertion
        // --------------------------------------------------

        const assertion = `
        <ResponseAssertion
            guiclass="AssertionGui"
            testclass="ResponseAssertion"
            testname="HTTP Status Assertion"
            enabled="true">

          <collectionProp
              name="Asserion.test_strings">

            <stringProp name="0">
              ${escapeXml(expectedStatus)}
            </stringProp>

          </collectionProp>

          <stringProp name="Assertion.custom_message">
            Expected HTTP status ${escapeXml(expectedStatus)}
          </stringProp>

          <stringProp name="Assertion.test_field">
            Assertion.response_code
          </stringProp>

          <boolProp name="Assertion.assume_success">
            false
          </boolProp>

          <intProp name="Assertion.test_type">
            8
          </intProp>

        </ResponseAssertion>
`;

        // --------------------------------------------------
        // Optional response text assertion
        // --------------------------------------------------

        let textAssertion = "";

        if (assertionText) {

            textAssertion = `
        <ResponseAssertion
            guiclass="AssertionGui"
            testclass="ResponseAssertion"
            testname="Response Content Assertion"
            enabled="true">

          <collectionProp
              name="Asserion.test_strings">

            <stringProp name="0">
              ${escapeXml(assertionText)}
            </stringProp>

          </collectionProp>

          <stringProp name="Assertion.custom_message">
            Response should contain expected content
          </stringProp>

          <stringProp name="Assertion.test_field">
            Assertion.response_data
          </stringProp>

          <boolProp name="Assertion.assume_success">
            false
          </boolProp>

          <intProp name="Assertion.test_type">
            2
          </intProp>

        </ResponseAssertion>
`;
        }

        // --------------------------------------------------
        // JMX
        // --------------------------------------------------

        const jmxContent = `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan
    version="1.2"
    properties="5.0"
    jmeter="5.6.3">

  <hashTree>

    <TestPlan
        guiclass="TestPlanGui"
        testclass="TestPlan"
        testname="${escapeXml(testType)} Test Plan"
        enabled="true">

      <stringProp name="TestPlan.comments">
        Created by JMeter MCP Server
      </stringProp>

      <boolProp name="TestPlan.functional_mode">
        false
      </boolProp>

      <boolProp name="TestPlan.serialize_threadgroups">
        false
      </boolProp>

    </TestPlan>

    <hashTree>

      <ThreadGroup
          guiclass="ThreadGroupGui"
          testclass="ThreadGroup"
          testname="${escapeXml(testType)} Thread Group"
          enabled="true">

        <stringProp name="ThreadGroup.on_sample_error">
          continue
        </stringProp>

        <elementProp
            name="ThreadGroup.main_controller"
            elementType="LoopController"
            guiclass="LoopControlPanel"
            testclass="LoopController"
            testname="Loop Controller"
            enabled="true">

          <boolProp name="LoopController.continue_forever">
            false
          </boolProp>

          <stringProp name="LoopController.loops">
            1
          </stringProp>

        </elementProp>

        <stringProp name="ThreadGroup.num_threads">
          ${users}
        </stringProp>

        <stringProp name="ThreadGroup.ramp_time">
          ${rampUp}
        </stringProp>

        <boolProp name="ThreadGroup.scheduler">
          true
        </boolProp>

        <stringProp name="ThreadGroup.duration">
          ${duration}
        </stringProp>

        <stringProp name="ThreadGroup.delay">
          0
        </stringProp>

      </ThreadGroup>

      <hashTree>

        <HTTPSamplerProxy
            guiclass="HttpTestSampleGui"
            testclass="HTTPSamplerProxy"
            testname="${escapeXml(method)} ${escapeXml(endpoint)}"
            enabled="true">

          <stringProp name="HTTPSampler.domain">
            ${escapeXml(host)}
          </stringProp>

          <stringProp name="HTTPSampler.protocol">
            ${escapeXml(protocol)}
          </stringProp>

          <stringProp name="HTTPSampler.path">
            ${escapeXml(endpoint)}
          </stringProp>

          <stringProp name="HTTPSampler.method">
            ${escapeXml(method)}
          </stringProp>

          <boolProp name="HTTPSampler.follow_redirects">
            true
          </boolProp>

          <boolProp name="HTTPSampler.auto_redirects">
            false
          </boolProp>

          <boolProp name="HTTPSampler.use_keepalive">
            true
          </boolProp>

          <boolProp name="HTTPSampler.DO_MULTIPART_POST">
            false
          </boolProp>

          <boolProp name="HTTPSampler.monitor">
            false
          </boolProp>

${bodyElement}

        </HTTPSamplerProxy>

        <hashTree>

${assertion}

${textAssertion}

        </hashTree>

      </hashTree>

    </hashTree>

  </hashTree>

</jmeterTestPlan>
`;

        // --------------------------------------------------
        // Write JMX
        // --------------------------------------------------

        fs.writeFileSync(
            jmxFile,
            jmxContent,
            "utf8"
        );

        // --------------------------------------------------
        // MCP response
        // --------------------------------------------------

        return {
            content: [
                {
                    type: "text",
                    text:
                        "JMeter JMX created successfully.\n\n" +
                        `Test Type : ${testType}\n` +
                        `File      : ${jmxFile}\n` +
                        `Users     : ${users}\n` +
                        `Ramp-up   : ${rampUp} seconds\n` +
                        `Duration  : ${duration} seconds\n` +
                        `Method    : ${method}\n` +
                        `Endpoint  : ${endpoint}\n` +
                        `Expected  : HTTP ${expectedStatus}\n` +
                        `Assertion : ${assertionText || "HTTP status assertion"}`
                }
            ]
        };
    }
);

// --------------------------------------------------
// Start MCP Server
// --------------------------------------------------

async function main() {

    const transport =
        new StdioServerTransport();

    await server.connect(
        transport
    );
}

main().catch(error => {

    console.error(
        "JMeter MCP Server failed:",
        error
    );

    process.exit(1);
});