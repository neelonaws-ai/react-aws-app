// server.js — Salesforce BFF (Backend-for-Frontend)
// Holds Salesforce credentials, authenticates server-to-server,
// runs SOQL, and returns clean JSON to the React app.
//
// The browser NEVER sees Salesforce credentials or the access token.

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
require("dotenv").config();

const app = express();
app.use(express.json());

// In dev, your React app runs on a different port (e.g. 5173/3000).
// In prod (served from the same origin) you can drop CORS or lock it down.
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

// ---- Config loading --------------------------------------------------------
// On AWS, SECRET_NAME is set and we pull config from Secrets Manager at startup.
// Locally, SECRET_NAME is unset and we fall back to .env + the server.key file.
async function loadConfig() {
  if (!process.env.SECRET_NAME) {
    // Dev: read the private key from disk into the same env var the rest of
    // the code uses, so prod and dev share one code path below.
    const keyPath = process.env.SF_PRIVATE_KEY_PATH || "./server.key";
    process.env.SF_PRIVATE_KEY = fs.readFileSync(keyPath, "utf8");
    return;
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || "ap-southeast-2",
  });
  const res = await client.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME })
  );
  const cfg = JSON.parse(res.SecretString);
  process.env.SF_LOGIN_URL = cfg.SF_LOGIN_URL;
  process.env.SF_CLIENT_ID = cfg.SF_CLIENT_ID;
  process.env.SF_USERNAME = cfg.SF_USERNAME;
  process.env.SF_PRIVATE_KEY = cfg.SF_PRIVATE_KEY;
}

// Read config at call time (after loadConfig has populated process.env).
const cfg = () => ({
  loginUrl: process.env.SF_LOGIN_URL || "https://login.salesforce.com",
  clientId: process.env.SF_CLIENT_ID,
  username: process.env.SF_USERNAME,
  privateKey: process.env.SF_PRIVATE_KEY,
});

const PORT = process.env.PORT || 3001;

// ---- Token cache -----------------------------------------------------------
// Client-credentials tokens are short-lived; cache and refresh on expiry
// rather than authenticating on every request.
let cachedToken = null; // { access_token, instance_url, expiresAt }

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken;
  }

  const { loginUrl, clientId, username, privateKey } = cfg();

  // Build and sign the JWT assertion (RS256, signed with the private key).
  const assertion = jwt.sign(
    {
      iss: clientId, // Connected App consumer key
      sub: username, // the user to run as
      aud: loginUrl, // must match the login host
      exp: Math.floor(Date.now() / 1000) + 3 * 60, // short-lived: 3 min
    },
    privateKey,
    { algorithm: "RS256" }
  );

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce JWT auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    instance_url: data.instance_url,
    expiresAt: Date.now() + 25 * 60 * 1000, // refresh on 401 as a backstop
  };
  return cachedToken;
}

// ---- SOQL helper -----------------------------------------------------------
// Escape single quotes to prevent SOQL injection on the name string.
function escapeSoql(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function runQuery(soql) {
  let token = await getAccessToken();

  const doFetch = (t) =>
    fetch(
      `${t.instance_url}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${t.access_token}` } }
    );

  let res = await doFetch(token);

  // Token may have expired early — refresh once and retry.
  if (res.status === 401) {
    cachedToken = null;
    token = await getAccessToken();
    res = await doFetch(token);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOQL query failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ---- Routes ----------------------------------------------------------------

// GET /api/accounts?name=Acme  -> returns matching Account records
app.get("/api/accounts", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Provide an account name." });
  }

  // Customize the field list to whatever your org / page needs.
  const fields = [
    "Id",
    "Name",
    "AccountNumber",
    "Type",
    "Industry",
    "Phone",
    "Website",
    "BillingCity",
    "BillingState",
    "BillingCountry",
    "AnnualRevenue",
    "NumberOfEmployees",
    "Owner.Name",
  ].join(", ");

  const safeName = escapeSoql(name);
  // LIKE for partial matching; use = for exact match instead.
  const soql = `SELECT ${fields} FROM Account WHERE Name LIKE '%${safeName}%' ORDER BY Name LIMIT 25`;

  try {
    const data = await runQuery(soql);
    res.json({ count: data.totalSize, records: data.records });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not retrieve account data." });
  }
});

// GET /api/accounts/:id  -> full detail for one Account by Id
app.get("/api/accounts/:id", async (req, res) => {
  const id = escapeSoql(req.params.id);
  const soql = `SELECT Id, Name, AccountNumber, Type, Industry, Phone, Website,
    BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
    AnnualRevenue, NumberOfEmployees, Description, Owner.Name
    FROM Account WHERE Id = '${id}' LIMIT 1`;
  try {
    const data = await runQuery(soql);
    if (!data.records.length) {
      return res.status(404).json({ error: "Account not found." });
    }
    res.json(data.records[0]);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not retrieve account data." });
  }
});

// Load config (Secrets Manager on AWS, .env + file locally) before listening.
loadConfig()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SF BFF listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to load config at startup:", err);
    process.exit(1);
  });
