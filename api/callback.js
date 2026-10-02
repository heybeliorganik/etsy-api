function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = {};

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.trim().split("=");
    const key = parts.shift();
    const value = parts.join("=");

    if (key) {
      cookies[key] = decodeURIComponent(value || "");
    }
  });

  return cookies;
}

export default async function handler(req, res) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Etsy bağlantısı sırasında hata oluştu.",
        error,
      });
    }

    if (!code) {
      return res.status(200).json({
        success: true,
        message: "Etsy callback adresi çalışıyor.",
      });
    }

    const cookies = parseCookies(req);

    const codeVerifier = cookies.etsy_code_verifier;
    const savedState = cookies.etsy_oauth_state;

    if (!codeVerifier) {
      return res.status(400).json({
        success: false,
        error: "PKCE code verifier bulunamadı.",
      });
    }

    if (!savedState || !state || savedState !== state) {
      return res.status(400).json({
        success: false,
        error: "OAuth state doğrulaması başarısız.",
      });
    }

    const clientId = process.env.ETSY_API_KEY;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: "ETSY_API_KEY environment variable bulunamadı.",
      });
    }

    const redirectUri =
      "https://etsy-api-self.vercel.app/api/callback";

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(
      "https://api.etsy.com/v3/public/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Etsy token error:", tokenData);

      return res.status(tokenResponse.status).json({
        success: false,
        error: "Etsy access token alınamadı.",
        details: tokenData,
      });
    }

    /*
      Şimdilik tokenları ekrana TAM DEĞER olarak basmıyoruz.
      Bir sonraki adımda bunları güvenli bir veri katmanında saklayacağız.
    */

    res.setHeader("Set-Cookie", [
      "etsy_code_verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
      "etsy_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
    ]);

    return res.status(200).json({
      success: true,
      message: "Etsy mağaza bağlantısı başarıyla tamamlandı.",
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      access_token_received: Boolean(tokenData.access_token),
      refresh_token_received: Boolean(tokenData.refresh_token),
    });

  } catch (error) {
    console.error("Etsy callback error:", error);

    return res.status(500).json({
      success: false,
      error: "Etsy callback işlemi başarısız oldu.",
    });
  }
}
