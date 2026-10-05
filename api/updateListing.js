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
      description_prefix,
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
    const updatedFields = [];

    if (
      typeof title === "string" &&
      title.trim()
    ) {
      body.set(
        "title",
        title.trim()
      );

      updatedFields.push("title");
    }

    /*
      Direct full-description update.
      Keep for compatibility, but the panel
      should normally use description_prefix.
    */
    if (
      typeof description === "string" &&
      description.trim()
    ) {
      body.set(
        "description",
        description.trim()
      );

      updatedFields.push(
        "description"
      );
    }

    /*
      SAFE DESCRIPTION MODE

      Fetch the current Etsy description,
      add the new SEO introduction on top,
      and preserve the existing description.
    */
    if (
      typeof description_prefix === "string" &&
      description_prefix.trim()
    ) {
      const prefix =
        description_prefix.trim();

      const currentResponse =
        await etsyFetch(
          `/application/listings/${listingId}`
        );

      const currentListing =
        await currentResponse.json();

      if (!currentResponse.ok) {
        return res
          .status(currentResponse.status)
          .json({
            success: false,
            error:
              "Mevcut Etsy aciklamasi alinamadi.",
            details:
              currentListing
          });
      }

      const currentDescription =
        String(
          currentListing.description || ""
        ).trim();

      let newDescription;

      const normalizedCurrent =
        currentDescription
          .toLowerCase()
          .replace(/\s+/g, " ");

      const normalizedPrefix =
        prefix
          .toLowerCase()
          .replace(/\s+/g, " ");

      if (
        normalizedCurrent.includes(
          normalizedPrefix
        )
      ) {
        newDescription =
          currentDescription;
      } else if (
        currentDescription
      ) {
        newDescription =
          `${prefix}\n\n${currentDescription}`;
      } else {
        newDescription =
          prefix;
      }

      body.set(
        "description",
        newDescription
      );

      updatedFields.push(
        "description_prefix"
      );
    }

    if (Array.isArray(tags)) {
      const cleanTags = [];

      for (const tag of tags) {
        const cleanTag =
          String(tag || "")
            .trim()
            .toLowerCase();

        if (!cleanTag) {
          continue;
        }

        if (cleanTag.length > 20) {
          return res.status(400).json({
            success: false,
            error:
              `Etiket 20 karakterden uzun: ${cleanTag}`
          });
        }

        if (
          !cleanTags.includes(
            cleanTag
          )
        ) {
          cleanTags.push(
            cleanTag
          );
        }
      }

      if (
        cleanTags.length > 13
      ) {
        return res.status(400).json({
          success: false,
          error:
            "En fazla 13 Etsy etiketi gonderilebilir."
        });
      }

      for (
        const cleanTag
        of cleanTags
      ) {
        body.append(
          "tags[]",
          cleanTag
        );
      }

      if (cleanTags.length) {
        updatedFields.push(
          "tags"
        );
      }
    }

    if (
      [...body.keys()].length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Guncellenecek title, description, description_prefix veya tags gerekli."
      });
    }

    const response =
      await etsyFetch(
        `/application/shops/${shopId}/listings/${listingId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },
          body:
            body.toString()
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          success: false,
          error:
            "Etsy listing guncellemesi basarisiz.",
          details:
            data
        });
    }

    return res.status(200).json({
      success: true,
      message:
        "Etsy listing basariyla guncellendi.",
      listing_id:
        listingId,
      updated_fields:
        updatedFields,
      updated_title:
        data.title || null,
      listing:
        data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        "Listing guncelleme islemi basarisiz.",
      details:
        error.message
    });
  }
}
