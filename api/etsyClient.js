import { neon } from "@neondatabase/serverless";

function cleanSecret(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D\u200B-\u200D\uFEFF]/g, "");
}

export async function getValidEtsyAuth() {
  const databaseUrl = process.env.DATABASE_URL;
  const clientId = cleanSecret(process.env.ETSY_API_KEY);
  const sharedSecret = cleanSecret(process.env.ETSY_SHARED_SECRET);
  const envRefreshToken = cleanSecret(process.env.ETSY_REFRESH_TOKEN);

  if (!databaseUrl || !clientId || !sharedSecret) {
    throw new Error("DATABASE_URL veya Etsy API bilgileri eksik.");
  }

  const sql = neon(databaseUrl);

  const rows = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM etsy_tokens
    WHERE shop_key = 'main'
    LIMIT 1
  `;

  let accessToken = cleanSecret(rows?.[0]?.access_token);
  let refreshToken = cleanSecret(
    rows?.[0]?.refresh_token || envRefreshToken
  );

  const expiresAt = rows?.[0]?.expires_at
    ? new Date(rows[0].expires_at).getTime()
    : 0;

  const refreshNeeded =
    !accessToken ||
    !expiresAt ||
    Date.now() > expiresAt - 5 * 60 * 1000;

  if (refreshNeeded) {
    if (!refreshToken) {
      throw new Error("Refresh token bulunamadı.");
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
      throw new Error(
        `Etsy token yenileme hatası: ${JSON.stringify(data)}`
      );
    }

    accessToken = cleanSecret(data.access_token);
    refreshToken = cleanSecret(
      data.refresh_token || refreshToken
    );

    const expiresIn = Number(data.expires_in || 3600);

    const newExpiresAt = new Date(
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
        ${refreshToken},
        ${newExpiresAt},
        ${String(data.scope || "")},
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
  }

  return {
    accessToken,
    apiKeyHeader: `${clientId}:${sharedSecret}`
  };
}

export async function etsyFetch(path, options = {}) {
  const { accessToken, apiKeyHeader } =
    await getValidEtsyAuth();

  const headers = {
    "x-api-key": apiKeyHeader,
    "Authorization": `Bearer ${accessToken}`,
    ...(options.headers || {})
  };

  return fetch(
    `https://api.etsy.com/v3${path}`,
    {
      ...options,
      headers
    }
  );
}
