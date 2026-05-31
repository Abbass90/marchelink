// CLAUDE.md §31 : UN SEUL module API client. Aucun fetch() brut dans les composants.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/* ── Error Class ─────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ── Generic Fetch ───────────────────────────────────── */

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // cookies httpOnly (CLAUDE.md §11)
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'UNKNOWN', body.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

/* ── Auth Types ──────────────────────────────────────── */

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | undefined;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
}

/* ── Auth API Functions ──────────────────────────────── */

export function authRegister(payload: RegisterPayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function authLogin(payload: LoginPayload): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function authLogout(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/logout', {
    method: 'POST',
  });
}

export function authRefresh(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/refresh', {
    method: 'POST',
  });
}

export function authMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/auth/me');
}

/* ── Profile & Password ──────────────────────────────── */

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  return apiFetch<UserProfile>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/* ── Wholesaler Registration ────────────────────────── */

export interface RegisterWholesalerPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | undefined;
  organization_name: string;
}

export function authRegisterWholesaler(
  payload: RegisterWholesalerPayload,
): Promise<{ id: string; organization_id: string }> {
  return apiFetch<{ id: string; organization_id: string }>('/auth/register-wholesaler', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* ── Product Types ───────────────────────────────────── */

export interface Product {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string | null;
  price_xof: string; // BIGINT comes as string from pg
  stock_qty: number;
  unit: string;
  category: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrowseProduct extends Product {
  org_name: string;
}

export interface BrowseParams {
  // `| undefined` explicite : permet de passer `key: undefined` au call site
  // sous exactOptionalPropertyTypes (les filtres optionnels du catalogue).
  q?: string | undefined;
  org_id?: string | undefined;
  category?: string | undefined;
  min_price?: number | undefined;
  max_price?: number | undefined;
  in_stock?: boolean | undefined;
  sort?: 'price_asc' | 'price_desc' | 'name' | 'newest' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PaginatedProducts {
  data: BrowseProduct[];
  total: number;
  page: number;
  limit: number;
}

/* ── Product API Functions ───────────────────────────── */

export function fetchProducts(params?: BrowseParams): Promise<PaginatedProducts> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.org_id) qs.set('org_id', params.org_id);
  if (params?.category) qs.set('category', params.category);
  if (params?.min_price !== undefined) qs.set('min_price', String(params.min_price));
  if (params?.max_price !== undefined) qs.set('max_price', String(params.max_price));
  if (params?.in_stock) qs.set('in_stock', 'true');
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiFetch<PaginatedProducts>(`/products/browse${query ? `?${query}` : ''}`);
}

export function fetchProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`);
}

/* ── Order Types ────────────────────────────────────── */

export interface OrderItemPayload {
  product_id: string;
  quantity: number;
}

export interface PlaceOrderPayload {
  wholesaler_org_id: string;
  items: OrderItemPayload[];
}

export interface OrderItemResponse {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_xof: string;
  line_total_xof: string;
}

export interface OrderResponse {
  id: string;
  wholesaler_org_id: string;
  buyer_user_id: string;
  status: string;
  total_xof: string;
  payment_id: string | null;
  delivery_id: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItemResponse[];
}

/* ── Order API Functions ────────────────────────────── */

export function placeOrder(payload: PlaceOrderPayload): Promise<OrderResponse> {
  return apiFetch<OrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMyOrders(): Promise<OrderResponse[]> {
  return apiFetch<OrderResponse[]>('/orders/my');
}

export function fetchOrderForBuyer(orderId: string): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/my/${orderId}`);
}

export function cancelOrder(orderId: string): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/my/${orderId}/cancel`, {
    method: 'PATCH',
  });
}

/* ── Wholesaler Order API Functions ─────────────────── */

export function fetchOrgOrders(): Promise<OrderResponse[]> {
  return apiFetch<OrderResponse[]>('/orders/org');
}

export function fetchOrgOrder(orderId: string): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/org/${orderId}`);
}

export function updateOrderStatus(orderId: string, status: 'accepted' | 'rejected'): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/org/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/* ── Payment Types ──────────────────────────────────── */

export interface InitiatePaymentPayload {
  order_id: string;
  phone_number: string;
}

export interface PaymentResponse {
  id: string;
  order_id: string;
  wholesaler_org_id: string;
  provider: string;
  provider_ref: string | null;
  status: string;
  amount_xof: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookSimPayload {
  idempotency_key: string;
  provider_ref: string;
  status: 'completed' | 'failed';
}

export interface WebhookResponse {
  already_processed: boolean;
  payment: PaymentResponse;
}

/* ── Payment API Functions ──────────────────────────── */

export function initiatePayment(payload: InitiatePaymentPayload): Promise<PaymentResponse> {
  return apiFetch<PaymentResponse>('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function simulateWebhook(payload: WebhookSimPayload): Promise<WebhookResponse> {
  return apiFetch<WebhookResponse>('/payments/webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* ── Dashboard Types ──────────────────────────────────── */

export interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  stock_qty: number;
}

export interface DashboardStats {
  revenue_today_xof: number;
  orders_today: number;
  orders_pending: number;
  low_stock_products: LowStockProduct[];
}

/* ── Dashboard API Function ───────────────────────────── */

export function fetchDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/dashboard');
}

/* ── Wholesaler Product Management Types ──────────────── */

export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string | undefined;
  price_xof: number;
  stock_qty: number;
  unit?: string | undefined;
  category?: string | undefined;
  image_url?: string | undefined;
}

export interface UpdateProductPayload {
  name?: string | undefined;
  description?: string | undefined;
  price_xof?: number | undefined;
  stock_qty?: number | undefined;
  unit?: string | undefined;
  category?: string | undefined;
  image_url?: string | null | undefined;
}

/* ── Wholesaler Product API Functions ─────────────────── */

export function fetchMyProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('/products');
}

export function createProduct(payload: CreateProductPayload): Promise<Product> {
  return apiFetch<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id: string): Promise<void> {
  return apiFetch<void>(`/products/${id}`, {
    method: 'DELETE',
  });
}

/* ── Delivery Types ───────────────────────────────────── */

export interface DeliveryResponse {
  id: string;
  order_id: string;
  wholesaler_org_id: string;
  assigned_to_user_id: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableOrder {
  id: string;
  wholesaler_org_id: string;
  buyer_user_id: string;
  status: string;
  total_xof: string;
  created_at: string;
}

/* ── Delivery API Functions ───────────────────────────── */

export function fetchMyDeliveries(): Promise<DeliveryResponse[]> {
  return apiFetch<DeliveryResponse[]>('/deliveries/mine');
}

export function fetchAvailableDeliveries(): Promise<AvailableOrder[]> {
  return apiFetch<AvailableOrder[]>('/deliveries/available');
}

export function acceptDelivery(orderId: string): Promise<DeliveryResponse> {
  return apiFetch<DeliveryResponse>(`/deliveries/accept/${orderId}`, {
    method: 'POST',
  });
}

export function completeDelivery(deliveryId: string): Promise<DeliveryResponse> {
  return apiFetch<DeliveryResponse>(`/deliveries/${deliveryId}/delivered`, {
    method: 'PATCH',
  });
}

/* ── Order Timeline Types ───────────────────────────────── */

export interface OrderEvent {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

/* ── Order Timeline API Functions ───────────────────────── */

export function fetchOrderTimeline(orderId: string): Promise<OrderEvent[]> {
  return apiFetch<OrderEvent[]>(`/orders/my/${orderId}/timeline`);
}

export function fetchOrgOrderTimeline(orderId: string): Promise<OrderEvent[]> {
  return apiFetch<OrderEvent[]>(`/orders/org/${orderId}/timeline`);
}

/* ── Payment History API Functions ──────────────────────── */

export function fetchMyPayments(): Promise<PaymentResponse[]> {
  return apiFetch<PaymentResponse[]>('/payments/my');
}

export function fetchOrgPayments(): Promise<PaymentResponse[]> {
  return apiFetch<PaymentResponse[]>('/payments/org');
}

/* ── Chat Types ─────────────────────────────────────────── */

export interface ChatOrg {
  id: string;
  name: string;
}

export interface Conversation {
  id: string;
  buyer_user_id: string;
  wholesaler_org_id: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithMeta extends Conversation {
  org_name: string;
  buyer_name: string;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: string; // PG COUNT comes as string
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface PaginatedMessages {
  data: ChatMessage[];
  total: number;
  page: number;
  limit: number;
}

/* ── Chat API Functions ─────────────────────────────────── */

export function listChatOrgs(): Promise<ChatOrg[]> {
  return apiFetch<ChatOrg[]>('/chat/orgs');
}

export function createConversation(wholesalerOrgId: string): Promise<Conversation> {
  return apiFetch<Conversation>('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ wholesaler_org_id: wholesalerOrgId }),
  });
}

export function listConversations(): Promise<ConversationWithMeta[]> {
  return apiFetch<ConversationWithMeta[]>('/chat/conversations');
}

export function getMessages(convId: string, page = 1, limit = 20): Promise<PaginatedMessages> {
  return apiFetch<PaginatedMessages>(`/chat/conversations/${convId}/messages?page=${page}&limit=${limit}`);
}

export function sendChatMessage(convId: string, body: string): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function markConversationRead(convId: string): Promise<void> {
  return apiFetch<void>(`/chat/conversations/${convId}/read`, { method: 'PATCH' });
}

/* ── Admin Types ────────────────────────────────────────── */

export interface PlatformStats {
  total_users: number;
  total_organizations: number;
  total_orders: number;
  total_revenue_xof: number;
  orders_by_status: Record<string, number>;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
  org_name: string | null;
}

export interface AdminOrg {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  user_count: string;
}

export interface AdminOrder {
  id: string;
  wholesaler_org_id: string;
  buyer_user_id: string;
  status: string;
  total_xof: string;
  created_at: string;
  buyer_name: string;
  org_name: string;
}

/* ── Admin API Functions ────────────────────────────────── */

export function fetchAdminStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>('/admin/stats');
}

export function fetchAdminUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/admin/users');
}

export function fetchAdminOrgs(): Promise<AdminOrg[]> {
  return apiFetch<AdminOrg[]>('/admin/organizations');
}

export function fetchAdminOrders(): Promise<AdminOrder[]> {
  return apiFetch<AdminOrder[]>('/admin/orders');
}

/* ── Favorites Types ────────────────────────────────────── */

export interface FavoriteItem {
  id: string;               // favorites row ID
  product_id: string;
  product_name: string;
  product_sku: string;
  product_price_xof: string; // BIGINT → string
  product_stock_qty: number;
  product_unit: string;
  product_category: string;
  product_image_url: string | null;
  product_organization_id: string;
  org_name: string;
  created_at: string;
}

/* ── Favorites API Functions ────────────────────────────── */

export function getFavorites(): Promise<FavoriteItem[]> {
  return apiFetch<FavoriteItem[]>('/favorites');
}

export function addFavorite(productId: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/favorites/${productId}`, { method: 'POST' });
}

export function removeFavorite(productId: string): Promise<void> {
  return apiFetch<void>(`/favorites/${productId}`, { method: 'DELETE' });
}

/* ── Assistant IA Types ─────────────────────────────────── */

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

/* ── Assistant IA API Functions ─────────────────────────── */

export function sendAssistantMessage(
  message: string,
  history: AssistantTurn[] = [],
): Promise<{ reply: string }> {
  return apiFetch<{ reply: string }>('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
}
