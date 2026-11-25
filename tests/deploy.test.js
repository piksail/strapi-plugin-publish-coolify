const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScript(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", compiled)(
    module.exports,
    require,
    module,
  );
  return module.exports;
}

const createService = loadTypeScript("server/src/services/service.ts").default;
const createController = loadTypeScript(
  "server/src/controllers/controller.ts",
).default;
const { getDeployErrorDetails } = loadTypeScript(
  "admin/src/utils/getDeployErrorDetails.ts",
);

function createStrapi(config) {
  const errors = [];
  const strapi = {
    config: { get: () => config },
    log: { error: (message) => errors.push(message) },
    plugin: () => ({ service: () => createService({ strapi }) }),
  };
  return { strapi, errors };
}

const config = {
  coolifyApiUrl: "https://coolify.example/api/v1",
  coolifyAppUuid: "app-uuid",
  coolifyToken: "test-token",
};

test("deploy sends a POST to Coolify with the existing parameters", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response('{"deployments":[]}', { status: 200 });
  };
  try {
    const { strapi } = createStrapi(config);
    const ctx = {};
    await createController({ strapi }).deploy(ctx);
    assert.equal(
      request.url,
      "https://coolify.example/api/v1/deploy?uuid=app-uuid&force=false",
    );
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.Authorization, "Bearer test-token");
    assert.equal(ctx.status, 200);
    assert.equal(ctx.body.success, true);
    assert.equal(ctx.body.response, '{"deployments":[]}');
  } finally {
    global.fetch = originalFetch;
  }
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
    assert.equal(ctx.body.details, `Webhook request failed: ${details}`);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Deploy controller error:/);
    assert.ok(errors[0].includes(details));
    assert.equal(
      getDeployErrorDetails({ response: { data: ctx.body } }),
      ctx.body.details,
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
  assert.match(ctx.body.details, /COOLIFY_TOKEN/);
  assert.ok(errors[0].includes(ctx.body.details));
  assert.equal(getDeployErrorDetails(new Error("network error")), undefined);
  assert.equal(
    getDeployErrorDetails({ response: { data: { details: {} } } }),
    undefined,
  );
});
