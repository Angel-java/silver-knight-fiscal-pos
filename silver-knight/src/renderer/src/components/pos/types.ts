export interface CartItem {
  productId: string
  categoryId: string | null
  productName: string
  quantity: number
  unitPriceUsd: number
  ivaRate: number
}