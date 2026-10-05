import { etsyFetch } from "./etsyClient.js";

const SHOP_ID = 67653092;
const STRATEGY_VERSION = "HEYBELI_ETSY_V4";
const SYSTEM_MODE = "ETSY_DECISION_ENGINE_APPROVAL";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [
    ...new Set(
      items
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  ];
}

function limitTag(tag) {
  return String(tag || "")
    .trim()
    .slice(0, 20)
    .trim();
}

function uniqueTags(items) {
  const output = [];

  for (const raw of items) {
    const tag = limitTag(raw);

    if (!tag) {
      continue;
    }

    const key = tag.toLowerCase();

    if (
      !output.some(
        (existing) =>
          existing.toLowerCase() === key
      )
    ) {
      output.push(tag);
    }

    if (output.length >= 13) {
      break;
    }
  }

  return output;
}

function getProductType(title) {
  const t = normalize(title);

  if (
    t.includes("crib bedding") ||
    t.includes("bedding set")
  ) {
    return "CRIB_BEDDING";
  }

  if (
    t.includes("3 piece") ||
    t.includes("3-piece") ||
    t.includes("blanket set")
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
    ["light grey", "Light Gray"],
    ["charcoal gray", "Charcoal Gray"],
    ["charcoal grey", "Charcoal Gray"],
    ["terracotta", "Terracotta"],
    ["beige", "Beige"],
    ["white", "White"],
    ["blue", "Blue"],
    ["gray", "Gray"],
    ["grey", "Gray"],
    ["pink", "Pink"],
    ["green", "Green"],
    ["yellow", "Yellow"]
  ];

  for (const [needle, label] of colors) {
    if (t.includes(needle)) {
      return label;
    }
  }

  return "Unknown";
}

function getDaysLive(listing) {
  const timestamp =
    Number(
      listing.original_creation_timestamp ||
      listing.creation_timestamp ||
      listing.created_timestamp ||
      0
    );

  if (!timestamp) {
    return null;
  }

  const ageMs =
    Date.now() -
    timestamp * 1000;

  return Math.max(
    0,
    Math.floor(
      ageMs /
        (1000 * 60 * 60 * 24)
    )
  );
}

function getViews(listing) {
  return Number(
    listing.views || 0
  );
}

function getFavorites(listing) {
  return Number(
    listing.num_favorers || 0
  );
}

function getPrice(listing) {
  const amount =
    Number(
      listing.price?.amount || 0
    );

  const divisor =
    Number(
      listing.price?.divisor || 100
    );

  if (!divisor) {
    return 0;
  }

  return amount / divisor;
}

function calculatePerformanceScore(
  views,
  favorites,
  daysLive
) {
  let score = 50;

  score += Math.min(
    25,
    views * 1.5
  );

  score += Math.min(
    20,
    favorites * 8
  );

  if (
    daysLive !== null &&
    daysLive <= 7 &&
    views >= 3
  ) {
    score += 5;
  }

  if (
    daysLive !== null &&
    daysLive >= 14 &&
    views <= 2 &&
    favorites === 0
  ) {
    score -= 15;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Number(score.toFixed(1))
    )
  );
}

function getExternalMarketSignal(
  productType,
  color
) {
  if (
    productType === "BLANKET" &&
    color === "White"
  ) {
    return {
      source: "Trendyol Turkey",
      signal: "HIGH",
      bonus: 10,
      reason:
        "White blanket has prior sales experience in the Turkey marketplace. This is treated only as an external-market signal, not Etsy sales history."
    };
  }

  return {
    source: "Trendyol Turkey",
    signal: "UNKNOWN",
    bonus: 0,
    reason:
      "No specific external-market product signal has been added for this listing."
  };
}

function getSuggestedTitle(
  productType,
  color,
  listing
) {
  const safeColor =
    color !== "Unknown"
      ? color
      : "";

  if (productType === "BLANKET") {
    return [
      safeColor,
      "Organic Cotton Baby Blanket, Breathable Knit, OEKO-TEX Certified"
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (productType === "SET") {
    const current =
      normalize(
        listing.title
      );

    if (
      current.includes("3 piece") ||
      current.includes("3-piece")
    ) {
      return [
        "3-Piece",
        safeColor,
        "Organic Cotton Baby Blanket Set, OEKO-TEX Certified"
      ]
        .filter(Boolean)
        .join(" ");
    }

    return [
      safeColor,
      "Organic Cotton Baby Blanket Set, OEKO-TEX Certified"
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (
    productType ===
    "CRIB_BEDDING"
  ) {
    return [
      safeColor,
      "Organic Cotton Crib Bedding Set, OEKO-TEX Certified"
    ]
      .filter(Boolean)
      .join(" ");
  }

  return String(
    listing.title || ""
  ).trim();
}

function getSuggestedTags(
  productType,
  color
) {
  const colorTag =
    color !== "Unknown"
      ? `${color.toLowerCase()} blanket`
      : "";

  if (productType === "BLANKET") {
    return uniqueTags([
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
      colorTag,
      "oeko tex blanket"
    ]);
  }

  if (productType === "SET") {
    return uniqueTags([
      "organic blanket set",
      "baby blanket set",
      "cotton baby set",
      "newborn blanket set",
      "breathable blanket",
      "nursery blanket set",
      "cotton blanket set",
      "baby nursery set",
      "soft baby blanket",
      "natural baby blanket",
      colorTag,
      "oeko tex blanket",
      "baby gift set"
    ]);
  }

  if (
    productType ===
    "CRIB_BEDDING"
  ) {
    const beddingColorTag =
      color !== "Unknown"
        ? `${color.toLowerCase()} bedding`
        : "";

    return uniqueTags([
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
      beddingColorTag,
      "oeko tex bedding"
    ]);
  }

  return [];
}

function getDescriptionOpening(
  productType,
  color
) {
  const c =
    color !== "Unknown"
      ? color.toLowerCase()
      : "";

  if (productType === "BLANKET") {
    return [
      `A ${c}`.trim(),
      "organic cotton baby blanket designed for soft, breathable everyday comfort.",
      "Made with OEKO-TEX certified fabric."
    ].join(" ");
  }

  if (productType === "SET") {
    return [
      `A ${c}`.trim(),
      "organic cotton baby blanket set designed for soft, breathable everyday comfort.",
      "Made with OEKO-TEX certified fabric."
    ].join(" ");
  }

  if (
    productType ===
    "CRIB_BEDDING"
  ) {
    return [
      `A ${c}`.trim(),
      "organic cotton crib bedding set designed for soft, breathable everyday comfort.",
      "Made with OEKO-TEX certified fabric."
    ].join(" ");
  }

  return "";
}

function compareTags(
  currentTags,
  suggestedTags
) {
  const current =
    unique(
      currentTags || []
    )
      .map(normalize)
      .filter(Boolean);

  const suggested =
    unique(
      suggestedTags || []
    )
      .map(normalize)
      .filter(Boolean);

  if (
    current.length !==
    suggested.length
  ) {
    return true;
  }

  const currentSet =
    new Set(current);

  return suggested.some(
    (tag) =>
      !currentSet.has(tag)
  );
}

function titleNeedsChange(
  currentTitle,
  suggestedTitle
) {
  const current =
    normalize(currentTitle);

  const suggested =
    normalize(suggestedTitle);

  if (
    !current ||
    !suggested
  ) {
    return false;
  }

  return current !== suggested;
}

function descriptionNeedsChange(
  description,
  suggestedOpening
) {
  if (!suggestedOpening) {
    return false;
  }

  const current =
    normalize(description);

  const opening =
    normalize(
      suggestedOpening
    );

  if (!current) {
    return true;
  }

  return !current.startsWith(
    opening
  );
}

function getDecision({
  views,
  favorites,
  daysLive,
  titleChangeNeeded,
  tagsChangeNeeded,
  descriptionChangeNeeded
}) {
  const seoChangesNeeded =
    titleChangeNeeded ||
    tagsChangeNeeded ||
    descriptionChangeNeeded;

  if (
    views >= 20 &&
    favorites >= 1
  ) {
    return {
      action:
        "PROTECT",
      action_label:
        "İyi çalışan ürünü koru",
      ad_decision:
        "CONTROLLED_AD_TEST",
      seo_decision:
        seoChangesNeeded
          ? "ONLY_MINOR_CHANGES"
          : "KEEP",
      wait_days:
        7,
      reason:
        "Ürün Etsy'de anlamlı görüntülenme ve favori sinyali alıyor. Büyük SEO değişiklikleri yerine mevcut performansı koruyup kontrollü reklam testi yapmak daha güvenli."
    };
  }

  if (
    views >= 5 &&
    favorites >= 1
  ) {
    return {
      action:
        "TEST_ADS",
      action_label:
        "Kontrollü reklam testi",
      ad_decision:
        "TEST_SMALL_BUDGET",
      seo_decision:
        seoChangesNeeded
          ? "IMPROVE_LIGHTLY"
          : "KEEP",
      wait_days:
        7,
      reason:
        "Ürün hem görüntülenme hem favori alıyor. Bu, küçük bütçeli reklam testi için diğer düşük sinyalli ürünlere göre daha güçlü aday olduğunu gösteriyor."
    };
  }

  if (
    views >= 3 &&
    favorites === 0
  ) {
    return {
      action:
        "REVIEW_IMAGE",
      action_label:
        "Ana görseli ve tıklama kalitesini incele",
      ad_decision:
        "WAIT",
      seo_decision:
        seoChangesNeeded
          ? "IMPROVE"
          : "KEEP",
      wait_days:
        5,
      reason:
        "Ürün görüntüleniyor ancak henüz favori sinyali yok. Reklam bütçesini artırmadan önce ana görsel, başlık netliği ve listing sunumu kontrol edilmeli."
    };
  }

  if (
    daysLive !== null &&
    daysLive <= 7 &&
    views <= 2
  ) {
    return {
      action:
        "WAIT_FOR_DATA",
      action_label:
        "Veri topla",
      ad_decision:
        "WAIT",
      seo_decision:
        seoChangesNeeded
          ? "PREPARE_CHANGES"
          : "KEEP",
      wait_days:
        7,
      reason:
        "Listing henüz çok yeni ve veri az. Erken dönemde sürekli değişiklik yapmak yerine yeterli Etsy performans verisi toplanmalı."
    };
  }

  if (
    views <= 2 &&
    favorites === 0
  ) {
    return {
      action:
        "FIX_BEFORE_ADS",
      action_label:
        "Reklamdan önce listing'i düzelt",
      ad_decision:
        "DO_NOT_ADVERTISE_YET",
      seo_decision:
        "IMPROVE",
      wait_days:
        5,
      reason:
        "Etsy trafiği ve favori sinyali çok düşük. Reklam bütçesi harcamadan önce başlık, etiket, açıklama girişi ve ana görsel güçlendirilmeli."
    };
  }

  return {
    action:
      "IMPROVE_SEO",
    action_label:
      "SEO'yu kontrollü geliştir",
    ad_decision:
      "WAIT",
    seo_decision:
      seoChangesNeeded
        ? "IMPROVE"
        : "KEEP",
    wait_days:
      7,
    reason:
      "Listing için performans sinyali henüz güçlü değil. Önce kontrollü SEO iyileştirmesi yapıp ardından yeni Etsy verisi toplanmalı."
  };
}

function getSeoPriority(
  decision,
  titleChangeNeeded,
  tagsChangeNeeded,
  descriptionChangeNeeded
) {
  if (
    decision.action ===
      "FIX_BEFORE_ADS" ||
    (
      titleChangeNeeded &&
      tagsChangeNeeded
    )
  ) {
    return "HIGH";
  }

  if (
    titleChangeNeeded ||
    tagsChangeNeeded ||
    descriptionChangeNeeded
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function getAdPriority(
  decision
) {
  if (
    decision.action ===
      "PROTECT" ||
    decision.action ===
      "TEST_ADS"
  ) {
    return "HIGH";
  }

  if (
    decision.action ===
    "IMPROVE_SEO"
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function getImageAction(
  decision
) {
  if (
    decision.action ===
      "REVIEW_IMAGE" ||
    decision.action ===
      "FIX_BEFORE_ADS"
  ) {
    return "REVIEW_MAIN_IMAGE";
  }

  return "MONITOR";
}

function getAttributesAction() {
  return "MANUAL_WHEN_UPLOADING";
}

export default async function handler(
  req,
  res
) {
  try {
    const response =
      await etsyFetch(
        `/application/shops/${SHOP_ID}/listings?state=active&limit=100`
      );

    const data =
      await response.json();

    if (!response.ok) {
      return res
        .status(
          response.status
        )
        .json({
          success: false,
          error:
            "Etsy listing verileri alinamadi.",
          details:
            data
        });
    }

    const listings =
      Array.isArray(
        data.results
      )
        ? data.results
        : [];

    const analysis = [];

    for (
      const listing
      of listings
    ) {
      const title =
        String(
          listing.title || ""
        ).trim();

      const productType =
        getProductType(
          title
        );

      const color =
        getColor(
          title
        );

      const views =
        getViews(
          listing
        );

      const favorites =
        getFavorites(
          listing
        );

      const daysLive =
        getDaysLive(
          listing
        );

      const external =
        getExternalMarketSignal(
          productType,
          color
        );

      const suggestedTitle =
        getSuggestedTitle(
          productType,
          color,
          listing
        );

      const suggestedTags =
        getSuggestedTags(
          productType,
          color
        );

      const suggestedDescriptionOpening =
        getDescriptionOpening(
          productType,
          color
        );

      const titleChangeNeeded =
        titleNeedsChange(
          title,
          suggestedTitle
        );

      const tagsChangeNeeded =
        compareTags(
          listing.tags || [],
          suggestedTags
        );

      const descriptionChangeNeeded =
        descriptionNeedsChange(
          listing.description || "",
          suggestedDescriptionOpening
        );

      const decision =
        getDecision({
          views,
          favorites,
          daysLive,
          titleChangeNeeded,
          tagsChangeNeeded,
          descriptionChangeNeeded
        });

      const etsyPerformanceScore =
        calculatePerformanceScore(
          views,
          favorites,
          daysLive
        );

      const overallScore =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              (
                etsyPerformanceScore +
                external.bonus
              ).toFixed(1)
            )
          )
        );

      const seoPriority =
        getSeoPriority(
          decision,
          titleChangeNeeded,
          tagsChangeNeeded,
          descriptionChangeNeeded
        );

      const adPriority =
        getAdPriority(
          decision
        );

      analysis.push({
        listing_id:
          listing.listing_id,

        current_title:
          title,

        product_type:
          productType,

        color,

        views,

        favorites,

        price:
          getPrice(
            listing
          ),

        currency:
          listing.price
            ?.currency_code ||
          "TRY",

        days_live:
          daysLive,

        etsy_sales_history:
          "NO_CONFIRMED_SALES_HISTORY",

        etsy_performance_score:
          etsyPerformanceScore,

        external_market_source:
          external.source,

        external_market_signal:
          external.signal,

        external_market_bonus:
          external.bonus,

        external_market_reason:
          external.reason,

        overall_score:
          overallScore,

        seo_priority:
          seoPriority,

        ad_priority:
          adPriority,

        action:
          decision.action,

        today_action:
          decision.action,

        today_action_label:
          decision.action_label,

        ad_decision:
          decision.ad_decision,

        seo_decision:
          decision.seo_decision,

        reason:
          decision.reason,

        wait_days:
          decision.wait_days,

        suggested_title:
          suggestedTitle,

        title_change_needed:
          titleChangeNeeded,

        title_decision:
          titleChangeNeeded
            ? "REVIEW_AND_UPDATE"
            : "KEEP",

        suggested_tags:
          suggestedTags,

        tags_change_needed:
          tagsChangeNeeded,

        tags_decision:
          tagsChangeNeeded
            ? "REVIEW_AND_UPDATE"
            : "KEEP",

        suggested_description_opening:
          suggestedDescriptionOpening,

        description_change_needed:
          descriptionChangeNeeded,

        description_decision:
          descriptionChangeNeeded
            ? "REVIEW_AND_UPDATE"
            : "KEEP",

        image_action:
          getImageAction(
            decision
          ),

        attributes_action:
          getAttributesAction(),

        approval_required:
          true,

        approval_status:
          "PENDING",

        strategy_version:
          STRATEGY_VERSION,

        url:
          listing.url ||
          `https://www.etsy.com/listing/${listing.listing_id}`
      });
    }

    analysis.sort(
      (a, b) =>
        b.overall_score -
        a.overall_score
    );

    return res
      .status(200)
      .json({
        success:
          true,

        system_mode:
          SYSTEM_MODE,

        strategy_version:
          STRATEGY_VERSION,

        analyzed_count:
          analysis.length,

        pending_count:
          analysis.length,

        etsy_history_note:
          "This shop currently has no confirmed Etsy sales history in the strategy model.",

        external_market_note:
          "Trendyol Turkey experience is treated only as an external-market signal and never as Etsy sales history.",

        important_note:
          "No Etsy listing is changed automatically. All listing changes require manual approval.",

        decision_engine_note:
          "Scores and thresholds are internal decision-support heuristics, not Etsy's ranking formula.",

        ranking_priority: [
          "Etsy live performance",
          "Listing clarity and relevance",
          "Buyer engagement signals",
          "Controlled testing",
          "External marketplace experience"
        ],

        strategy:
          analysis,

        pending_changes:
          analysis
      });

  } catch (error) {
    return res
      .status(500)
      .json({
        success:
          false,

        error:
          "V4 SEO karar motoru calismadi.",

        details:
          error.message
      });
  }
}
