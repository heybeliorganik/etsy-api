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

function getSize(title) {
  const text = String(title || "");

  const match = text.match(
    /(\d{2,3})\s*[x×]\s*(\d{2,3})\s*cm/i
  );

  if (!match) {
    return null;
  }

  return `${match[1]} x ${match[2]} cm`;
}

function hasOekoTex(title) {
  const t = normalize(title);

  return (
    t.includes("oeko-tex") ||
    t.includes("oeko tex")
  );
}

function hasBreathableKnit(title) {
  const t = normalize(title);

  return (
    t.includes("breathable") ||
    t.includes("knit")
  );
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
      "cotton blanket set",
      "baby blanket set",
      "breathable cotton set",
      "nursery blanket set"
    ];
  }

  return [
    "organic cotton baby blanket",
    "cotton baby blanket",
    "breathable knit blanket",
    "newborn cotton blanket",
    `${color.toLowerCase()} baby blanket`
  ];
}

function buildSuggestedTitle(
  productType,
  color,
  currentTitle
) {
  const size = getSize(currentTitle);

  const oekoText =
    hasOekoTex(currentTitle)
      ? "OEKO-TEX Certified"
      : null;

  const knitText =
    hasBreathableKnit(currentTitle)
      ? "Breathable Knit"
      : null;

  const parts = [];

  if (productType === "CRIB_BEDDING") {
    parts.push(
      `${color} Organic Cotton Crib Bedding Set`
    );

    if (knitText) {
      parts.push(knitText);
    }

    if (oekoText) {
      parts.push(oekoText);
    }

    if (size) {
      parts.push(size);
    }

    return parts.join(", ");
  }

  if (productType === "SET") {
    parts.push(
      `${color} Organic Cotton Baby Blanket Set`
    );

    if (knitText) {
      parts.push(knitText);
    }

    if (oekoText) {
      parts.push(oekoText);
    }

    if (size) {
      parts.push(size);
    }

    return parts.join(", ");
  }

  parts.push(
    `${color} Organic Cotton Baby Blanket`
  );

  if (knitText) {
    parts.push(knitText);
  }

  if (oekoText) {
    parts.push(oekoText);
  }

  if (size) {
    parts.push(size);
  }

  return parts.join(", ");
}

function calculateScore(title, views, favorites) {
  const titleLower = normalize(title);

  let score = 50;
  let historicalBonus = 0;

  const isWhiteBlanket =
    titleLower.includes("white") &&
    titleLower.includes("blanket");

  if (isWhiteBlanket) {
    historicalBonus = 30;
    score += historicalBonus;
  }

  score += Math.min(views * 0.25, 20);
  score += Math.min(favorites * 4, 20);

  let priority = "NORMAL";

  if (score >= 80) {
    priority = "HIGH";
  } else if (score < 55) {
    priority = "LOW";
  }

  return {
    score: Math.round(score * 100) / 100,
    historicalBonus,
    priority,
    isWhiteBlanket
  };
}

function buildStrategy(item) {
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
  let reason =
    "Continue monitoring performance.";

  if (isWhiteBlanket) {
    seoPriority = "HIGH";
    adPriority = "HIGH";
    action = "PROTECT_AND_SCALE";

    reason =
      "Historical best seller based on 5 years of sales experience. Protect the product while testing carefully.";
  } else if (favorites >= 1 && views >= 5) {
    seoPriority = "HIGH";
    adPriority = "HIGH";
    action = "TEST_AND_SCALE";

    reason =
      "The product receives both views and favorites. Strong candidate for controlled optimization and advertising.";
  } else if (views >= 5) {
    seoPriority = "HIGH";
    adPriority = "MEDIUM";
    action = "SEO_FIRST";

    reason =
      "The product receives traffic but needs stronger conversion signals.";
  } else if (views <= 2 && favorites === 0) {
    seoPriority = "HIGH";
    adPriority = "LOW";
    action = "FIX_BEFORE_ADS";

    reason =
      "Low traffic and no favorites. Improve product clarity and SEO before advertising.";
  }

  const suggestedTitle =
    buildSuggestedTitle(
      productType,
      color,
      title
    );

  const keywords =
    buildKeywords(productType, color);

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

    suggested_title: suggestedTitle,

    title_change_needed:
      normalize(title) !==
      normalize(suggestedTitle),

    suggested_keywords: keywords,

    approval_required: true,
    approval_status: "PENDING",

    title_strategy_version:
      "ETSY_CLARITY_V2",

    url: item.url
  };
}

export default async function handler(req, res) {
  try {
    const databaseUrl =
      process.env.DATABASE_URL;

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

    const analysis = listings.map((item) => {
      const views =
        Number(item.views || 0);

      const favorites =
        Number(item.num_favorers || 0);

      const scoreData =
        calculateScore(
          item.title,
          views,
          favorites
        );

      let recommendation =
        "Takip etmeye devam et.";

      if (
        scoreData.priority === "HIGH"
      ) {
        recommendation =
          "SEO ve reklam icin oncelikli urun.";
      }

      if (
        scoreData.priority === "LOW"
      ) {
        recommendation =
          "Baslik, anahtar kelime ve ana gorsel optimize edilmeli.";
      }

      return {
        listing_id:
          item.listing_id,

        title:
          item.title,

        views,
        favorites,

        historical_bonus:
          scoreData.historicalBonus,

        score:
          scoreData.score,

        priority:
          scoreData.priority,

        recommendation,

        url:
          item.url
      };
    });

    analysis.sort(
      (a, b) => b.score - a.score
    );

    const strategy =
      listings.map(buildStrategy);

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

    const pendingChanges =
      strategy.map((item) => ({
        listing_id:
          item.listing_id,

        current_title:
          item.current_title,

        suggested_title:
          item.suggested_title,

        title_change_needed:
          item.title_change_needed,

        product_type:
          item.product_type,

        color:
          item.color,

        views:
          item.views,

        favorites:
          item.favorites,

        seo_priority:
          item.seo_priority,

        ad_priority:
          item.ad_priority,

        action:
          item.action,

        reason:
          item.reason,

        suggested_keywords:
          item.suggested_keywords,

        historical_reference:
          item.historical_reference,

        title_strategy_version:
          item.title_strategy_version,

        approval_required: true,
        approval_status: "PENDING",

        url:
          item.url
      }));

    return res.status(200).json({
      success: true,

      system_mode:
        "ANALYSIS_STRATEGY_APPROVAL",

      title_strategy_version:
        "ETSY_CLARITY_V2",

      analyzed_count:
        analysis.length,

      pending_count:
        pendingChanges.length,

      reference_product:
        "White cotton baby blanket",

      historical_reference_note:
        "White blanket is treated as the historical best seller based on 5 years of sales experience.",

      important_note:
        "Titles now prioritize product clarity, material, construction, certification and size. Changes still require manual approval.",

      analysis,
      strategy,

      pending_changes:
        pendingChanges
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        "SEO strategy system failed.",
      details:
        error.message
    });
  }
}
