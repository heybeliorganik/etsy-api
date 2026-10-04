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
      title,
      description,
      tags,
      confirm
    } = req.body || {};

    if (confirm !== "YES") {
      return res.status(400).json({
        success: false,
        error: 'Guvenlik onayi gerekli. confirm degeri "YES" olmali.'
      });
    }

    const listingId = Number(listing_id);

    if (!listingId) {
      return res.status(400).json({
        success: false,
        error: "Gecerli listing_id gerekli."
      });
    }

    const shopId = 67653092;

    const body = new URLSearchParams();

    if (typeof title === "string" && title.trim()) {
      body.set("title", title.trim());
    }

    if (typeof description === "string" && description.trim()) {
      body.set("description", description.trim());
    }

    if (Array.isArray(tags)) {
      for (const tag of tags) {
        const cleanTag = String(tag || "").trim();

        if (cleanTag) {
          body.append("tags[]", cleanTag);
        }
      }
    }

    if ([...body.keys()].length === 0) {
      return res.status(400).json({
        success: false,
        error: "Guncellenecek title, description veya tags gerekli."
      });
    }

    const response = await etsyFetch(
      `/application/shops/${shopId}/listings/${listingId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Etsy listing guncellemesi basarisiz.",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      message: "Etsy listing basariyla guncellendi.",
      listing_id: listingId,
      updated_title: data.title || null,
      listing: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Listing guncelleme islemi basarisiz.",
      details: error.message
    });
  }
}
