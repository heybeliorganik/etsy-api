import { neon } from "@neondatabase/serverless";

const STRATEGY_VERSION = "HEYBELI_ETSY_V3_1";

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

function hasThreePiece(title) {
  const t = normalize(title);

  return (
    t.includes("3-piece") ||
    t.includes("3 piece")
  );
}

function getColors(title) {
  const t = normalize(title);

  const found = [];

  const addColor = (key, value) => {
    const index = t.indexOf(key);

    if (index >= 0) {
      found.push({
        index,
        value
      });
    }
  };

  addColor("sage green", "Sage Green");
  addColor("blush pink", "Blush Pink");
  addColor("light gray", "Light Gray");
  addColor("charcoal gray", "Charcoal Gray");
  addColor("terracotta", "Terracotta");
  addColor("beige", "Beige");
  addColor("white", "White");
  addColor("blue", "Blue");

  if (t.includes("mustard yellow")) {
    addColor(
      "mustard yellow",
      "Mustard Yellow"
    );
  } else if (t.includes("mustard")) {
    addColor(
      "mustard",
      "Mustard"
    );
  }

  found.sort(
    (a, b) => a.index - b.index
  );

  const unique = [];

  for (const item of found) {
    if (!unique.includes(item.value)) {
      unique.push(item.value);
    }
  }

  return unique;
}

function getPrimaryColor(title) {
  const colors = getColors(title);

  return colors[0] || "Unknown";
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

function formatColorList(colors) {
  if (!colors.length) {
    return "";
  }

  if (colors.length === 1) {
    return colors[0];
  }

  if (colors.length === 2) {
    return `${colors[0]} & ${colors[1]}`;
  }

  return (
    colors
      .slice(0, -1)
      .join(", ") +
    ` & ${colors[colors.length - 1]}`
  );
}

function getExternalMarketSignal(title) {
  if (isWhiteBlanket(title)) {
    return {
      source: "Trendyol Turkey",
      signal: "HIGH",
      bonus: 12,
      reason:
        "White blanket has a strong prior sales signal in the Turkey marketplace. This is an external-market signal and is not Etsy sales history."
    };
  }

  return {
    source: "Trendyol Turkey",
    signal: "UNKNOWN",
    bonus: 0,
    reason:
      "No specific Trendyol product-level signal has been added for this listing yet."
  };
}

function buildSuggestedTitle(
  productType,
  colors,
  currentTitle
) {
  const size =
    getSize(currentTitle);

  const primaryColor =
    colors[0] || "Unknown";

  const colorList =
    formatColorList(colors);

  const parts = [];

  if (productType === "CRIB_BEDDING") {
    if (hasThreePiece(currentTitle)) {
      parts.push(
        "3-Piece Organic Cotton Crib Bedding Set"
      );
    } else {
      parts.push(
        "Organic Cotton Crib Bedding Set"
      );
    }

    if (colorList) {
      parts.push(colorList);
    }
  } else if (productType === "SET") {
    if (hasThreePiece(currentTitle)) {
      parts.push(
        "3-Piece Organic Cotton Baby Blanket Set"
      );
    } else {
      parts.push(
        "Organic Cotton Baby Blanket Set"
      );
    }

    if (colorList) {
      parts.push(colorList);
    }
  } else {
    parts.push(
      `${primaryColor} Organic Cotton Baby Blanket`
    );

    if (
      hasBreathable(currentTitle) ||
      hasKnit(currentTitle)
    ) {
      parts.push(
        "Breathable Knit"
      );
    }
  }

  if (hasOekoTex(currentTitle)) {
    parts.push(
      "OEKO-TEX Certified"
    );
  }

  if (
    size &&
    productType !== "CRIB_BEDDING"
  ) {
    parts.push(size);
  }

  return parts.join(", ");
}

function shortColor(color) {
  const value =
    normalize(color);

  if (
    value === "mustard yellow"
  ) {
    return "mustard";
  }

  if (
    value === "charcoal gray"
  ) {
    return "charcoal";
  }

  if (
    value === "light gray"
  ) {
    return "light gray";
  }

  if (
    value === "sage green"
  ) {
    return "sage green";
  }

  if (
    value === "blush pink"
  ) {
    return "blush pink";
  }

  return value;
}

function sanitizeTag(tag) {
  let clean =
    String(tag || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  clean =
    clean.replace(
      "mustard yellow",
      "mustard"
    );

  clean =
    clean.replace(
      "charcoal gray",
      "charcoal"
    );

  if (clean.length > 20) {
    return null;
  }

  return clean;
}

function finalizeTags(
  candidates,
  fallbacks
) {
  const result = [];

  const allTags = [
    ...candidates,
    ...fallbacks
  ];

  for (const tag of allTags) {
    const clean =
      sanitizeTag(tag);

    if (!clean) {
      continue;
    }

    if (
      !result.includes(clean)
    ) {
      result.push(clean);
    }

    if (result.length === 13) {
      break;
    }
  }

  return result;
}

function buildTags(
  productType,
  colors
) {
  const primaryColor =
    shortColor(
      colors[0] || ""
    );

  if (
    productType ===
    "CRIB_BEDDING"
  ) {
    const candidates = [
      "organic crib bedding",
      "cotton crib bedding",
      "baby bedding set",
      "nursery bedding",
      "breathable bedding",
      "organic baby bedding",
      "cotton nursery set",
      "crib bedding set",
      "baby nursery decor",
      "natural crib bedding",
      "soft crib bedding",
      primaryColor
        ? `${primaryColor} bedding`
        : "",
      "oeko tex bedding"
    ];

    const fallbacks = [
      "baby crib set",
      "cotton baby bedding",
      "nursery crib set",
      "soft nursery bedding"
    ];

    return finalizeTags(
      candidates,
      fallbacks
    );
  }

  if (productType === "SET") {
    const candidates = [
      "organic blanket set",
      "baby blanket set",
      "cotton blanket set",
      "newborn blanket set",
      "breathable set",
      "nursery blanket set",
      "soft blanket set",
      "natural blanket set",
      "cotton baby set",
      "baby nursery set",
      primaryColor
        ? `${primaryColor} blanket`
        : "",
      "oeko tex blanket",
      "baby gift set"
    ];

    const fallbacks = [
      "baby bedding set",
      "cotton nursery set",
      "newborn gift set",
      "baby textile set"
    ];

    return finalizeTags(
      candidates,
      fallbacks
    );
  }

  const candidates = [
    "organic baby blanket",
    "cotton baby blanket",
    "breathable blanket",
    "knit baby blanket",
    "newborn blanket",
    "nursery blanket",
    "soft baby blanket",
    "natural baby blanket",
    "cotton knit blanket",
    "stroller blanket",
    "lightweight blanket",
    primaryColor
      ? `${primaryColor} blanket`
      : "",
    "oeko tex blanket"
  ];

  const fallbacks = [
    "baby cot blanket",
    "baby pram blanket",
    "soft cotton blanket",
    "baby nursery blanket"
  ];

  return finalizeTags(
    candidates,
    fallbacks
  );
}

function buildDescriptionOpening(
  productType,
  colors,
  currentTitle
) {
  const size =
    getSize(currentTitle);

  const colorText =
    formatColorList(colors)
      .toLowerCase();

  let productName =
    "organic cotton baby blanket";

  if (productType === "SET") {
    productName =
      "organic cotton baby blanket set";
  }

  if (
    productType ===
    "CRIB_BEDDING"
  ) {
    productName =
      "organic cotton crib bedding set";
  }

  let text =
    `A ${colorText} ${productName} designed for soft, breathable everyday comfort.`;

  if (
    size &&
    productType !==
      "CRIB_BEDDING"
  ) {
    text +=
      ` Size: ${size}.`;
  }

  if (
    hasOekoTex(currentTitle)
  ) {
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

  score +=
    Math.min(
      views * 0.5,
      25
    );

  score +=
    Math.min(
      favorites * 5,
      25
    );

  return Math.min(
    Math.round(
      score * 100
    ) / 100,
    100
  );
}

function calculateOverallScore(
  item
) {
  const views =
    Number(
      item.views || 0
    );

  const favorites =
    Number(
      item.num_favorers || 0
    );

  const etsyPerformance =
    calculateEtsyPerformance(
      views,
      favorites
    );

  const external =
    getExternalMarketSignal(
      item.title
    );

  const score =
    Math.min(
      etsyPerformance +
        external.bonus,
      100
    );

  return {
    score:
      Math.round(
        score * 100
      ) / 100,

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

function getPriorities(
  item,
  scoreData
) {
  const views =
    Number(
      item.views || 0
    );

  const favorites =
    Number(
      item.num_favorers || 0
    );

  let seoPriority =
    "MEDIUM";

  let adPriority =
    "LOW";

  let action =
    "MONITOR";

  let reason =
    "Continue collecting Etsy performance data before making aggressive changes.";

  if (
    favorites >= 1 &&
    views >= 5
  ) {
    seoPriority =
      "HIGH";

    adPriority =
      "HIGH";

    action =
      "TEST_AND_SCALE";

    reason =
      "This listing is receiving both views and favorites on Etsy, making it a strong candidate for controlled optimization and advertising.";
  } else if (
    views >= 5
  ) {
    seoPriority =
      "HIGH";

    adPriority =
      "MEDIUM";

    action =
      "SEO_FIRST";

    reason =
      "The listing receives Etsy traffic but needs stronger conversion signals before heavier ad spend.";
  } else if (
    views <= 2 &&
    favorites === 0
  ) {
    seoPriority =
      "HIGH";

    adPriority =
      "LOW";

    action =
      "FIX_BEFORE_ADS";

    reason =
      "Low Etsy traffic and no favorites. Improve listing clarity, tags, attributes and imagery before increasing ad spend.";
  }

  if (
    scoreData
      .external_market_signal ===
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
    String(
      item.title || ""
    );

  const productType =
    getProductType(title);

  const colors =
    getColors(title);

  const primaryColor =
    colors[0] ||
    "Unknown";

  const views =
    Number(
      item.views || 0
    );

  const favorites =
    Number(
      item.num_favorers || 0
    );

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
    calculateOverallScore(
      item
    );

  const priorities =
    getPriorities(
      item,
      scoreData
    );

  const suggestedTitle =
    buildSuggestedTitle(
      productType,
      colors,
      title
    );

  const suggestedTags =
    buildTags(
      productType,
      colors
    );

  const descriptionOpening =
    buildDescriptionOpening(
      productType,
      colors,
      title
    );

  return {
    listing_id:
      item.listing_id,

    current_title:
      title,

    product_type:
      productType,

    color:
      primaryColor,

    colors,

    views,
    favorites,

    price,

    currency:
      item.currency_code,

    etsy_sales_history:
      "NO_CONFIRMED_SALES_HISTORY",

    etsy_performance_score:
      scoreData
        .etsy_performance_score,

    external_market_source:
      scoreData
        .external_market_source,

    external_market_signal:
      scoreData
        .external_market_signal,

    external_market_bonus:
      scoreData
        .external_market_bonus,

    external_market_reason:
      scoreData
        .external_market_reason,

    overall_score:
      scoreData.score,

    seo_priority:
      priorities
        .seoPriority,

    ad_priority:
      priorities
        .adPriority,

    action:
      priorities.action,

    reason:
      priorities.reason,

    suggested_title:
      suggestedTitle,

    title_change_needed:
      normalize(title) !==
      normalize(
        suggestedTitle
      ),

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
      process.env
        .DATABASE_URL;

    if (!databaseUrl) {
      return res
        .status(500)
        .json({
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
      listings.map(
        buildStrategy
      );

    strategy.sort(
      (a, b) => {
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
      }
    );

    const pendingChanges =
      strategy.map(
        (item) => ({
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

          colors:
            item.colors,

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
        })
      );

    return res
      .status(200)
      .json({
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

        tag_rule:
          "All suggested Etsy tags are limited to 20 characters or fewer.",

        set_rule:
          "Multi-color sets preserve all detected product colors in the suggested title.",

        ranking_priority: [
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
    return res
      .status(500)
      .json({
        success: false,

        error:
          "SEO strategy system failed.",

        details:
          error.message
      });
  }
}
