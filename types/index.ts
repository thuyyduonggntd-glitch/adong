import { Role, OrderStatus } from '@prisma/client';

export type { Role, OrderStatus };

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: Role;
}

export interface ProductWithCategory {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  isActive: boolean;
  category: { id: string; name: string; slug: string };
  createdAt: Date;
}

export interface OrderWithItems {
  id: string;
  totalAmount: number;
  status: OrderStatus;
  note: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  createdAt: Date;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    size: string;
    color: string;
    product: { id: string; name: string; images: string[] };
  }>;
}

export interface CartItem {
  id: string;
  quantity: number;
  size: string;
  color: string;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
  };
}
