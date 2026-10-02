export default async function handler(req, res) {
  try {
    const keystring = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;

    if (!keystring || !sharedSecret) {
      return res.status(500).json({
        success: false,
        error: "Etsy API bilgileri eksik.",
      });
    }

    const response = await fetch(
      "https://api.etsy.com/v3/application/openapi-ping",
      {
        method: "GET",
        headers: {
          "x-api-key": `${keystring}:${sharedSecret}`,
        },
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
      etsy_response: data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Ping testi başarısız.",
      details: error.message,
    });
  }
}
