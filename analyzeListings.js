import { neon } from "@neondatabase/serverless";

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

    const listings = await sql`
      SELECT
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
      FROM etsy_listings
      WHERE state = 'active'
      ORDER BY listing_id
    `;

    const analyzed = listings.map((item) => {
      const title = String(item.title || "").toLowerCase();

      const views = Number(item.views || 0);
      const favorites = Number(item.num_favorers || 0);

      let score = 50;
      let historicalBonus = 0;

      // 5 yillik satis tecrubesine gore
      // beyaz battaniye bizim baslangic referans urunumuz.
      if (
        title.includes("white") &&
        title.includes("blanket")
      ) {
        historicalBonus = 30;
        score += historicalBonus;
      }

      // Goruntulenme katkisi
      score += Math.min(views * 0.25, 20);

      // Favori katkisi
      score += Math.min(favorites * 4, 20);

      let priority = "NORMAL";

      if (score >= 80) {
        priority = "HIGH";
      } else if (score < 55) {
        priority = "LOW";
      }

      let recommendation = "Takip etmeye devam et.";

      if (priority === "HIGH") {
        recommendation =
          "SEO ve reklam icin oncelikli urun.";
      }

      if (priority === "LOW") {
        recommendation =
          "Baslik, anahtar kelime ve ana gorsel optimize edilmeli.";
      }

      return {
        listing_id: item.listing_id,
        title: item.title,
        views,
        favorites,
        historical_bonus: historicalBonus,
        score: Math.round(score * 100) / 100,
        priority,
        recommendation,
        url: item.url
      };
    });

    analyzed.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      success: true,
      analyzed_count: analyzed.length,
      strategy: {
        historical_reference:
          "White blanket is the historical best seller based on 5 years of sales experience.",
        scoring:
          "Historical knowledge + Etsy views + Etsy favorites"
      },
      listings: analyzed
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Listing analizi basarisiz.",
      details: error.message
    });
  }
}
