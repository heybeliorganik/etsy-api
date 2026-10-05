import { neon } from "@neondatabase/serverless";

const STRATEGY_VERSION = "HEYBELI_ETSY_V3";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim();
}

function getProductType(title) {
  const t = normalize(title);

  if (t.includes("crib bedding")) {
    return "CRIB_BEDDING";
  }

  if (
    t.includes("3-piece") ||
    t.includes("3 piece")
  ) {
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

function hasBreathable(title) {
  return normalize(title)
    .includes("breathable");
}

function hasKnit(title) {
  return normalize(title)
    .includes("knit");
}

function isWhiteBlanket(title) {
  const t = normalize(title);

  return (
    t.includes("white") &&
    t.includes("blanket")
  );
}

/*
  Trendyol / Turkey historical signal.
  This is NOT Etsy sales history.
*/
function getExternalMarketSignal(title) {
  if (isWhiteBlanket(title)) {
    return {
      source: "Trendyol Turkey",
      signal: "HIGH",
      bonus: 12,
      reason:
        "White blanket has strong prior sales history in the Turkey marketplace. This is an external-market signal, not Etsy sales history."
    };
  }

  return {
    source: "Trendyol Turkey",
    signal: "UNKNOWN",
    bonus: 0,
    reason:
      "No specific external-market product signal has been added for this listing yet."
  };
}

function buildSuggestedTitle(
  productType,
  color,
  currentTitle
) {
  const size = getSize(currentTitle);
  const parts = [];

  if (productType === "CRIB_BEDDING") {
    parts.push(
      `${color} Organic Cotton Crib Bedding Set`
    );
  } else if (productType === "SET") {
    parts.push(
      `${color} Organic Cotton Baby Blanket Set`
    );
  } else {
    parts.push(
      `${color} Organic Cotton Baby Blanket`
    );
  }

  if (
    hasBreathable(currentTitle) ||
    hasKnit(currentTitle)
  ) {
    parts.push("Breathable Knit");
  }

  if (hasOekoTex(currentTitle)) {
    parts.push("OEKO-TEX Certified");
  }

  if (size) {
    parts.push(size);
  }

  return parts.join(", ");
}

function buildTags(productType, color) {
  let tags = [];

  if (productType === "CRIB_BEDDING") {
    tags = [
      "organic crib bedding",
      "cotton crib bedding",
      "baby bedding set",
      "nursery bedding",
      "breathable bedding",
      "organic baby bedding",
      "cotton nursery set",
      "crib bedding set",
      "baby nursery decor",
      "natural baby bedding",
      "soft crib bedding",
      `${color.toLowerCase()} bedding`,
      "oeko tex bedding"
    ];
  } else if (productType === "SET") {
    tags = [
      "organic blanket set",
      "baby blanket set",
      "cotton baby set",
      "newborn blanket set",
      "breathable blanket",
      "organic baby gift",
      "nursery blanket set",
      "cotton blanket set",
      "baby nursery set",
      "soft baby blanket",
      "natural baby blanket",
      `${color.toLowerCase()} blanket`,
      "oeko tex blanket"
    ];
  } else {
    tags = [
      "organic baby blanket",
      "cotton baby blanket",
      "breathable blanket",
      "knit baby blanket",
      "newborn blanket",
      "nursery blanket",
      "soft baby blanket",
      "natural baby blanket",
      "cotton knit blanket",
      "baby stroller blanket",
      "lightweight blanket",
      `${color.toLowerCase()} blanket`,
      "oeko tex blanket"
    ];
  }

  return tags.slice(0, 13);
}

function buildDescriptionOpening(
  productType,
  color,
  currentTitle
) {
  const size = getSize(currentTitle);

  let productName =
    "organic cotton baby blanket";

  if (productType === "SET") {
    productName =
      "organic cotton baby blanket set";
  }

  if (productType === "CRIB_BEDDING") {
    productName =
      "organic cotton crib bedding set";
  }

  let text =
    `A ${color.toLowerCase()} ${productName} designed for soft, breathable everyday comfort.`;

  if (size) {
    text += ` Size: ${size}.`;
  }

  if (hasOekoTex(currentTitle)) {
    text +=
      " Made with OEKO-TEX certified fabric.";
  }

  return text;
}

function calculateEtsyPerformance(
  views,
  favorites
) {
  let score = 50;

  score += Math.min(views * 0.5, 25);
  score += Math.min(favorites * 5, 25);

  return Math.min(
    Math.round(score * 100) / 100,
    100
  );
}

function calculateOverallScore(item) {
  const views =
    Number(item.views || 0);

  const favorites =
    Number(item.num_favorers || 0);

  const etsyPerformance =
    calculateEtsyPerformance(
      views,
      favorites
    );

  const external =
    getExternalMarketSignal(
      item.title
    );

  /*
    Etsy remains the dominant signal.
    External-market knowledge is capped.
  */
  const score =
    Math.min(
      etsyPerformance +
      external.bonus,
      100
    );

  return {
    score:
      Math.round(score * 100) / 100,

    etsy_performance_score:
      etsyPerformance,

    external_market_bonus:
      external.bonus,

    external_market_source:
      external.source,

    external_market_signal:
      external.signal,

    external_market_reason:
      external.reason
  };
}

function getPriorities(item, scoreData) {
  const views =
    Number(item.views || 0);

  const favorites =
    Number(item.num_favorers || 0);

  let seoPriority = "MEDIUM";
  let adPriority = "LOW";
  let action = "MONITOR";

  let reason =
    "Continue collecting Etsy performance data before making aggressive changes.";

  if (
    favorites >= 1 &&
    views >= 5
  ) {
    seoPriority = "HIGH";
    adPriority = "HIGH";
    action = "TEST_AND_SCALE";

    reason =
      "This listing is receiving both views and favorites on Etsy, making it a strong candidate for controlled optimization and advertising.";
  } else if (views >= 5) {
    seoPriority = "HIGH";
    adPriority = "MEDIUM";
    action = "SEO_FIRST";

    reason =
      "The listing receives Etsy traffic but needs stronger conversion signals before heavier ad spend.";
  } else if (
    views <= 2 &&
    favorites === 0
  ) {
    seoPriority = "HIGH";
    adPriority = "LOW";
    action = "FIX_BEFORE_ADS";

    reason =
      "Low Etsy traffic and no favorites. Improve listing clarity, tags, attributes and imagery before increasing ad spend.";
  }

  if (
    scoreData.external_market_signal ===
      "HIGH" &&
    views < 5
  ) {
    reason +=
      " The product also has a strong external-market signal from Trendyol Turkey, so it is worth testing carefully on Etsy despite limited Etsy history.";
  }

  return {
    seoPriority,
    adPriority,
    action,
    reason
  };
}

function buildStrategy(item) {
  const title =
    String(item.title || "");

  const productType =
    getProductType(title);

  const color =
    getColor(title);

  const views =
    Number(item.views || 0);

  const favorites =
    Number(item.num_favorers || 0);

  const price =
    Number(
      item.price_divisor || 100
    ) > 0
      ? Number(
          item.price_amount || 0
        ) /
        Number(
          item.price_divisor || 100
        )
      : 0;

  const scoreData =
    calculateOverallScore(item);

  const priorities =
    getPriorities(
      item,
      scoreData
    );

  const suggestedTitle =
    buildSuggestedTitle(
      productType,
      color,
      title
    );

  const suggestedTags =
    buildTags(
      productType,
      color
    );

  const descriptionOpening =
    buildDescriptionOpening(
      productType,
      color,
      title
    );

  return {
    listing_id:
      item.listing_id,

    current_title:
      title,

    product_type:
      productType,

    color,

    views,
    favorites,

    price,
    currency:
      item.currency_code,

    etsy_sales_history:
      "NO_CONFIRMED_SALES_HISTORY",

    etsy_performance_score:
      scoreData.etsy_performance_score,

    external_market_source:
      scoreData.external_market_source,

    external_market_signal:
      scoreData.external_market_signal,

    external_market_bonus:
      scoreData.external_market_bonus,

    external_market_reason:
      scoreData.external_market_reason,

    overall_score:
      scoreData.score,

    seo_priority:
      priorities.seoPriority,

    ad_priority:
      priorities.adPriority,

    action:
      priorities.action,

    reason:
      priorities.reason,

    suggested_title:
      suggestedTitle,

    title_change_needed:
      normalize(title) !==
      normalize(suggestedTitle),

    suggested_tags:
      suggestedTags,

    suggested_description_opening:
      descriptionOpening,

    image_action:
      views <= 2
        ? "REVIEW_MAIN_IMAGE"
        : "MONITOR",

    attributes_action:
      "COMPLETE_ALL_RELEVANT_ETSY_ATTRIBUTES",

    approval_required:
      true,

    approval_status:
      "PENDING",

    strategy_version:
      STRATEGY_VERSION,

    url:
      item.url
  };
}

export default async function handler(
  req,
  res
) {
  try {
    const databaseUrl =
      process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        success: false,
        error:
          "DATABASE_URL eksik."
      });
    }

    const sql =
      neon(databaseUrl);

    const listings =
      await sql`
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

    const strategy =
      listings.map(buildStrategy);

    strategy.sort((a, b) => {
      if (
        b.etsy_performance_score !==
        a.etsy_performance_score
      ) {
        return (
          b.etsy_performance_score -
          a.etsy_performance_score
        );
      }

      return (
        b.overall_score -
        a.overall_score
      );
    });

    const pendingChanges =
      strategy.map((item) => ({
        listing_id:
          item.listing_id,

        current_title:
          item.current_title,

        suggested_title:
          item.suggested_title,

        suggested_tags:
          item.suggested_tags,

        suggested_description_opening:
          item.suggested_description_opening,

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

        etsy_performance_score:
          item.etsy_performance_score,

        external_market_source:
          item.external_market_source,

        external_market_signal:
          item.external_market_signal,

        overall_score:
          item.overall_score,

        seo_priority:
          item.seo_priority,

        ad_priority:
          item.ad_priority,

        action:
          item.action,

        reason:
          item.reason,

        image_action:
          item.image_action,

        attributes_action:
          item.attributes_action,

        approval_required:
          true,

        approval_status:
          "PENDING",

        strategy_version:
          STRATEGY_VERSION,

        url:
          item.url
      }));

    return res.status(200).json({
      success: true,

      system_mode:
        "ETSY_HYBRID_STRATEGY_APPROVAL",

      strategy_version:
        STRATEGY_VERSION,

      analyzed_count:
        strategy.length,

      pending_count:
        pendingChanges.length,

      etsy_history_note:
        "This shop currently has no confirmed Etsy sales history in the strategy model.",

      external_market_note:
        "Trendyol Turkey performance is treated only as an external-market signal and never as Etsy sales history.",

      ranking_priority:
        [
          "Etsy live performance",
          "Etsy listing clarity and relevance",
          "Testing results",
          "External marketplace experience"
        ],

      important_note:
        "No Etsy listing is changed automatically. All changes require manual approval.",

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
