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

    const tokenRows = await sql`
      SELECT access_token
      FROM etsy_tokens
      WHERE shop_key = 'main'
      LIMIT 1
    `;

    if (!tokenRows.length || !tokenRows[0].access_token) {
      return res.status(500).json({
        success: false,
        error: "Veritabanında access token bulunamadı."
      });
    }

    const accessToken = cleanSecret(tokenRows[0].access_token);
    const userId = accessToken.split(".")[0];

    const shopResponse = await fetch(
      `https://api.etsy.com/v3/application/users/${userId}/shops`,
      {
        headers: {
          "x-api-key": `${keystring}:${sharedSecret}`,
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );

    const shopData = await shopResponse.json();

    if (!shopResponse.ok || !shopData.shop_id) {
      return res.status(shopResponse.status).json({
        success: false,
        error: "Shop ID alınamadı.",
        details: shopData
      });
    }

    const shopId = shopData.shop_id;

    const listingsResponse = await fetch(
      `https://api.etsy.com/v3/application/shops/${shopId}/listings?state=active&limit=100`,
      {
        headers: {
          "x-api-key": `${keystring}:${sharedSecret}`,
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );

    const data = await listingsResponse.json();

    if (!listingsResponse.ok) {
      return res.status(listingsResponse.status).json({
        success: false,
        error: "Etsy ilanları alınamadı.",
        details: data
      });
    }

    const listings = (data.results || []).map((item) => ({
      listing_id: item.listing_id,
      title: item.title,
      state: item.state,
      quantity: item.quantity,
      price: item.price,
      url: item.url,
      views: item.views,
      num_favorers: item.num_favorers
    }));

    return res.status(200).json({
      success: true,
      shop_id: shopId,
      count: data.count,
      returned: listings.length,
      listings
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Listing işlemi başarısız.",
      details: error.message
    });
  }
}
