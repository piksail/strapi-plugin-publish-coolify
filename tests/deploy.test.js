const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScript(relativePath, requireModule = require) {
  const filename = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", compiled)(
    module.exports,
    requireModule,
    module,
  );
  return module.exports;
}

const createService = loadTypeScript(
  "server/src/services/service.ts",
  (name) =>
    name === "node:timers/promises"
      ? { setTimeout: async () => {} }
      : require(name),
).default;
const createController = loadTypeScript(
  "server/src/controllers/controller.ts",
).default;
const { getDeployErrorDetails } = loadTypeScript(
  "admin/src/utils/getDeployErrorDetails.ts",
);

function createStrapi(config, onLog = () => {}) {
  const errors = [];
  const warnings = [];
  const info = [];
  const strapi = {
    config: { get: () => config },
    log: {
      error: (message) => {
        errors.push(message);
        onLog(message);
      },
      warn: (message) => {
        warnings.push(message);
        onLog(message);
      },
      info: (message) => {
        info.push(message);
        onLog(message);
      },
    },
    plugin: () => ({ service: () => service }),
  };
  const service = createService({ strapi });
  return { strapi, service, errors, warnings, info };
}

const config = {
  coolifyApiUrl: "https://coolify.example/api/v1",
  coolifyAppUuid: "app-uuid",
  coolifyToken: "test-token",
};

test(
  "deploy queues with POST and forwards only new visible logs to Strapi",
  { timeout: 1000 },
  async (t) => {
    const receipt = {
      deployments: [{ resource_uuid: "app-uuid", deployment_uuid: "dep-1" }],
    };
    const firstLogs = [{ output: "Building", hidden: false, type: "stdout" }];
    const finalLogs = [
      ...firstLogs,
      { output: "do not log", hidden: true, type: "stderr" },
      { output: "Build error: test-token", hidden: false, type: "stderr" },
    ];
    const replies = [
      receipt,
      { status: "in_progress", logs: JSON.stringify(firstLogs) },
      { status: "failed", logs: JSON.stringify(firstLogs) },
      { status: "failed", logs: JSON.stringify(finalLogs) },
    ];
    const fetch = t.mock.method(global, "fetch", async () =>
      Response.json(replies.shift()),
    );
    let resolve;
    const finished = new Promise((done) => {
      resolve = done;
    });
    const { strapi, info, errors, warnings } = createStrapi(
      config,
      (message) => {
        if (message === "Coolify deployment dep-1: failed") resolve();
      },
    );
    const ctx = {};
    await createController({ strapi }).deploy(ctx);
    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(
      url,
      "https://coolify.example/api/v1/deploy?uuid=app-uuid&force=false",
    );
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(ctx.status, 200);
    assert.equal(ctx.body.success, true);
    assert.equal(ctx.body.deploymentUuid, "dep-1");
    await finished;
    for (const call of fetch.mock.calls.slice(1)) {
      assert.equal(
        call.arguments[0],
        "https://coolify.example/api/v1/deployments/dep-1",
      );
      assert.equal(
        call.arguments[1].headers.Authorization,
        "Bearer test-token",
      );
    }
    assert.equal(fetch.mock.callCount(), 4);
    assert.deepEqual(info, [
      "Coolify deployment dep-1: queued",
      "Coolify deployment dep-1: Building",
    ]);
    assert.deepEqual(warnings, [
      "Coolify deployment dep-1: Build error: [redacted]",
    ]);
    assert.deepEqual(errors, ["Coolify deployment dep-1: failed"]);
  },
);

test("a 200 without a deployment UUID is reported as a queueing failure", async (t) => {
  const fetch = t.mock.method(global, "fetch", async () =>
    Response.json({
      deployments: [
        {
          resource_uuid: "app-uuid",
          message: "Unauthorized to deploy this application.",
        },
      ],
    }),
  );
  const { strapi, errors } = createStrapi(config);
  const ctx = {};
  await createController({ strapi }).deploy(ctx);
  assert.equal(ctx.status, 502);
  assert.equal(ctx.body.success, false);
  assert.match(ctx.body.error.message, /Unauthorized to deploy/);
  assert.ok(errors[0].includes(ctx.body.error.message));
  assert.equal(fetch.mock.callCount(), 1);
});

test(
  "Strapi can respond before logs arrive and abort the poll on shutdown",
  { timeout: 1000 },
  async (t) => {
    let pollSignal;
    const fetch = t.mock.method(global, "fetch", async (_, options) => {
      if (options.method === "POST") {
        return Response.json({
          deployments: [
            { resource_uuid: "app-uuid", deployment_uuid: "dep-1" },
          ],
        });
      }
      pollSignal = options.signal;
      return new Promise((_, reject) => {
        pollSignal.addEventListener("abort", () => reject(pollSignal.reason), {
          once: true,
        });
      });
    });
    const { strapi, service, errors } = createStrapi(config);
    try {
      const ctx = {};
      await createController({ strapi }).deploy(ctx);
      assert.equal(ctx.status, 200);
      assert.equal(pollSignal.aborted, false);
    } finally {
      service.stopTrackingDeployments();
    }
    await new Promise(setImmediate);
    assert.equal(pollSignal.aborted, true);
    assert.equal(fetch.mock.callCount(), 2);
    assert.deepEqual(errors, []);
  },
);

test("the deployment history does not expose log or configuration contents", async (t) => {
  t.mock.method(global, "fetch", async () =>
    Response.json({
      count: 1,
      deployments: [
        {
          id: 1,
          finished_at: "2026-11-25 18:00:00",
          logs: "internal output",
          configuration_snapshot: { internal: "config" },
          configuration_diff: { internal: "change" },
        },
      ],
    }),
  );
  const { service } = createStrapi(config);
  assert.deepEqual(await service.listDeployments(), {
    count: 1,
    deployments: [{ id: 1, finished_at: "2026-11-25T18:00:00.000000Z" }],
  });
});

test("deploy logs and returns the Coolify error, including its status", async () => {
  const originalFetch = global.fetch;
  const details = '{"message":"This endpoint has changed to a POST request."}';
  global.fetch = async () => new Response(details, { status: 405 });
  try {
    const { strapi, errors } = createStrapi(config);
    const ctx = {};
    await createController({ strapi }).deploy(ctx);
    assert.equal(ctx.status, 405);
    assert.equal(
      ctx.body.error.message,
      `Coolify deploy request failed: ${details}`,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Deploy controller error:/);
    assert.ok(errors[0].includes(details));
    assert.equal(
      getDeployErrorDetails({ response: { data: ctx.body } }),
      ctx.body.error.message,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("deploy logs configuration errors and the UI falls back for missing details", async () => {
  const { strapi, errors } = createStrapi({ ...config, coolifyToken: "" });
  const ctx = {};
  await createController({ strapi }).deploy(ctx);
  assert.equal(ctx.status, 500);
  assert.match(ctx.body.error.message, /COOLIFY_TOKEN/);
  assert.ok(errors[0].includes(ctx.body.error.message));
  assert.equal(getDeployErrorDetails(new Error("network error")), undefined);
  assert.equal(
    getDeployErrorDetails({ response: { data: { error: {} } } }),
    undefined,
  );
});
