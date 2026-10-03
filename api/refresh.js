import { neon } from "@neondatabase/serverless";

function cleanSecret(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D\u200B-\u200D\uFEFF]/g, "");
}

export default async function handler(req, res) {
  try {
    const clientId = cleanSecret(process.env.ETSY_API_KEY);
    const envRefreshToken = cleanSecret(process.env.ETSY_REFRESH_TOKEN);
    const databaseUrl = process.env.DATABASE_URL;

    if (!clientId || !envRefreshToken || !databaseUrl) {
      return res.status(500).json({
        success: false,
        error: "ETSY_API_KEY, ETSY_REFRESH_TOKEN veya DATABASE_URL eksik."
      });
    }

    const sql = neon(databaseUrl);

    const existingRows = await sql`
      SELECT refresh_token
      FROM etsy_tokens
      WHERE shop_key = 'main'
      LIMIT 1
    `;

    const refreshToken =
      cleanSecret(existingRows?.[0]?.refresh_token || envRefreshToken);

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

    const accessToken = cleanSecret(data.access_token);
    const newRefreshToken = cleanSecret(
      data.refresh_token || refreshToken
    );
    const expiresIn = Number(data.expires_in || 3600);
    const scope = String(data.scope || "");

    const expiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    await sql`
      INSERT INTO etsy_tokens (
        shop_key,
        access_token,
        refresh_token,
        expires_at,
        scope,
        updated_at
      )
      VALUES (
        'main',
        ${accessToken},
        ${newRefreshToken},
        ${expiresAt},
        ${scope},
        NOW()
      )
      ON CONFLICT (shop_key)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        updated_at = NOW()
    `;

    return res.status(200).json({
      success: true,
      token_saved_to_database: true,
      expires_in: expiresIn,
      refresh_token_received: Boolean(data.refresh_token),
      scope
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Etsy token yenileme ve veritabanına kaydetme başarısız.",
      details: error.message
    });
  }
}
