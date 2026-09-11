import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { chromium } from "playwright";
import { stopOwnedChild } from "./lifecycle.mjs";

const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(harnessDir, "..", "..");
const serverScript = path.join(harnessDir, "browser_server.py");
const evidenceDir = path.join(harnessDir, "evidence");
const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "securium-m05-browser-"));
const browserExecutable = process.env.M05_BROWSER_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const mode = process.env.M05_BROWSER_MODE || "http";
const certificatePath = process.env.M05_BROWSER_CERT_PATH;
const keyPath = process.env.M05_BROWSER_KEY_PATH;
const servicePort = mode === "https" ? 443 : 80;
const attackerPort = mode === "https" ? 443 : 8080;
const fixtureHosts = ["app.local", "vuln.test", "attacker.test"];
const events = [];
const stateWaiters = [];
const serverLines = [];
let serverProcess;
let ready;
let activeScenario = "setup";
const browserNetwork = [];

fs.mkdirSync(evidenceDir, { recursive: true });

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(evidenceDir, fileName), JSON.stringify(value, null, 2) + "\n", "utf8");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function originFor(host, port = servicePort) {
  const protocol = mode === "https" ? "https" : "http";
  const defaultPort = mode === "https" ? 443 : 80;
  return `${protocol}://${host}${port === defaultPort ? "" : `:${port}`}`;
}

function attackerOriginFor(host) {
  return originFor(host, attackerPort);
}

function attackerPageOriginFor(victimHost) {
  return mode === "http" ? attackerOriginFor(victimHost) : originFor("attacker.test");
}

function crossSiteAttackerPageOrigin() {
  return originFor("attacker.test", attackerPort);
}

function siteRelation(sourceOrigin, targetOrigin) {
  const source = new URL(sourceOrigin);
  const target = new URL(targetOrigin);
  if (source.origin === target.origin) return "same-origin";
  if (source.protocol === target.protocol && source.hostname === target.hostname) return "same-site/cross-origin";
  return "cross-site/cross-origin";
}

function sanitizeHeaders(headers) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    origin: lower.origin ?? null,
    cookie_present: Boolean(lower.cookie),
    content_type: lower["content-type"] ?? null,
    csrf_header_present: Boolean(lower["x-csrf-token"]),
    sec_fetch_site: lower["sec-fetch-site"] ?? null,
    sec_fetch_mode: lower["sec-fetch-mode"] ?? null,
    referer_present: Boolean(lower.referer),
  };
}

function safeBodySummary(body) {
  const text = typeof body === "string" ? body : "";
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const result = {
    bytes: Buffer.byteLength(text),
    contains_fixture_secret: text.includes("fixture-debug-secret-do-not-log"),
    contains_query_secret: text.includes("client-supplied-secret"),
    contains_traceback: text.includes("Traceback"),
  };
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    result.keys = Object.keys(parsed).sort();
    if (["error", "changed", "theme"].some((key) => key in parsed)) {
      result.safe_fields = {};
      for (const key of ["error", "changed", "theme"]) {
        if (key in parsed && (typeof parsed[key] === "boolean" || [
          "invalid_request", "method_not_allowed", "authentication_required", "csrf_failed", "internal_error", "not_found",
        ].includes(parsed[key]))) {
          result.safe_fields[key] = parsed[key];
        }
      }
    }
    result.request_id_present = typeof parsed.request_id === "string" && /^[0-9a-f]{12}$/.test(parsed.request_id);
  }
  return result;
}

function relevantUrl(url) {
  return /\/comment|\/settings\/theme|\/debug\/fail|attacker\.test|\/attacker\.html/.test(url);
}

function redactUrl(url) {
  return url.replaceAll("client-supplied-secret", "[redacted]");
}

function errorText(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function removeRuntimeDir() {
  try {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    return { removed: !fs.existsSync(runtimeDir), error: null };
  } catch (error) {
    return { removed: false, error: errorText(error) };
  }
}

function attachPageObservers(page) {
  page.on("request", async (request) => {
    if (!relevantUrl(request.url())) return;
    let headers = {};
    try {
      headers = await request.allHeaders();
    } catch {
      headers = await request.headers();
    }
    browserNetwork.push({
      scenario: activeScenario,
      kind: "request",
      method: request.method(),
      url: redactUrl(request.url()),
      headers: sanitizeHeaders(headers),
    });
  });
  page.on("response", async (response) => {
    if (!relevantUrl(response.url())) return;
    let body = "";
    if (/\/comment|\/settings\/theme|\/debug\/fail/.test(response.url())) {
      try {
        body = await response.text();
      } catch {
        body = "";
      }
    }
    browserNetwork.push({
      scenario: activeScenario,
      kind: "response",
      status: response.status(),
      url: redactUrl(response.url()),
      body: safeBodySummary(body),
    });
  });
  page.on("requestfailed", (request) => {
    if (!relevantUrl(request.url())) return;
    browserNetwork.push({
      scenario: activeScenario,
      kind: "requestfailed",
      method: request.method(),
      url: redactUrl(request.url()),
      failure: request.failure()?.errorText ?? "unknown",
    });
  });
}

function waitForServerReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server did not become ready")), 15000);
    const fail = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
    const onLine = (line) => {
      serverLines.push(line);
      if (line.startsWith("READY ")) {
        clearTimeout(timeout);
        resolve(JSON.parse(line.slice("READY ".length)));
      }
      if (line.startsWith("START_ERROR ")) {
        fail(new Error(line));
      }
    };
    const rl = readline.createInterface({ input: serverProcess.stdout });
    rl.on("line", (line) => {
      onLine(line);
      if (line.startsWith("EVENT ")) events.push(JSON.parse(line.slice("EVENT ".length)));
      if (line.startsWith("STATE ")) {
        const snapshot = JSON.parse(line.slice("STATE ".length));
        for (const waiter of stateWaiters.splice(0)) waiter(snapshot);
      }
    });
    serverProcess.stderr.on("data", (chunk) => serverLines.push(`STDERR ${String(chunk).trim()}`));
    serverProcess.on("error", (error) => {
      serverLines.push(`PROCESS_ERROR ${errorText(error)}`);
      fail(error);
    });
    serverProcess.once("exit", (code, signal) => {
      if (code !== 0) fail(new Error(`server exited before ready code=${code} signal=${signal}`));
    });
  });
}

function askState(service) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`state timeout for ${service}`)), 5000);
    stateWaiters.push((snapshot) => {
      if (snapshot.service === service) {
        clearTimeout(timeout);
        resolve(snapshot);
      } else {
        stateWaiters.push((next) => next(snapshot));
      }
    });
    serverProcess.stdin.write(`STATE ${service}\n`);
  });
}

function eventsAfter(index, predicate = () => true) {
  return events.slice(index).filter(predicate);
}

async function waitForEvent(index, predicate, timeoutMs = 2500) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const found = eventsAfter(index, predicate);
    if (found.length) return found;
    await wait(50);
  }
  return eventsAfter(index, predicate);
}

async function setSessionCookie(page, host) {
  await page.goto(`${originFor(host)}/comment?text=session-bootstrap`, { waitUntil: "domcontentloaded" });
  const cookie = mode === "https"
    ? "session_id=alice; Path=/; Secure; SameSite=None"
    : "session_id=alice; Path=/; SameSite=Lax";
  return page.evaluate((cookieValue) => {
    document.cookie = cookieValue;
    return document.cookie.includes("session_id=");
  }, cookie);
}

async function clearSessionCookie(page, host) {
  await page.goto(`${originFor(host)}/comment?text=session-clear`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.cookie = "session_id=; Max-Age=0; Path=/; SameSite=Lax";
  });
}

async function runFetch(page, url, options) {
  const result = await page.evaluate(async ({ url: targetUrl, options: fetchOptions }) => {
    try {
      const response = await fetch(targetUrl, fetchOptions);
      const text = await response.text();
      return { resolved: true, type: response.type, status: response.status, ok: response.ok, raw_body: text };
    } catch (error) {
      return { resolved: false, error: String(error) };
    }
  }, { url, options });
  if (typeof result.raw_body === "string") {
    result.body = safeBodySummary(result.raw_body);
    delete result.raw_body;
  }
  return result;
}

async function formSubmit(page, formId) {
  return page.evaluate((id) => {
    const form = document.getElementById(id);
    if (!(form instanceof HTMLFormElement)) throw new Error(`missing form ${id}`);
    form.submit();
    return { submitted: true };
  }, formId);
}

async function xssRender(page, host, outputPath) {
  const attack = '<script>alert("xss")</script>';
  const serviceOrigin = originFor(host);
  await page.goto(`${serviceOrigin}/comment?text=${encodeURIComponent(attack)}`, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async (attackValue) => {
    const response = await fetch(`/comment?text=${encodeURIComponent(attackValue)}`);
    const payload = await response.json();
    document.body.innerHTML = "";
    const sink = document.createElement("div");
    sink.id = "observed-sink";
    sink.innerHTML = payload.html;
    document.body.append(sink);
    return {
      status: response.status,
      has_script_node: Boolean(sink.querySelector("script")),
      text_contains_attack: sink.textContent.includes(attackValue),
      inner_html_contains_raw_attack: sink.innerHTML.includes(attackValue),
      rendered_text: sink.textContent,
      serialized_html: sink.innerHTML,
    };
  }, attack);
  await page.screenshot({ path: outputPath, fullPage: true });
  return result;
}

async function stopServer() {
  return stopOwnedChild(serverProcess);
}

async function main() {
  if (!fs.existsSync(browserExecutable)) {
    throw new Error(`browser executable not found: ${browserExecutable}`);
  }

  const serverArgs = [
    "-u", serverScript,
    "--mode", mode,
    "--port", String(servicePort),
    "--attacker-port", String(attackerPort),
    "--runtime-dir", runtimeDir,
  ];
  if (mode === "https") {
    if (!certificatePath || !keyPath) {
      throw new Error("HTTPS mode requires M05_BROWSER_CERT_PATH and M05_BROWSER_KEY_PATH for a caller-supplied already-trusted certificate; trust-store mutation is not attempted");
    }
    serverArgs.push("--cert-path", certificatePath, "--key-path", keyPath);
  }
  serverProcess = spawn(process.env.PYTHON || "python", serverArgs, {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONPATH: repoRoot },
  });

  let browser;
  const result = {
    final_status: "BROWSER_VERIFICATION_NOT_RUN",
    browser: null,
    server: null,
    scenarios: {},
    browser_network: browserNetwork,
    server_events: events,
    notes: [],
    cleanup: {
      browser_closed: false,
      server_stop: null,
      runtime_dir_removed: false,
      cleanup_errors: [],
    },
  };

  try {
    ready = await waitForServerReady();
    result.server = {
      mode: ready.mode,
      port: ready.port,
      attacker_port: ready.attacker_port,
      hosts: ready.hosts,
      secure_trusted_origin: ready.secure_trusted_origin,
      certificate_material: ready.certificate_path ? "caller-supplied" : "none",
      cookie_policy: mode === "https" ? "Secure; SameSite=None" : "SameSite=Lax; Secure omitted for HTTP",
    };
    browser = await chromium.launch({
      headless: true,
      executablePath: browserExecutable,
      args: [
        "--host-resolver-rules=MAP app.local 127.0.0.1,MAP vuln.test 127.0.0.1,MAP attacker.test 127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
    result.browser = {
      name: "Chrome executable via Playwright",
      version: browser.version(),
      executable: browserExecutable,
      os: `${process.platform} ${process.arch} ${os.release()}`,
      mode,
      ignore_https_errors: false,
    };
    const context = await browser.newContext({ ignoreHTTPSErrors: false });
    const page = await context.newPage();
    attachPageObservers(page);

    activeScenario = "secure-normal";
    const secureCookieReady = await setSessionCookie(page, "app.local");
    const secureBeforeNormal = await askState("secure");
    const normal = await runFetch(page, `${originFor("app.local")}/settings/theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "alice-csrf-token" },
      body: JSON.stringify({ theme: "dark" }),
    });
    await wait(250);
    const secureAfterNormal = await askState("secure");
    result.scenarios.secure_normal = { cookie_ready: secureCookieReady, before: secureBeforeNormal, request: normal, after: secureAfterNormal };

    activeScenario = "secure-cross-origin-form";
    await page.goto(`${attackerPageOriginFor("app.local")}/attacker.html`, { waitUntil: "domcontentloaded" });
    const secureFormStart = events.length;
    const secureForm = await formSubmit(page, "secure-form");
    const secureFormEvents = await waitForEvent(secureFormStart, (event) => event.service === "secure" && event.method === "POST" && event.path === "/settings/theme");
    const secureAfterForm = await askState("secure");
    result.scenarios.secure_cross_origin_form = {
      source_origin: attackerPageOriginFor("app.local"),
      target_origin: originFor("app.local"),
      site_relation: siteRelation(attackerPageOriginFor("app.local"), originFor("app.local")),
      browser_action: secureForm,
      server_events: secureFormEvents,
      after: secureAfterForm,
    };

    activeScenario = "secure-cross-site-nocors";
    const secureNoCorsStart = events.length;
    const secureNoCors = await runFetch(page, `${originFor("app.local")}/settings/theme`, {
      method: "POST",
      mode: "no-cors",
      credentials: "include",
      body: JSON.stringify({ theme: "light" }),
    });
    const secureNoCorsEvents = await waitForEvent(secureNoCorsStart, (event) => event.service === "secure" && event.method === "POST" && event.path === "/settings/theme");
    const secureAfterNoCors = await askState("secure");
    result.scenarios.secure_cross_site_nocors = {
      source_origin: attackerPageOriginFor("app.local"),
      target_origin: originFor("app.local"),
      site_relation: siteRelation(attackerPageOriginFor("app.local"), originFor("app.local")),
      browser_result: secureNoCors,
      server_events: secureNoCorsEvents,
      after: secureAfterNoCors,
    };

    activeScenario = "secure-cross-site-form";
    await page.goto(`${crossSiteAttackerPageOrigin()}/attacker.html`, { waitUntil: "domcontentloaded" });
    const secureCrossSiteStart = events.length;
    const secureCrossSiteForm = await formSubmit(page, "secure-form");
    const secureCrossSiteEvents = await waitForEvent(secureCrossSiteStart, (event) => event.service === "secure" && event.method === "POST" && event.path === "/settings/theme");
    const secureAfterCrossSite = await askState("secure");
    result.scenarios.secure_cross_site_form = {
      source_origin: crossSiteAttackerPageOrigin(),
      target_origin: originFor("app.local"),
      site_relation: siteRelation(crossSiteAttackerPageOrigin(), originFor("app.local")),
      browser_action: secureCrossSiteForm,
      server_events: secureCrossSiteEvents,
      after: secureAfterCrossSite,
    };

    activeScenario = "secure-custom-header-cors";
    const customHeaderStart = events.length;
    const customHeader = await runFetch(page, `${originFor("app.local")}/settings/theme`, {
      method: "POST",
      mode: "cors",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "alice-csrf-token" },
      body: JSON.stringify({ theme: "light" }),
    });
    await wait(500);
    const customHeaderEvents = eventsAfter(customHeaderStart, (event) => event.service === "secure" && ["OPTIONS", "POST"].includes(event.method) && event.path === "/settings/theme");
    result.scenarios.secure_custom_header_cors = { browser_result: customHeader, server_events: customHeaderEvents, post_seen: customHeaderEvents.some((event) => event.method === "POST") };

    activeScenario = "secure-token-auth-input-method";
    await setSessionCookie(page, "app.local");
    const tokenCases = [];
    for (const testCase of [
      { name: "missing", options: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: "light" }) } },
      { name: "wrong", options: { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": "not-alice-token" }, body: JSON.stringify({ theme: "light" }) } },
      { name: "other-session", options: { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": "bob-csrf-token" }, body: JSON.stringify({ theme: "light" }) } },
    ]) {
      const before = await askState("secure");
      const request = await runFetch(page, `${originFor("app.local")}/settings/theme`, testCase.options);
      await wait(150);
      const after = await askState("secure");
      tokenCases.push({ name: testCase.name, before, request, after });
    }
    const wrongMethod = await runFetch(page, `${originFor("app.local")}/settings/theme`, { method: "GET" });
    const invalidInput = await runFetch(page, `${originFor("app.local")}/settings/theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "alice-csrf-token" },
      body: JSON.stringify({ theme: "blue" }),
    });
    result.scenarios.secure_token_auth_input_method = { token_cases: tokenCases, wrong_method: wrongMethod, invalid_input: invalidInput, final: await askState("secure") };

    activeScenario = "secure-unauthenticated";
    await clearSessionCookie(page, "app.local");
    const unauthenticated = await runFetch(page, `${originFor("app.local")}/settings/theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "alice-csrf-token" },
      body: JSON.stringify({ theme: "light" }),
    });
    await wait(150);
    result.scenarios.secure_unauthenticated = { request: unauthenticated, after: await askState("secure") };

    activeScenario = "vulnerable-cross-site-form-and-nocors";
    const vulnCookieReady = await setSessionCookie(page, "vuln.test");
    await page.goto(`${attackerPageOriginFor("vuln.test")}/attacker.html`, { waitUntil: "domcontentloaded" });
    const vulnerableFormStart = events.length;
    const vulnerableForm = await formSubmit(page, "vulnerable-form");
    const vulnerableFormEvents = await waitForEvent(vulnerableFormStart, (event) => event.service === "vulnerable" && event.method === "POST" && event.path === "/settings/theme");
    const vulnerableAfterForm = await askState("vulnerable");
    const vulnerableNoCorsStart = events.length;
    const vulnerableNoCors = await runFetch(page, `${originFor("vuln.test")}/settings/theme`, {
      method: "POST",
      mode: "no-cors",
      credentials: "include",
      body: JSON.stringify({ theme: "dark" }),
    });
    const vulnerableNoCorsEvents = await waitForEvent(vulnerableNoCorsStart, (event) => event.service === "vulnerable" && event.method === "POST" && event.path === "/settings/theme");
    const vulnerableAfterNoCors = await askState("vulnerable");
    result.scenarios.vulnerable_cross_site = {
      source_origin: attackerPageOriginFor("vuln.test"),
      target_origin: originFor("vuln.test"),
      site_relation: siteRelation(attackerPageOriginFor("vuln.test"), originFor("vuln.test")),
      cookie_ready: vulnCookieReady,
      form: { browser_action: vulnerableForm, server_events: vulnerableFormEvents, after: vulnerableAfterForm },
      no_cors: { browser_result: vulnerableNoCors, server_events: vulnerableNoCorsEvents, after: vulnerableAfterNoCors },
    };

    activeScenario = "xss-rendering";
    const vulnerableXss = await xssRender(page, "vuln.test", path.join(evidenceDir, "vulnerable-xss.png"));
    const secureXss = await xssRender(page, "app.local", path.join(evidenceDir, "secure-xss.png"));
    result.scenarios.xss_rendering = { vulnerable: vulnerableXss, secure: secureXss };

    activeScenario = "safe-failure";
    await page.goto(`${originFor("vuln.test")}/comment?text=failure-observation`, { waitUntil: "domcontentloaded" });
    const vulnerableFailure = await runFetch(page, `${originFor("vuln.test")}/debug/fail?token=client-supplied-secret`, { method: "GET" });
    await wait(150);
    const vulnerableFailureState = await askState("vulnerable");
    await page.goto(`${originFor("app.local")}/comment?text=secure-failure-observation`, { waitUntil: "domcontentloaded" });
    const secureFailure = await runFetch(page, `${originFor("app.local")}/debug/fail?token=client-supplied-secret`, { method: "GET" });
    await wait(150);
    const secureFailureState = await askState("secure");
    result.scenarios.safe_failure = {
      vulnerable: { request: vulnerableFailure, state: vulnerableFailureState },
      secure: { request: secureFailure, state: secureFailureState },
    };

    await page.screenshot({ path: path.join(evidenceDir, "attacker-page.png"), fullPage: true });
    await context.close();
    await browser.close();

    const secureNormalPass = result.scenarios.secure_normal.request.status === 200 && result.scenarios.secure_normal.after.alice_theme === "dark";
    const secureFormPass = result.scenarios.secure_cross_origin_form.server_events.some((event) => event.origin === attackerPageOriginFor("app.local") && event.cookie_present && event.method === "POST" && event.status === 403) && result.scenarios.secure_cross_origin_form.after.alice_theme === "dark";
    const secureNoCorsPass = result.scenarios.secure_cross_site_nocors.server_events.some((event) => event.origin === attackerPageOriginFor("app.local") && event.cookie_present && event.status === 403) && result.scenarios.secure_cross_site_nocors.after.alice_theme === "dark";
    const vulnerableNoCorsPass = result.scenarios.vulnerable_cross_site.no_cors.server_events.some((event) => event.origin === attackerPageOriginFor("vuln.test") && event.cookie_present && event.status === 200) && result.scenarios.vulnerable_cross_site.no_cors.after.alice_theme === "dark";
    const crossSiteExpectedCookie = mode === "https";
    const crossSiteExpectedStatus = mode === "https" ? 403 : 401;
    const crossSitePass = result.scenarios.secure_cross_site_form.server_events.some((event) => event.origin === crossSiteAttackerPageOrigin() && event.cookie_present === crossSiteExpectedCookie && event.method === "POST" && event.status === crossSiteExpectedStatus) && result.scenarios.secure_cross_site_form.after.alice_theme === "dark";
    const corsPass = result.scenarios.secure_custom_header_cors.server_events.some((event) => event.method === "OPTIONS") && !result.scenarios.secure_custom_header_cors.post_seen && !result.scenarios.secure_custom_header_cors.browser_result.resolved;
    const tokenPass = result.scenarios.secure_token_auth_input_method.token_cases.every((item) => item.request.status === 403 && item.after.alice_theme === "dark") && result.scenarios.secure_token_auth_input_method.wrong_method.status === 405 && result.scenarios.secure_token_auth_input_method.invalid_input.status === 400;
    const unauthPass = result.scenarios.secure_unauthenticated.request.status === 401 && result.scenarios.secure_unauthenticated.after.alice_theme === "dark";
    const xssPass = result.scenarios.xss_rendering.vulnerable.has_script_node && !result.scenarios.xss_rendering.secure.has_script_node && result.scenarios.xss_rendering.secure.text_contains_attack;
    const failurePass = !result.scenarios.safe_failure.secure.request.body.contains_fixture_secret && !result.scenarios.safe_failure.secure.request.body.contains_traceback && !result.scenarios.safe_failure.secure.state.logs.contains_fixture_secret && !result.scenarios.safe_failure.secure.state.logs.contains_traceback && result.scenarios.safe_failure.secure.request.body.request_id_present;
    const sameSiteObserved = mode !== "http" || (result.scenarios.secure_cross_origin_form.site_relation === "same-site/cross-origin" && result.scenarios.secure_cross_origin_form.server_events.some((event) => event.origin === attackerPageOriginFor("app.local") && event.cookie_present));
    const functionalPass = [secureNormalPass, secureFormPass, secureNoCorsPass, vulnerableNoCorsPass, crossSitePass, corsPass, tokenPass, unauthPass, xssPass, failurePass, sameSiteObserved].every(Boolean);
    if (functionalPass && mode === "https") {
      result.final_status = "SECURIUM_PYTHON_8H_M05_BROWSER_VERIFICATION_PASS";
    } else if (functionalPass && mode === "http") {
      result.final_status = "BROWSER_VERIFICATION_PARTIAL";
      result.notes.push("HTTP browser scenarios passed. HTTPS Secure-cookie/cross-site coverage remains NOT_RUN because no pre-trusted certificate was available and trust stores were not modified.");
    } else {
      result.final_status = "M05_BROWSER_REPAIR_REQUIRED";
      result.notes.push("One or more browser contract assertions failed; inspect the sanitized scenario evidence.");
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
        result.cleanup.browser_closed = true;
      } catch (error) {
        result.cleanup.cleanup_errors.push(`browser close: ${errorText(error)}`);
      }
    }
    try {
      result.cleanup.server_stop = await stopServer();
      if (result.cleanup.server_stop.cleanup_error) {
        result.cleanup.cleanup_errors.push(result.cleanup.server_stop.cleanup_error);
      }
      if (!result.cleanup.server_stop.terminated) {
        result.cleanup.cleanup_errors.push("owned server did not terminate within the cleanup deadline");
      }
    } catch (error) {
      result.cleanup.cleanup_errors.push(`server cleanup: ${errorText(error)}`);
    }
    const runtimeCleanup = removeRuntimeDir();
    result.cleanup.runtime_dir_removed = runtimeCleanup.removed;
    if (runtimeCleanup.error) {
      result.cleanup.cleanup_errors.push(`runtime directory cleanup: ${runtimeCleanup.error}`);
    }
    result.server_events = events;
    result.browser_network = browserNetwork;
    writeJson("browser-verification-result.json", result);
  }

  console.log(JSON.stringify({ final_status: result.final_status, browser: result.browser, evidence: path.join(evidenceDir, "browser-verification-result.json") }, null, 2));
  if (result.final_status !== "SECURIUM_PYTHON_8H_M05_BROWSER_VERIFICATION_PASS") process.exitCode = 1;
}

main().catch(async (error) => {
  const report = {
    final_status: "BROWSER_VERIFICATION_NOT_RUN",
    error: errorText(error),
    server_lines: serverLines,
    cleanup: {
      server_stop: null,
      runtime_dir_removed: false,
      cleanup_errors: [],
    },
    evidence: path.join(evidenceDir, "browser-verification-result.json"),
  };
  try {
    report.cleanup.server_stop = await stopServer();
    if (report.cleanup.server_stop.cleanup_error) {
      report.cleanup.cleanup_errors.push(report.cleanup.server_stop.cleanup_error);
    }
    if (!report.cleanup.server_stop.terminated) {
      report.cleanup.cleanup_errors.push("owned server did not terminate within the cleanup deadline");
    }
  } catch (cleanupError) {
    report.cleanup.cleanup_errors.push(`server cleanup: ${errorText(cleanupError)}`);
  }
  const runtimeCleanup = removeRuntimeDir();
  report.cleanup.runtime_dir_removed = runtimeCleanup.removed;
  if (runtimeCleanup.error) {
    report.cleanup.cleanup_errors.push(`runtime directory cleanup: ${runtimeCleanup.error}`);
  }
  writeJson("browser-verification-result.json", report);
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 2;
});
