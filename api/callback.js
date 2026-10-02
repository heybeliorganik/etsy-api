function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};

  header.split(";").forEach((item) => {
    const index = item.indexOf("=");

    if (index === -1) return;

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
  });

  return cookies;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  try {
    const { code, state, error, error_description } = req.query;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Referrer-Policy", "no-referrer");

    if (error) {
      return res.status(400).json({
        success: false,
        error,
        error_description:
          error_description || "Etsy yetkilendirmesi başarısız oldu."
      });
    }

    if (!code) {
      return res.status(200).json({
        success: true,
        message: "Etsy callback adresi çalışıyor."
      });
    }

    const cookies = parseCookies(req);

    const codeVerifier = cookies.etsy_code_verifier;
    const savedState = cookies.etsy_oauth_state;

    if (!codeVerifier) {
      return res.status(400).json({
        success: false,
        error: "PKCE code verifier bulunamadı. /api/auth adresinden yeniden başlat."
      });
    }

    if (!savedState || !state || savedState !== state) {
      return res.status(400).json({
        success: false,
        error: "OAuth state doğrulaması başarısız."
      });
    }

    const clientId = String(
      process.env.ETSY_API_KEY || ""
    ).trim();

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: "ETSY_API_KEY bulunamadı."
      });
    }

    const redirectUri =
      "https://etsy-api-self.vercel.app/api/callback";

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code: String(code),
      code_verifier: codeVerifier
    });

    const response = await fetch(
      "https://api.etsy.com/v3/public/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: body.toString()
      }
    );

    const tokenData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Etsy token alınamadı.",
        details: tokenData
      });
    }

    if (!tokenData.refresh_token) {
      return res.status(500).json({
        success: false,
        error: "Etsy refresh token göndermedi."
      });
    }

    res.setHeader("Set-Cookie", [
      "etsy_code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "etsy_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    ]);

    const refreshToken =
      escapeHtml(tokenData.refresh_token);

    const scope =
      escapeHtml(tokenData.scope || "");

    return res.status(200).send(`
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow">
  <title>Etsy bağlantısı tamamlandı</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:20px;">
  <h1>Etsy bağlantısı başarılı</h1>

  <p>
    Refresh token aşağıda. Bunu Vercel'de
    ETSY_REFRESH_TOKEN adıyla Secret olarak kaydet.
  </p>

  <p>
    Bu değeri kimseyle paylaşma ve ekran görüntüsünü gönderme.
  </p>

  <textarea
    readonly
    style="width:100%;height:120px;font-family:monospace;font-size:14px;"
  >${refreshToken}</textarea>

  <p>
    Access token süresi:
    ${Number(tokenData.expires_in || 0)} saniye
  </p>

  <p>
    Yetkiler:
    ${scope}
  </p>
</body>
</html>
    `);

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Etsy callback işlemi başarısız.",
      details: err.message
    });
  }
}
