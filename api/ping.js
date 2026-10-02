function cleanSecret(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D\u200B-\u200D\uFEFF]/g, "");
}

export default async function handler(req, res) {
  try {
    const keystring = cleanSecret(process.env.ETSY_API_KEY);
    const sharedSecret = cleanSecret(process.env.ETSY_SHARED_SECRET);

    const diagnostics = {
      key_length: keystring.length,
      secret_length: sharedSecret.length,
      key_has_colon: keystring.includes(":"),
      secret_has_colon: sharedSecret.includes(":"),
      key_ascii_only: /^[\x20-\x7E]+$/.test(keystring),
      secret_ascii_only: /^[\x20-\x7E]+$/.test(sharedSecret)
    };

    if (!keystring || !sharedSecret) {
      return res.status(500).json({
        success: false,
        diagnostics,
        error: "Etsy API bilgileri eksik."
      });
    }

    const response = await fetch(
      "https://api.etsy.com/v3/application/openapi-ping",
      {
        method: "GET",
        headers: {
          "x-api-key": `${keystring}:${sharedSecret}`
        }
      }
    );

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return res.status(response.status).json({
      success: response.ok,
      status: response.status,
      diagnostics,
      etsy_response: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Ping testi başarısız.",
      details: error.message
    });
  }
}
