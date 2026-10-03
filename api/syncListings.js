import { neon } from "@neondatabase/serverless";
import { etsyFetch } from "./etsyClient.js";

export default async function handler(req, res) {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        success: false,
        error: "DATABASE_URL eksik."
      });
    }

    const sql = neon(databaseUrl);
    const shopId = 67653092;

    const response = await etsyFetch(
      `/application/shops/${shopId}/listings?state=active&limit=100`
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Etsy ilanları alınamadı.",
        details: data
      });
    }

    const listings = data.results || [];

    for (const item of listings) {
      await sql`
        INSERT INTO etsy_listings (
          listing_id,
          title,
          state,
          quantity,
          price_amount,
          price_divisor,
          currency_code,
          url,
          views,
          num_favorers,
          synced_at
        )
        VALUES (
          ${item.listing_id},
          ${item.title || ""},
          ${item.state || ""},
          ${Number(item.quantity || 0)},
          ${Number(item.price?.amount || 0)},
          ${Number(item.price?.divisor || 100)},
          ${item.price?.currency_code || ""},
          ${item.url || ""},
          ${Number(item.views || 0)},
          ${Number(item.num_favorers || 0)},
          NOW()
        )
        ON CONFLICT (listing_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          state = EXCLUDED.state,
          quantity = EXCLUDED.quantity,
          price_amount = EXCLUDED.price_amount,
          price_divisor = EXCLUDED.price_divisor,
          currency_code = EXCLUDED.currency_code,
          url = EXCLUDED.url,
          views = EXCLUDED.views,
          num_favorers = EXCLUDED.num_favorers,
          synced_at = NOW()
      `;
    }

    return res.status(200).json({
      success: true,
      synced: listings.length,
      shop_id: shopId
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Listing senkronizasyonu başarısız.",
      details: error.message
    });
  }
}
