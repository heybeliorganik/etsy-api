import { neon } from "@neondatabase/serverless";

function cleanSecret(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D\u200B-\u200D\uFEFF]/g, "");
}

export default async function handler(req, res) {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const keystring = cleanSecret(process.env.ETSY_API_KEY);
    const sharedSecret = cleanSecret(process.env.ETSY_SHARED_SECRET);

    if (!databaseUrl || !keystring || !sharedSecret) {
      return res.status(500).json({
        success: false,
        error: "DATABASE_URL veya Etsy API bilgileri eksik."
      });
    }

    const sql = neon(databaseUrl);

    const rows = await sql`
      SELECT access_token, expires_at
      FROM etsy_tokens
      WHERE shop_key = 'main'
      LIMIT 1
    `;

    if (!rows.length || !rows[0].access_token) {
      return res.status(500).json({
        success: false,
        error: "Veritabanında access token bulunamadı."
      });
    }

    const accessToken = cleanSecret(rows[0].access_token);

    const userId = accessToken.split(".")[0];

    if (!userId || !/^\d+$/.test(userId)) {
      return res.status(500).json({
        success: false,
        error: "Access token içinden Etsy user_id alınamadı."
      });
    }

    const response = await fetch(
      `https://api.etsy.com/v3/application/users/${userId}/shops`,
      {
        method: "GET",
        headers: {
          "x-api-key": `${keystring}:${sharedSecret}`,
          "Authorization": `Bearer ${accessToken}`
        }
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
      shop_id: data.shop_id,
      user_id: data.user_id,
      shop_name: data.shop_name,
      currency_code: data.currency_code,
      title: data.title
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Etsy mağaza bilgileri alınamadı.",
      details: error.message
    });
  }
}
