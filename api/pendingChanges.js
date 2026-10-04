import { neon } from "@neondatabase/serverless";

function normalize(text) {
  return String(text || "").toLowerCase();
}

function getProductType(title) {
  const t = normalize(title);

  if (t.includes("crib bedding")) {
    return "CRIB_BEDDING";
  }

  if (t.includes("3-piece") || t.includes("3 piece")) {
    return "SET";
  }

  if (t.includes("blanket")) {
    return "BLANKET";
  }

  return "OTHER";
}

function getColor(title) {
  const t = normalize(title);

  const colors = [
    ["sage green", "Sage Green"],
    ["mustard yellow", "Mustard Yellow"],
    ["blush pink", "Blush Pink"],
    ["light gray", "Light Gray"],
    ["charcoal gray", "Charcoal Gray"],
    ["terracotta", "Terracotta"],
    ["white", "White"],
    ["beige", "Beige"],
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

function buildSuggestedTitle(productType, color) {
  if (productType === "CRIB_BEDDING") {
    return `${color} Organic Cotton Crib Bedding Set, Breathable Baby Bedding, OEKO-TEX Nursery Set`;
  }

  if (productType === "SET") {
    return `${color} Organic Cotton Baby Blanket Set, Breathable Newborn Gift Set, OEKO-TEX Baby Shower Gift`;
  }

  return `${color} Organic Cotton Baby Blanket, Breathable Newborn Blanket, OEKO-TEX Baby Shower Gift`;
}

function buildKeywords(productType, color) {
  if (productType === "CRIB_BEDDING") {
    return [
      "organic crib bedding",
      "cotton crib bedding",
      "baby bedding set",
      "breathable crib bedding",
      "nursery bedding"
    ];
  }

  if (productType === "SET") {
    return [
      "organic baby blanket set",
      "cotton baby gift set",
      "newborn blanket set",
      "baby shower gift",
      "breathable baby blanket"
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
        views,
        num_favorers,
        url
      FROM etsy_listings
      WHERE state = 'active'
      ORDER BY listing_id
    `;

    const pendingChanges = listings.map((item) => {
      const title = String(item.title || "");
      const titleLower = normalize(title);

      const productType = getProductType(title);
      const color = getColor(title);

      const views = Number(item.views || 0);
      const favorites = Number(item.num_favorers || 0);

      const isWhiteBlanket =
        titleLower.includes("white") &&
        titleLower.includes("blanket");

      let seoPriority = "MEDIUM";
      let adPriority = "MEDIUM";
      let reason = "Performance should continue to be monitored.";

      if (isWhiteBlanket) {
        seoPriority = "HIGH";
        adPriority = "HIGH";
        reason =
          "Historical best seller based on 5 years of sales experience. Protect and scale carefully.";
      } else if (favorites >= 1 && views >= 5) {
        seoPriority = "HIGH";
        adPriority = "HIGH";
        reason =
          "Product receives both views and favorites. Strong candidate for optimization and ad testing.";
      } else if (views >= 5) {
        seoPriority = "HIGH";
        adPriority = "MEDIUM";
        reason =
          "Product receives traffic but needs stronger conversion signals.";
      } else if (views <= 2 && favorites === 0) {
        seoPriority = "HIGH";
        adPriority = "LOW";
        reason =
          "Low traffic and no favorites. Improve SEO before spending on ads.";
      }

      const suggestedTitle =
        buildSuggestedTitle(productType, color);

      const keywords =
        buildKeywords(productType, color);

      return {
        listing_id: item.listing_id,
        current_title: title,
        suggested_title: suggestedTitle,
        title_change_needed:
          normalize(title) !== normalize(suggestedTitle),
        product_type: productType,
        color,
        views,
        favorites,
        seo_priority: seoPriority,
        ad_priority: adPriority,
        reason,
        suggested_keywords: keywords,
        historical_reference: isWhiteBlanket,
        approval_required: true,
        approval_status: "PENDING",
        url: item.url
      };
    });

    pendingChanges.sort((a, b) => {
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
      pending_count: pendingChanges.length,
      mode: "APPROVAL_REQUIRED",
      important_note:
        "No Etsy listing is changed by this endpoint. All recommendations require approval.",
      pending_changes: pendingChanges
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Pending changes generation failed.",
      details: error.message
    });
  }
}
