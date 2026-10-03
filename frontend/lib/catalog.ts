export type Product = {
  id: string;
  name: string;
  genericName: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  mrp?: number;
  stock: number;
  unit: string;
  sku: string;
  prescriptionRequired?: boolean;
  featured?: boolean;
  badge?: string;
  visual: string;
  tone: string;
  imageUrl?: string;
  imageUrls?: string[];
  wholesaleDiscountPercent?: number;
  bonusScheme?: string;
  pricesVisible?: boolean;
  demandScore?: number;
};

export function formatNPR(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}
