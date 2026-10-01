import crypto from "crypto";

function base64URLEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export default async function handler(req, res) {
  try {
    const clientId = process.env.ETSY_API_KEY;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: "ETSY_API_KEY environment variable bulunamadı."
      });
    }

    const redirectUri =
      "https://etsy-api-self.vercel.app/api/callback";

    // Etsy PKCE için güvenli rastgele verifier
    const codeVerifier = base64URLEncode(
      crypto.randomBytes(32)
    );

    // Verifier'dan SHA256 challenge oluştur
    const codeChallenge = base64URLEncode(
      crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest()
    );

    // CSRF koruması için state
    const state = base64URLEncode(
      crypto.randomBytes(24)
    );

    /*
      Şimdilik yalnızca gerçekten ihtiyacımız olan yetkileri istiyoruz.

      listings_r     = ürün/listing bilgilerini okuma
      listings_w     = başlık, açıklama, etiket vb. listing düzenleme
      shops_r        = mağaza bilgilerini okuma
      transactions_r = sipariş / satış / ödeme verilerini okuma

      Gereksiz yazma/silme yetkileri özellikle eklenmedi.
    */
    const scopes = [
      "listings_r",
      "listings_w",
      "shops_r",
      "transactions_r"
    ].join(" ");

    const params = new URLSearchParams({
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scopes,
      client_id: clientId,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    /*
      code_verifier ve state callback aşamasında tekrar gerekli.
      Şimdilik güvenli HttpOnly cookie olarak saklıyoruz.
    */
    const secureCookie =
      process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    res.setHeader("Set-Cookie", [
      `etsy_code_verifier=${encodeURIComponent(
        codeVerifier
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureCookie}`,

      `etsy_oauth_state=${encodeURIComponent(
        state
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureCookie}`
    ]);

    const authorizationUrl =
      `https://www.etsy.com/oauth/connect?${params.toString()}`;

    return res.redirect(302, authorizationUrl);

  } catch (error) {
    console.error("Etsy auth error:", error);

    return res.status(500).json({
      success: false,
      error: "Etsy yetkilendirme başlatılamadı."
    });
  }
}
