import { etsyFetch } from "./etsyClient.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Sadece POST istegi kabul edilir."
      });
    }

    const {
      listing_id,
      property_id,
      value_id,
      scale_id,
      confirm
    } = req.body || {};

    if (confirm !== "YES") {
      return res.status(400).json({
        success: false,
        error: 'Guvenlik onayi gerekli. confirm degeri "YES" olmali.'
      });
    }

    const listingId = Number(listing_id);
    const propertyId = Number(property_id);
    const valueId = Number(value_id);

    if (!listingId) {
      return res.status(400).json({
        success: false,
        error: "Gecerli listing_id gerekli."
      });
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: "Gecerli property_id gerekli."
      });
    }

    if (!valueId) {
      return res.status(400).json({
        success: false,
        error: "Gecerli value_id gerekli."
      });
    }

    const shopId = 67653092;

    const body = new URLSearchParams();

    body.append(
      "value_ids[]",
      String(valueId)
    );

    if (
      scale_id !== undefined &&
      scale_id !== null &&
      String(scale_id).trim() !== ""
    ) {
      body.set(
        "scale_id",
        String(scale_id)
      );
    }

    const response = await etsyFetch(
      `/application/shops/${shopId}/listings/${listingId}/properties/${propertyId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: body.toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error:
          "Etsy attribute guncellemesi basarisiz.",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Etsy attribute basariyla guncellendi.",
      listing_id: listingId,
      property_id: propertyId,
      value_id: valueId,
      listing_property: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        "Attribute guncelleme islemi basarisiz.",
      details:
        error.message
    });
  }
}
