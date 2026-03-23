export type ProductQr = {
  id: string;
  qrCode: string;
  productName: string;
  weight: number;
  isActive: boolean;
  productType: string;
};

// Seed data for MVP demos:
// - Keep this list as the single source of truth for QR fixtures.
// - New test QR codes should be added here first.
export const MOCK_QRS: ProductQr[] = [
  {
    id: "qr-1",
    qrCode: "DONGU-1001",
    productName: "20g Deterjan Paketi",
    weight: 20,
    isActive: true,
    productType: "packaging",
  },
  {
    id: "qr-2",
    qrCode: "DONGU-1002",
    productName: "35g Sampuan Paketi",
    weight: 35,
    isActive: true,
    productType: "packaging",
  },
  {
    id: "qr-3",
    qrCode: "DONGU-1003",
    productName: "50g Sivi Sabun Paketi",
    weight: 50,
    isActive: true,
    productType: "packaging",
  },
  {
    id: "qr-4",
    qrCode: "DONGU-2001",
    productName: "Maden Suyu Sisesi",
    weight: 10,
    isActive: true,
    productType: "plastic_or_glass",
  },
  {
    id: "qr-5",
    qrCode: "DONGU-2002",
    productName: "Cips Paketi",
    weight: 12,
    isActive: true,
    productType: "packaging",
  },
];
