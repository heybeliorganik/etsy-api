import { etsyFetch } from "./etsyClient.js";

export default async function handler(req, res) {
  try {
    const shopId = 67653092;

    const receiptsResponse = await etsyFetch(
      `/application/shops/${shopId}/receipts?limit=100`
    );

    const receiptsData = await receiptsResponse.json();

    if (!receiptsResponse.ok) {
      return res.status(receiptsResponse.status).json({
        success: false,
        version: "orders-v2",
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
      version: "orders-v2",
      shop_id: shopId,
      count: receiptsData.count,
      returned: orders.length,
      orders
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      version: "orders-v2",
      error: "Sipariş işlemi başarısız.",
      details: error.message
    });
  }
}
