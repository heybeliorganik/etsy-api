import { etsyFetch } from "./etsyClient.js";

export default async function handler(req, res) {
  try {
    const shopResponse = await etsyFetch(
      "/application/users/me/shops"
    );

    const shopData = await shopResponse.json();

    if (!shopResponse.ok || !shopData.shop_id) {
      return res.status(shopResponse.status || 500).json({
        success: false,
        error: "Shop ID alınamadı.",
        details: shopData
      });
    }

    const shopId = shopData.shop_id;

    const receiptsResponse = await etsyFetch(
      `/application/shops/${shopId}/receipts?limit=100`
    );

    const receiptsData = await receiptsResponse.json();

    if (!receiptsResponse.ok) {
      return res.status(receiptsResponse.status).json({
        success: false,
        error: "Etsy siparişleri alınamadı.",
        details: receiptsData
      });
    }

    const orders = (receiptsData.results || []).map((receipt) => ({
      receipt_id: receipt.receipt_id,
      status: receipt.status,
      is_paid: receipt.is_paid,
      is_shipped: receipt.is_shipped,
      create_timestamp: receipt.create_timestamp,
      update_timestamp: receipt.update_timestamp,
      grandtotal: receipt.grandtotal,
      subtotal: receipt.subtotal,
      total_shipping_cost: receipt.total_shipping_cost,
      total_tax_cost: receipt.total_tax_cost,
      currency_code: receipt.grandtotal?.currency_code || null,
      name: receipt.name || null,
      country_iso: receipt.country_iso || null,
      transactions: receipt.transactions || []
    }));

    return res.status(200).json({
      success: true,
      shop_id: shopId,
      count: receiptsData.count,
      returned: orders.length,
      orders
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Sipariş işlemi başarısız.",
      details: error.message
    });
  }
}
