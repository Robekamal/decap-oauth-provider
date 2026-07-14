const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const ORIGIN = process.env.ORIGIN || "https://elmmdo.github.io";

app.use(cors());

app.get("/", (req, res) => {
  res.send("Decap CMS GitHub OAuth Provider is running.");
});

app.get("/auth", (req, res) => {
  const state = req.query.state || "";
  const scope = "repo,user";

  const redirectUri = `${req.protocol}://${req.get("host")}/callback`;

  const githubAuthUrl =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(githubAuthUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state || "";

  if (!code) {
    return res.send(renderError("No code provided"));
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.send(renderError(tokenData.error_description || tokenData.error));
    }

    const token = tokenData.access_token;

    if (!token) {
      return res.send(renderError("No access token received"));
    }

    const message = {
      token,
      provider: "github",
      state
    };

    res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authentication Complete</title>
</head>
<body>
  <script>
    (function() {
      const message = 'authorization:github:success:${JSON.stringify(message)}';
      if (window.opener) {
        window.opener.postMessage(message, '${ORIGIN}');
        window.close();
      } else {
        document.body.innerText = 'Authentication complete. You can close this window.';
      }
    })();
  </script>
</body>
</html>
    `);
  } catch (error) {
    res.send(renderError(error.message));
  }
});

function renderError(error) {
  const safeError = String(error).replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authentication Error</title>
</head>
<body>
  <script>
    const message = 'authorization:github:error:${JSON.stringify({ error: safeError })}';
    if (window.opener) {
      window.opener.postMessage(message, '${ORIGIN}');
      window.close();
    } else {
      document.body.innerText = 'Authentication failed: ${safeError}';
    }
  </script>
</body>
</html>
  `;
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`OAuth provider running on port ${PORT}`);
});
