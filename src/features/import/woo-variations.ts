// Woo's product list gives variations as {id, attributes} but keeps their
// price and SKU to itself. For APPROVED variable products, promote.ts fetches
// each variation individually — curation-before-dump keeps this to a handful
// of polite requests instead of thousands.
import { SUPPLIERS } from "./config";
import { fetchJson } from "./http";

export type WooVariationDetail = {
  id: number;
  sku: string;
  prices: {
    price: string;
    regular_price: string;
    currency_minor_unit: number;
  };
  is_in_stock: boolean;
};

export async function fetchWooVariation(
  variationId: string,
): Promise<WooVariationDetail> {
  return fetchJson<WooVariationDetail>(
    `${SUPPLIERS.distrisex.baseUrl}/wp-json/wc/store/v1/products/${variationId}`,
  );
}
