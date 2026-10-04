import { neon } from "@neondatabase/serverless";

function normalize(text) {
  return String(text || "").toLowerCase();
}

function getProductType(title) {
  const t = normalize(title);

  if (t.includes("3-piece") || t.includes("3 piece")) {
    return "SET";
  }

  if (t.includes("crib bedding")) {
    return "CRIB_BEDDING";
  }

  if (t.includes("blanket")) {
    return "BLANKET";
  }

  return "OTHER";
}

function getColor(title) {
  const t = normalize(title);

  const colors = [
    ["white", "White"],
    ["beige", "Beige"],
    ["sage green", "Sage Green"],
    ["mustard yellow", "Mustard Yellow"],
    ["blush pink", "Blush Pink"],
    ["light gray", "Light Gray"],
    ["charcoal gray", "Charcoal Gray"],
    ["terracotta", "Terracotta"],
    ["blue", "Blue"],
    ["gray", "Gray"]
  ];

  for (const [key, value] of colors) {
    if (t.includes(key)) {
      return value;
    }
  }

  return "Unknown";
}

function buildKeywordDirection(productType, color) {
  if (productType === "SET") {
    return [
      "organic baby blanket set",
      "cotton baby gift set",
      "newborn blanket set",
      "baby shower gift",
      "breathable baby blanket"
    ];
  }

  if (productType === "CRIB_BEDDING") {
    return [
      "organic crib bedding",
      "cotton crib bedding",
      "baby bedding set",
      "breathable crib bedding",
      "nursery bedding"
    ];
  }

  return [
    "organic cotton baby blanket",
    "breathable baby blanket",
    "newborn baby blanket",
    "baby shower gift",
    `${color.toLowerCase()} baby blanket`
  ];
}

function buildTitleDirection(productType, color) {
  if (productType === "SET") {
    return `${color} Organic Cotton Baby Blanket Set, Breathable Newborn Gift Set, OEKO-TEX Baby Shower Gift`;
  }

  if (productType === "CRIB_BEDDING") {
    return `${color} Organic Cotton Crib Bedding Set, Breathable Baby Bedding, OEKO-TEX Nursery Set`;
  }

  return `${color} Organic Cotton Baby Blanket, Breathable Newborn Blanket, OEKO-TEX Baby Shower Gift`;
}

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
        price_amount,
        price_divisor,
        currency_code,
        views,
        num_favorers,
        url
      FROM etsy_listings
      WHERE state = 'active'
      ORDER BY listing_id
    `;

    const strategy = listings.map((item) => {
      const title = String(item.title || "");
      const titleLower = normalize(title);

      const productType = getProductType(title);
      const color = getColor(title);

      const views = Number(item.views || 0);
      const favorites = Number(item.num_favorers || 0);

      const price =
        Number(item.price_divisor || 100) > 0
          ? Number(item.price_amount || 0) /
            Number(item.price_divisor || 100)
          : 0;

      const isWhiteBlanket =
        titleLower.includes("white") &&
        titleLower.includes("blanket");

      let seoPriority = "MEDIUM";
      let adPriority = "MEDIUM";
      let action = "OPTIMIZE";
      let reason = "Performance should continue to be monitored.";

      if (isWhiteBlanket) {
        seoPriority = "HIGH";
        adPriority = "HIGH";
        action = "PROTECT_AND_SCALE";
        reason =
          "Historical best seller based on 5 years of sales experience. Keep as reference product and prioritize advertising tests.";
      } else if (favorites >= 1 && views >= 5) {
        seoPriority = "HIGH";
        adPriority = "HIGH";
        action = "TEST_AND_SCALE";
        reason =
          "Product is receiving both views and favorites. Improve SEO and test advertising.";
      } else if (views >= 5) {
        seoPriority = "HIGH";
        adPriority = "MEDIUM";
        action = "SEO_FIRST";
        reason =
          "Product gets views but needs stronger conversion signals.";
      } else if (views <= 2 && favorites === 0) {
        seoPriority = "HIGH";
        adPriority = "LOW";
        action = "FIX_BEFORE_ADS";
        reason =
          "Low traffic and no favorites. Improve title, keywords and main image before spending on ads.";
      }

      const keywordDirection =
        buildKeywordDirection(productType, color);

      const suggestedTitle =
        buildTitleDirection(productType, color);

      return {
        listing_id: item.listing_id,
        current_title: title,
        product_type: productType,
        color,
        views,
        favorites,
        price,
        currency: item.currency_code,
        historical_reference: isWhiteBlanket,
        seo_priority: seoPriority,
        ad_priority: adPriority,
        action,
        reason,
        suggested_title_direction: suggestedTitle,
        keyword_direction: keywordDirection,
        url: item.url
      };
    });

    strategy.sort((a, b) => {
      const rank = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
      };

      const adDiff =
        rank[b.ad_priority] -
        rank[a.ad_priority];

      if (adDiff !== 0) {
        return adDiff;
      }

      return b.views - a.views;
    });

    return res.status(200).json({
      success: true,
      analyzed_count: strategy.length,
      important_note:
        "This endpoint creates strategy recommendations. It does not automatically change Etsy listings yet.",
      reference_product:
        "White cotton baby blanket",
      strategy
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "SEO strategy analysis failed.",
      details: error.message
    });
  }
}
