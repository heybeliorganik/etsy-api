export default function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Etsy bağlantısı sırasında hata oluştu",
      error: error,
    });
  }

  if (!code) {
    return res.status(200).json({
      success: true,
      message: "Etsy callback adresi çalışıyor",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Etsy yetkilendirme kodu başarıyla alındı",
    state: state ? "received" : "not_received",
  });
}
