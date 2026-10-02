function cleanSecret(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D\u200B-\u200D\uFEFF]/g, "");
}

export default async function handler(req, res) {
  try {
    const clientId = cleanSecret(process.env.ETSY_API_KEY);
    const refreshToken = cleanSecret(process.env.ETSY_REFRESH_TOKEN);

    if (!clientId || !refreshToken) {
      return res.status(500).json({
        success: false,
        error: "ETSY_API_KEY veya ETSY_REFRESH_TOKEN eksik."
      });
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken
    });

    const response = await fetch(
      "https://api.etsy.com/v3/public/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        error: data
      });
    }

    return res.status(200).json({
      success: true,
      token_type: data.token_type,
      expires_in: data.expires_in,
      access_token_received: Boolean(data.access_token),
      refresh_token_received: Boolean(data.refresh_token),
      scope: data.scope
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Refresh testi başarısız.",
      details: error.message
    });
  }
}
