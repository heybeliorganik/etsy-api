import { etsyFetch } from "./etsyClient.js";

export default async function handler(req, res) {
  try {
    const listingId = Number(req.query?.listing_id);

    if (!listingId) {
      return res.status(400).json({
        success: false,
        error: "Gecerli listing_id gerekli."
      });
    }

    const shopId = 67653092;

    // 1. Get listing to learn taxonomy/category
    const listingResponse = await etsyFetch(
      `/application/listings/${listingId}`
    );

    const listing = await listingResponse.json();

    if (!listingResponse.ok) {
      return res.status(listingResponse.status).json({
        success: false,
        error: "Listing bilgisi alinamadi.",
        details: listing
      });
    }

    const taxonomyId = Number(listing.taxonomy_id);

    if (!taxonomyId) {
      return res.status(400).json({
        success: false,
        error: "Listing taxonomy_id bulunamadi."
      });
    }

    // 2. Current attributes already selected on Etsy
    const currentResponse = await etsyFetch(
      `/application/shops/${shopId}/listings/${listingId}/properties`
    );

    const currentData = await currentResponse.json();

    if (!currentResponse.ok) {
      return res.status(currentResponse.status).json({
        success: false,
        error: "Mevcut Etsy attributes alinamadi.",
        details: currentData
      });
    }

    // 3. All attributes supported by this Etsy category
    const availableResponse = await etsyFetch(
      `/application/seller-taxonomy/nodes/${taxonomyId}/properties`
    );

    const availableData = await availableResponse.json();

    if (!availableResponse.ok) {
      return res.status(availableResponse.status).json({
        success: false,
        error: "Kategori attributes alinamadi.",
        details: availableData
      });
    }

    const currentProperties =
      Array.isArray(currentData.results)
        ? currentData.results
        : [];

    const availableProperties =
      Array.isArray(availableData.results)
        ? availableData.results
        : [];

    const currentIds = new Set(
      currentProperties.map(
        item => Number(item.property_id)
      )
    );

    const missingProperties =
      availableProperties
        .filter(item => item.supports_attributes !== false)
        .filter(
          item =>
            !currentIds.has(
              Number(item.property_id)
            )
        )
        .map(item => ({
          property_id: item.property_id,
          name: item.name,
          display_name: item.display_name,
          is_required: Boolean(item.is_required),
          is_multivalued: Boolean(item.is_multivalued),
          max_values_allowed:
            item.max_values_allowed ?? null,
          possible_values:
            Array.isArray(item.possible_values)
              ? item.possible_values
                  .slice(0, 30)
                  .map(value => ({
                    value_id: value.value_id,
                    name: value.name,
                    scale_id: value.scale_id ?? null
                  }))
              : []
        }));

    return res.status(200).json({
      success: true,
      listing_id: listingId,
      title: listing.title,
      taxonomy_id: taxonomyId,

      current_count:
        currentProperties.length,

      available_count:
        availableProperties.length,

      missing_count:
        missingProperties.length,

      current_properties:
        currentProperties,

      missing_properties:
        missingProperties
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Attribute analiz islemi basarisiz.",
      details: error.message
    });
  }
}
