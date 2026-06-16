// test-token.js — isolated test of the JWT bearer token exchange.
// Run from the server/ folder:  node test-token.js
//
// Prints the access token + instance URL on success, or the full
// Salesforce error body on failure (which is what you actually need
// to debug — JWT errors are opaque without it).

const jwt = require("jsonwebtoken");
const fs = require("fs");
require("dotenv").config();

const {
  SF_LOGIN_URL = "https://infinitronsolutions-dev-ed.develop.my.salesforce.com",
  SF_CLIENT_ID,
  SF_USERNAME,
  SF_PRIVATE_KEY_PATH = "./server.key",
} = process.env;

function requireVar(name, value) {
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}
requireVar("SF_CLIENT_ID", SF_CLIENT_ID);
requireVar("SF_USERNAME", SF_USERNAME);

let privateKey;
try {
  privateKey = fs.readFileSync(SF_PRIVATE_KEY_PATH, "utf8");
} catch (e) {
  console.error(`Could not read private key at ${SF_PRIVATE_KEY_PATH}: ${e.message}`);
  process.exit(1);
}

async function main() {
  console.log("--- Config ---");
  console.log("login url :", SF_LOGIN_URL);
  console.log("client id :", SF_CLIENT_ID.slice(0, 12) + "…");
  console.log("username  :", SF_USERNAME);
  console.log("key file  :", SF_PRIVATE_KEY_PATH);
  console.log();

  const claims = {
    iss: SF_CLIENT_ID,
    sub: SF_USERNAME,
    aud: SF_LOGIN_URL, // MUST match the login host exactly
    exp: Math.floor(Date.now() / 1000) + 3 * 60,
  };

  let assertion;
  try {
    assertion = jwt.sign(claims, privateKey, { algorithm: "RS256" });
  } catch (e) {
    console.error("Failed to sign JWT — check the private key is valid PEM:", e.message);
    process.exit(1);
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`AUTH FAILED (HTTP ${res.status})`);
    console.error(text);
    console.error("\nCommon causes:");
    console.error("  invalid_grant + 'user hasn't approved' -> run-as user not pre-authorized (Policies)");
    console.error("  invalid_grant + 'invalid assertion'    -> aud/iss/sub mismatch or cert not matching key");
    console.error("  invalid_client_id                      -> wrong Consumer Key");
    console.error("  invalid_app_access / inactive          -> app/user inactive, or cert still propagating (wait a few min)");
    process.exit(1);
  }

  const data = JSON.parse(text);
  console.log("AUTH OK ✅");
  console.log("access_token:", data.access_token.slice(0, 18) + "…");
  console.log("instance_url:", data.instance_url);
  console.log("token_type  :", data.token_type);
  console.log("scope       :", data.scope);

  // Bonus: prove the token works with a trivial query.
  const q = encodeURIComponent("SELECT Id, Name FROM Account LIMIT 1");
  const qres = await fetch(`${data.instance_url}/services/data/v60.0/query?q=${q}`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const qdata = await qres.json();
  console.log("\nTest query result:");
  console.log(JSON.stringify(qdata, null, 2));
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
