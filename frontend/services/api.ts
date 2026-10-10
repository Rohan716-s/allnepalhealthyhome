import { getStoredTablePageSize } from "@/lib/table-preferences";

import { OfflineError } from "@/lib/offline/db";
import { localDocument, offlineRequest, setOfflineTransport } from "@/lib/offline/engine";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
).replace(/\/$/, "");

export type FieldSalesProduct = { id: string; name: string; sku: string; price: number; unit: string; available: number; prescriptionRequired: boolean };
export type FieldSalesRecord = { id: string; executiveId: string; customerId: string; kind: string; status: string; notes: string; amount: number; occurredAt: string; followUpAt?: string; orderId?: string; resultId?: string; reviewNote?: string; payloadJson: string };
export type FieldSalesWorkspace = {
  role: string; branchId?: string;
  assignments: { id: string; executiveId: string; customerId: string; branchId: string; territory: string; isActive: boolean }[];
  customers: { id: string; fullName: string; phone: string; creditLimit: number; paymentTermsDays: number; addresses: { id: string; label: string; streetTole: string; municipality: string }[] }[];
  records: FieldSalesRecord[];
  orders: { id: string; orderNumber: string; customerId: string; status: string; paymentStatus: string; total: number; createdAt: string; items: { productId: string; productName: string; quantity: number; unit: string; unitPrice: number }[] }[];
  invoices: { id: string; invoiceNumber: string; orderId: string; customerId: string; total: number; paidAmount: number; dueAt?: string }[];
  targets: { executiveId: string; targetAmount: number; discountLimitPercent: number; month: string }[];
  summary: { sales: number; target: number; orders: number; pending: number; outstanding: number };
};
export type FieldSalesOptions = { executives: { id: string; fullName: string; branchId: string }[]; customers: { id: string; fullName: string; phone: string }[]; branches: { id: string; name: string }[] };
export function fieldSalesRequest<T>(token: string, path: string, input?: unknown, method = "POST") {
  return requestApi<T>(`/api/field-sales/${path}`, input === undefined ? {} : { method, body: JSON.stringify(input) }, token);
}
export function uploadFieldSalesProof(token: string, file: File) {
  const body = new FormData(); body.append("file", file);
  return requestApi<{ url: string }>("/api/field-sales/proof", { method: "POST", body }, token);
}
export function downloadFieldSalesProof(token: string, url: string) { return downloadOrderDocument(url, token); }
const API_REQUEST_TIMEOUT_MS = 20_000;

export function resolveMediaUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  if (value.startsWith("/api/") || value.startsWith("/uploads/"))
    return `${API_BASE_URL}${value}`;
  return value;
}

export type FinancialVoucher = {
  id: string; number: string; type: string; voucherDate: string; reference: string; narration: string;
  debitAccount: string; creditAccount: string; amount: number; method: string; chequeNumber?: string;
  bankName?: string; payee?: string; status: "DRAFT" | "POSTED"; branchId?: string; branchName?: string;
  invoiceId?: string; supplierInvoiceId?: string; invoiceNumber?: string; partyName?: string;
  revision: number; postedAt?: string; createdAt: string; updatedAt: string;
};
export type FinancialInvoiceOption = { id: string; invoiceNumber: string; partyId: string; partyName: string; branchId?: string; total: number; paidAmount: number; balance: number; dueAt?: string };
export type FinancialOptions = { branches: { id: string; name: string }[]; accounts: { id: string; code: string; name: string; accountType: string }[]; customerInvoices: FinancialInvoiceOption[] | null; supplierInvoices: FinancialInvoiceOption[] | null };
export type FinancialVoucherInput = Pick<FinancialVoucher, "type" | "voucherDate" | "reference" | "narration" | "debitAccount" | "creditAccount" | "amount" | "method"> & {
  chequeNumber?: string; bankName?: string; payee?: string; branchId?: string; invoiceId?: string; supplierInvoiceId?: string; revision?: number;
};
export type AutoVoucher = { id: string; entryDate: string; reference: string; description: string; debitAccount: string; creditAccount: string; amount: number; status: string };
export type FinancialDebtorLedger = { opening: number; entries: { id: string; entryDate: string; entryType: string; amount: number; description: string; reference?: string }[] };
const financialPath = (superAdmin: boolean) => `/api/${superAdmin ? "superadmin" : "admin"}/sales-purchase/finance`;
export function getFinancialOptions(token: string, superAdmin = false, branchId?: string, from?: string, to?: string) {
  const query = new URLSearchParams(); if (branchId) query.set("branchId", branchId); if (from) query.set("from", from); if (to) query.set("to", to);
  return requestApi<FinancialOptions>(`${financialPath(superAdmin)}/options?${query}`, {}, token);
}
export function getFinancialVouchers(token: string, filters: { from?: string; to?: string; type?: string; status?: string; search?: string; branchId?: string } = {}, superAdmin = false) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => !!value) as [string, string][]);
  return requestApi<FinancialVoucher[]>(`${financialPath(superAdmin)}/vouchers?${query}`, {}, token);
}
export function getFinancialVoucher(token: string, id: string, superAdmin = false) { return requestApi<FinancialVoucher>(`${financialPath(superAdmin)}/vouchers/${encodeURIComponent(id)}`, {}, token); }
export function saveFinancialVoucher(token: string, input: FinancialVoucherInput, id?: string, superAdmin = false) {
  return requestApi<FinancialVoucher>(`${financialPath(superAdmin)}/vouchers${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(input) }, token);
}
export function transitionFinancialVoucher(token: string, voucher: FinancialVoucher, action: "post" | "unpost", reason: string, superAdmin = false) {
  return requestApi<FinancialVoucher>(`${financialPath(superAdmin)}/vouchers/${voucher.id}/${action}`, { method: "POST", body: JSON.stringify({ revision: voucher.revision, reason }) }, token);
}
export function editFinancialNarration(token: string, voucher: FinancialVoucher, narration: string, reason: string, superAdmin = false) {
  return requestApi<FinancialVoucher>(`${financialPath(superAdmin)}/vouchers/${voucher.id}/narration`, { method: "PUT", body: JSON.stringify({ revision: voucher.revision, narration, reason }) }, token);
}
export function getFinancialPrint(token: string, id: string, superAdmin = false) {
  return requestApi<FinancialVoucher>(`${financialPath(superAdmin)}/vouchers/${id}/print`, {}, token);
}
export function getFinancialAutoVouchers(token: string, from?: string, to?: string, superAdmin = false, branchId?: string) {
  const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to); if (branchId) query.set("branchId", branchId);
  return requestApi<AutoVoucher[]>(`${financialPath(superAdmin)}/auto-vouchers?${query}`, {}, token);
}
export function getFinancialDebtorLedger(token: string, customerId: string, filters: { branchId?: string; from?: string; to?: string }, superAdmin = false) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => !!value) as [string, string][]);
  return requestApi<FinancialDebtorLedger>(`${financialPath(superAdmin)}/debtor-ledger/${customerId}?${query}`, {}, token);
}

export type HealthResponse = { status: string };
export type AssistantSuggestedPrompt = { label: string; prompt: string };
export type AssistantProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  imageUrl?: string;
  imageUrls: string[];
  stockQuantity: number;
  prescriptionRequired: boolean;
  pricesVisible?: boolean;
};
export type AssistantChatResponse = {
  message: string;
  suggestedPrompts: AssistantSuggestedPrompt[];
  products: AssistantProduct[];
  sessionId: string;
  supportUrl: string;
};
export type AssistantConfig = { enabled: boolean; name: string };
export type MessagingContact = {
  id: string;
  participantType: "customer" | "staff";
  role: string;
  name: string;
  email: string;
  branchName?: string;
  canMessage: boolean;
  orderId?: string;
};
export type MessageConversation = {
  id: string;
  subject?: string;
  lastMessageAt?: string;
  unreadCount: number;
  otherParticipantName: string;
  otherParticipantRole: string;
  preview?: string;
  isClosed: boolean;
  orderId?: string;
};
export type MessageAttachment = { id: string; originalFileName: string; contentType: string; length: number; downloadUrl: string };
export type PlatformMessage = {
  id: string;
  conversationId: string;
  body: string;
  status: string;
  isMine: boolean;
  senderName: string;
  senderRole: string;
  createdAt: string;
  deliveredAt?: string;
  seenAt?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  locationSource?: string;
  attachments: MessageAttachment[];
};
export type MessageThread = { conversation: MessageConversation; messages: PlatformMessage[] };
export type MessagingRoleSetting = { role: string; isEnabled: boolean };
export type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  username?: string;
  gender?: string;
  dateOfBirth?: string;
  accountType?: "PERSONAL" | "PHARMACY" | string;
  pharmacy?: {
    panNumber: string;
    panRegisteredName?: string;
    pharmacyName?: string;
    province?: string;
    district?: string;
    municipality?: string;
    ward?: string;
    address?: string;
    drugLicenseNumber?: string;
    ownerPhone?: string;
    ownerEmail?: string;
    category: string;
    panVerificationStatus: string;
  };
};
export type AuthResponse = {
  accessToken: string;
  expiresAt: string;
  customer: Customer;
};
export type Staff = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  branchId?: string;
  branchName?: string;
  licenseReference?: string;
  employeeId?: string;
  address?: string;
  joiningDate?: string;
  profilePhotoUrl?: string;
  isActive: boolean;
  permissions?: string[];
  hrProfile?: {
    department?: string;
    jobTitle?: string;
    appointmentType?: string;
    employmentStatus?: string;
    officialEmail?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    taxNumber?: string;
    citizenshipNumber?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    bloodGroup?: string;
    deviceEnrollmentId?: string;
    mobileAccessEnabled: boolean;
    webAccessEnabled: boolean;
  };
  territory?: string;
};
export type StaffAuthResponse = {
  accessToken: string;
  expiresAt: string;
  staff: Staff;
};
export type AttendanceRecord = {
  id: string;
  staffUserId: string;
  staffName: string;
  workDate: string;
  checkInUtc?: string;
  checkOutUtc?: string;
  status: string;
  totalMinutes: number;
  overtimeMinutes: number;
  isFinalized: boolean;
  lateMinutes?: number;
  shiftId?: string;
  shiftName?: string;
  checkInLocationStatus?: string;
  checkOutLocationStatus?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInAccuracy?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutAccuracy?: number;
  nepaliWorkDate?: string;
};
export type AttendanceDashboard = {
  today?: AttendanceRecord;
  presentDays: number;
  lateDays: number;
  leaveDays: number;
  totalDays: number;
  overtimeMinutes: number;
};
export type LeaveRequest = {
  id: string;
  staffUserId: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvalComment?: string;
  createdAt: string;
  dayType?: string;
  appliedDays?: number;
  supportingDocumentUrl?: string;
};
export type LeaveAllocation = {
  id: string;
  staffUserId: string;
  staffName: string;
  leaveType: string;
  leaveYear: number;
  allocatedDays: number;
  carryForwardDays: number;
  adjustmentDays: number;
  notes?: string;
  updatedAt: string;
};
export type LeaveBalance = {
  staffUserId: string;
  staffName: string;
  leaveType: string;
  leaveYear: number;
  allocatedDays: number;
  carryForwardDays: number;
  adjustmentDays: number;
  usedDays: number;
  remainingDays: number;
  isConfigured: boolean;
};
export type OvertimeRecord = {
  id: string;
  staffUserId: string;
  staffName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  totalMinutes: number;
  overtimeType: string;
  status: string;
  remarks?: string;
  decisionComment?: string;
  createdAt: string;
};
export type EmploymentMovement = {
  id: string;
  staffUserId: string;
  staffName: string;
  movementType: string;
  effectiveDate: string;
  previousBranchId?: string;
  previousBranchName?: string;
  newBranchId?: string;
  newBranchName?: string;
  previousShiftId?: string;
  previousShiftName?: string;
  newShiftId?: string;
  newShiftName?: string;
  previousDepartment?: string;
  newDepartment?: string;
  previousJobTitle?: string;
  newJobTitle?: string;
  reason: string;
  status: string;
  decisionComment?: string;
  createdAt: string;
};
export type AccountsSummary = {
  month: string;
  revenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  purchaseCommitments: number;
  payrollTotal: number;
  orderCount: number;
};
export type PayrollRecord = {
  id: string;
  staffUserId: string;
  staffName: string;
  payrollMonth: string;
  basicSalary: number;
  allowances: number;
  overtimeAmount: number;
  bonus: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  status: string;
  paidAtUtc?: string;
  totalDeductions?: number;
  components?: PayrollComponent[];
  paymentMethod?: string;
  paymentReference?: string;
  paymentNotes?: string;
  approvedAtUtc?: string;
};
export type PayrollComponent = {
  id?: string;
  componentName: string;
  componentKind: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
  amount: number;
  displayOrder?: number;
};
export type SalaryRevision = {
  id: string;
  staffUserId: string;
  staffName: string;
  title: string;
  revisionType: string;
  effectiveDate: string;
  previousBasicSalary: number;
  revisedBasicSalary: number;
  reason?: string;
  attachmentUrl?: string;
  status: string;
  decisionComment?: string;
  createdAt: string;
};
export type PayrollSuggestion = {
  staffUserId: string;
  payrollMonth: string;
  suggestedBasicSalary: number;
  approvedOvertimeMinutes: number;
  salaryRevisionTitle?: string;
};
export type HrmsSetupItem = {
  id: string;
  category: string;
  name: string;
  code?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};
export type OfficeOperationRecord = {
  id: string;
  category: string;
  title: string;
  details?: string;
  status: string;
  staffUserId?: string;
  staffName?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  audience?: string;
  referenceNumber?: string;
  attachmentUrl?: string;
  createdAt: string;
  updatedAt: string;
};
export type AccountantDashboard = {
  revenue: number;
  receivables: number;
  payables: number;
  expenses: number;
  cashFlow: number;
  invoiceCount: number;
  topCustomers: {
    customerId: string;
    customerName: string;
    revenue: number;
    outstanding: number;
  }[];
};
export type AccountantInvoice = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  issuedAt: string;
  dueAt?: string;
};
export type AccountantPayment = {
  id: string;
  paymentNumber: string;
  invoiceNumber?: string;
  supplierInvoiceNumber?: string;
  method: string;
  status: string;
  amount: number;
  paymentDate: string;
  reference?: string;
};
export type AccountantCustomer = {
  id: string;
  name: string;
  email: string;
  creditLimit: number;
};
export type AccountantLedger = {
  customerId: string;
  customerName: string;
  email: string;
  creditLimit: number;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  overdue: number;
  entries: {
    id: string;
    entryType: string;
    amount: number;
    entryDate: string;
    dueAt?: string;
    description: string;
    reference?: string;
  }[];
};
export type SupplierInvoice = {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueAt?: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  notes?: string;
};
export type AccountantExpense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  reference?: string;
  status: string;
};
export type Reconciliation = {
  id: string;
  statementDate: string;
  bankAccount: string;
  transactionType: string;
  amount: number;
  reference: string;
  status: string;
  matchedSource?: string;
  notes?: string;
};
export type TaxSettings = {
  id: string;
  name: string;
  vatRate: number;
  effectiveFrom: string;
  isActive: boolean;
};
export type JournalEntry = {
  id: string;
  entryDate: string;
  reference: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  status: string;
};
export type AccountBalance = {
  account: string;
  debit: number;
  credit: number;
  balance: number;
};
export type AccountingSummary = {
  trialBalance: AccountBalance[];
  revenue: number;
  expenses: number;
  netProfit: number;
  receivables: number;
  payables: number;
  cashBalance: number;
  postedEntries: number;
};
export type PartySectorRecord = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  customerCount: number;
};
export type AccountSetupParty = {
  id: string;
  name: string;
  email: string;
  phone: string;
  accountType: string;
  partySectorId?: string;
  partySectorName?: string;
};
export type ChartAccountRecord = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  parentAccountId?: string;
  parentName?: string;
  isSubLedger: boolean;
  isActive: boolean;
  openingDebit: number;
  openingCredit: number;
};
export type AccountOpeningBalanceRecord = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  branchId?: string;
  branchName: string;
  openingDate: string;
  debitAmount: number;
  creditAmount: number;
  reference: string;
  notes?: string;
};
export type ManagementSidebarTheme = {
  sidebarBackground: string;
  sidebarText: string;
  sidebarIcon: string;
  sidebarHoverBackground: string;
  sidebarHoverText: string;
  sidebarActiveBackground: string;
  sidebarActiveText: string;
  sidebarActiveIcon: string;
  sidebarBorder: string;
  sidebarDivider: string;
  sidebarHeaderBackground: string;
  sidebarHeaderText: string;
  sidebarFooterBackground: string;
  sidebarFooterText: string;
  sidebarBadgeBackground: string;
  sidebarBadgeText: string;
};
export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  genericName: string;
  brand: string;
  category: string;
  strength?: string;
  dosageForm?: string;
  mrp: number;
  sellingPrice: number;
  stockQuantity: number;
  prescriptionRequired: boolean;
  isFeatured: boolean;
  createdAt: string;
  flashSalePrice?: number;
  flashSaleDiscountPercent?: number;
  flashSaleEndsAt?: string;
  flashSaleRemaining?: number;
  imageUrl?: string;
  imageUrls?: string[];
  wholesaleDiscountPercent?: number;
  bonusScheme?: string;
  isTrending?: boolean;
  isHotDeal?: boolean;
  pricesVisible?: boolean;
  companyCode?: string;
  companyName?: string;
  demandScore?: number;
  imageSourceUrl?: string;
  imageVerificationStatus?: string;
  imageSourceReference?: string;
  demandBasis?: string;
  demandSourceUrl?: string;
  demandSourceReference?: string;
};
export type TrendingProduct = { stockQuantity: number; id: string; name: string; slug: string; sellingPrice: number; imageUrl?: string; imageUrls: string[]; pricesVisible?: boolean };
export type ProductDetail = Product & {
  manufacturer: string;
  description?: string;
  uses?: string;
  warnings?: string;
  sideEffects?: string;
  storageInformation?: string;
  imageUrl?: string;
};
export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
};
export type CatalogBrand = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};
export type PublicSiteSummary = {
  customerCount: number;
  productCount: number;
  completedOrderCount: number;
  activeBranchCount: number;
  publishedReviewCount: number;
};
export type ProductPage = {
  items: Product[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
export type PrescriptionMatch = {
  id: string;
  productId?: string;
  productName?: string;
  brand?: string;
  sellingPrice?: number;
  confidence: number;
  matchType: string;
  availability: string;
  stockQuantity: number;
  needsPharmacistReview: boolean;
  prescriptionRequired: boolean;
  productSlug?: string;
};
export type PrescriptionItem = {
  id: string;
  detectedName: string;
  normalizedName: string;
  strength?: string;
  dosageForm?: string;
  dosage?: string;
  quantity?: number;
  frequency?: string;
  duration?: string;
  timing?: string;
  instructions?: string;
  customerEdited: boolean;
  matches: PrescriptionMatch[];
};
export type Prescription = {
  id: string;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  status: string;
  ocrProvider?: string;
  ocrStatus?: string;
  customerNote?: string;
  createdAt: string;
  submittedAt?: string;
  items: PrescriptionItem[];
};
export type DashboardStats = {
  prescriptions: Record<string, number>;
  orders: Record<string, number>;
  inventory: Record<string, number>;
};
export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
export type StaffPrescriptionListItem = {
  id: string;
  prescriptionNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  submittedAt: string;
  medicineCount: number;
  ocrConfidence: number;
  status: string;
  reviewStatus: string;
  assignedPharmacist?: string;
  priority: string;
  relatedOrderId?: string;
};
export type StaffMatch = {
  id: string;
  productId?: string;
  productName?: string;
  genericName?: string;
  brand?: string;
  sellingPrice?: number;
  confidence: number;
  matchType: string;
  availability: string;
  stockQuantity: number;
  needsPharmacistReview: boolean;
  prescriptionRequired: boolean;
};
export type StaffPrescriptionItem = {
  id: string;
  detectedName: string;
  normalizedName: string;
  strength?: string;
  dosageForm?: string;
  dosage?: string;
  quantity?: number;
  frequency?: string;
  duration?: string;
  timing?: string;
  instructions?: string;
  ocrConfidence: number;
  match?: StaffMatch;
};
export type TimelineItem = {
  status: string;
  note?: string;
  actor?: string;
  actorRole?: string;
  createdAt: string;
};
export type StaffPrescription = {
  id: string;
  prescriptionNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: string;
  submittedAt?: string;
  originalFileName: string;
  contentType: string;
  status: string;
  ocrProvider?: string;
  ocrStatus?: string;
  ocrText?: string;
  customerNote?: string;
  items: StaffPrescriptionItem[];
  timeline: TimelineItem[];
  reviews: {
    status: string;
    notes?: string;
    reviewer?: string;
    reviewedAt?: string;
    createdAt: string;
  }[];
};
export type StaffOrderListItem = {
  amountDue?: number;
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  prescriptionRequired: boolean;
  deliveryStatus?: string;
  deliveryStaff?: string;
};
export type DeliveryLocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  updatedAt: string;
};
export type DeliveryTrackingSnapshot = {
  orderId: string;
  orderNumber: string;
  deliveryStatus: string;
  riderName: string | null;
  location: DeliveryLocationSnapshot | null;
  destinationAddress?: string | null;
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  } | null;
};
export type RiderAvailability = {
  isAvailable: boolean;
  hasActiveDelivery: boolean;
  location: DeliveryLocationSnapshot | null;
};
export type NearbyDeliveryRider = {
  riderId: string;
  riderName: string;
  distanceMeters: number;
  isAvailable: boolean;
  lastUpdatedAt: string;
};
export type StaffOrder = {
  amountDue?: number;
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  deliveryFee: number;
  deliveryInstructions?: string;
  branchId?: string;
  branchName?: string;
  pharmacistId?: string;
  pharmacistName?: string;
  pricesVisible?: boolean;
  documents?: OrderDocument[];
  address?: {
    label: string;
    province: string;
    district: string;
    municipality: string;
    ward: string;
    streetTole: string;
    landmark?: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  };
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    sku: string;
    prescriptionRequired: boolean;
  }[];
  prescription?: { id: string; status: string; notes?: string };
  timeline: TimelineItem[];
  delivery?: {
    id: string;
    deliveryStaffId: string;
    deliveryStaff: string;
    status: string;
    acceptedAt?: string;
    arrivedAt?: string;
    pickedUpAt?: string;
    outForDeliveryAt?: string;
    deliveredAt?: string;
    failedAt?: string;
    failureReason?: string;
    notes?: string;
    currentLocation?: DeliveryLocationSnapshot | null;
    pickup?: {
      latitude: number;
      longitude: number;
      address: string;
    } | null;
    pickupAddress?: string;
  };
};
export function getAdminLiveDeliveries(token: string, superAdmin = false): Promise<DeliveryTrackingSnapshot[]> {
  return request<DeliveryTrackingSnapshot[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/live`,
    {},
    token,
  );
}
export function getNearbyDeliveryRiders(orderId: string, token: string, superAdmin = false): Promise<NearbyDeliveryRider[]> {
  return request<NearbyDeliveryRider[]>(`/api/${superAdmin ? "superadmin" : "admin"}/orders/${orderId}/nearby-riders`, {}, token);
}
export type SalesExecutiveAssignment = {
  id: string;
  salesExecutiveUserId: string;
  salesExecutiveName: string;
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryName?: string;
  isActive: boolean;
  createdAt: string;
  phone?: string;
  email?: string;
  branchName?: string;
  territory?: string;
  branchId?: string;
  productSku?: string;
  productBrand?: string;
  productCategory?: string;
  productSellingPrice?: number;
};
export type SalesExecutiveOption = { id: string; fullName: string; email: string; phone: string; branchId?: string; branchName?: string; territory?: string };
export type SalesAssignmentBranchOption = { id: string; name: string };
export type BulkSalesExecutiveAssignmentResponse = {
  created: SalesExecutiveAssignment[];
  skippedDuplicates: number;
};
export type BulkSalesExecutiveAssignmentMutationResponse = { updated: number; deleted: number };
export type SalesExecutiveOrderItem = {
  productId: string;
  productName: string;
  categoryName?: string;
  quantity: number;
  unitPrice: number;
  salesValue: number;
};
export type SalesExecutiveOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  createdAt: string;
  status: string;
  branchName?: string;
  items: SalesExecutiveOrderItem[];
  relevantSalesValue: number;
};
export type SalesExecutiveDashboard = {
  totalOrders: number;
  totalSalesValue: number;
  from: string;
  to: string;
  recentOrders: SalesExecutiveOrder[];
};
export type SalesExecutiveOrdersResponse = {
  items: SalesExecutiveOrder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type InventoryItem = {
  id: string;
  productId: string;
  medicine: string;
  genericName: string;
  brand: string;
  sku: string;
  batchNumber: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  mrp: number;
  sellingPrice: number;
  expiryDate?: string;
  branch: string;
  status: string;
  minimumStock: number;
};
export type StaffNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};
export type StaffCustomer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  orders: number;
  prescriptions: number;
  lastOrder?: string;
  isActive: boolean;
};
export type StaffActivity = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorRole?: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
};
export type AdminGlobalSearchResult = {
  type: string;
  id: string;
  label: string;
  secondary?: string;
  href: string;
};
export type AdminDashboard = {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalRevenue: number;
  orders: Record<string, number>;
  prescriptions: Record<string, number>;
  inventory: Record<string, number>;
  staff: Record<string, number>;
  revenueTrend: { label: string; revenue: number; orders: number }[];
  topProducts: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];
  categorySales: { category: string; quantity: number; revenue: number }[];
  recentOrders: AdminOrder[];
  kpis: {
    totalCustomers: number;
    newCustomers: number;
    pendingOrders: number;
    processingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    pendingPrescriptions: number;
    approvedPrescriptions: number;
    rejectedPrescriptions: number;
    pendingPayments: number;
    codOrders: number;
    onlineOrders: number;
    activeBranches: number;
    activePharmacists: number;
    activeDeliveryStaff: number;
    rangeStart: string;
    rangeEnd: string;
  };
  operations?: {
    yesterdayRevenue: number;
    yearRevenue: number;
    activeCustomers: number;
    inactiveCustomers: number;
    totalProducts: number;
    stockValue: number;
    delivery: Record<string, number>;
    paymentMethods: Record<string, number>;
    customerRegistrations: { label: string; customers: number }[];
    branchPerformance: {
      branchId?: string;
      branchName: string;
      orders: number;
      revenue: number;
      cashIn: number;
      cashOut: number;
      netCashFlow: number;
    }[];
  };
};
export type AdminProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  slug: string;
  medicineId: string;
  brandId: string;
  brand: string;
  category: string;
  genericName: string;
  mrp: number;
  sellingPrice: number;
  isActive: boolean;
  prescriptionRequired: boolean;
  stock: number;
  createdAt: string;
  imageUrl?: string;
  imageUrls?: string[];
  bonusScheme?: string;
  isTrending: boolean;
  isHotDeal: boolean;
  baseUnit?: string;
  purchaseUnit?: string;
  purchaseUnitToBase?: number;
  units?: { name: string; multiplierToBase: number; isPurchaseUnit: boolean; isSalesUnit: boolean }[];
  companyCode?: string;
  companyName?: string;
  imageSourceUrl?: string;
  imageVerificationStatus: string;
  imageSourceReference?: string;
  imageSourceWebsite?: string;
  imageSourcePageUrl?: string;
  imageSearchedAtUtc?: string;
  imageMatchingNotes?: string;
  imageMediaAssetId?: string;
  demandScore: number;
  demandBasis: string;
  demandSourceUrl?: string;
  demandSourceReference?: string;
  displayOrder: number;
  importStatus: string;
  missingImageStatus: string;
};
export type AdminMedicine = {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  prescriptionRequired: boolean;
  isActive: boolean;
  categoryId?: string;
  manufacturerId?: string;
};
export type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};
export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
};
export type AdminManufacturer = { id: string; name: string; country?: string };
export type AdminInventory = {
  id: string;
  productId: string;
  branchId: string;
  productName: string;
  sku: string;
  batchNumber: string;
  branch: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  purchasePrice?: number | null;
  sellingPrice: number;
  expiryDate?: string;
  status: string;
};
export type AdminInventoryTransfer = {
  source: AdminInventory;
  target: AdminInventory;
};
export type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  branch?: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  orderMode?: string;
};
export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode?: string;
  deliveryInstructions?: string;
  branchName?: string;
  branchId?: string;
  pharmacistId?: string;
  pharmacistName?: string;
  deliveryStaffId?: string;
  invoiceNumber?: string;
  customerNotes?: string;
  orderMode?: string;
  supervisorId?: string;
  assignedStaffUserId?: string;
  documents?: OrderDocument[];
  address?: {
    label: string;
    province: string;
    district: string;
    municipality: string;
    ward: string;
    streetTole: string;
    landmark?: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  };
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    sku: string;
    prescriptionRequired: boolean;
  }[];
  prescription?: { id: string; status: string; notes?: string };
  timeline: {
    status: string;
    note?: string;
    actor?: string;
    actorRole?: string;
    createdAt: string;
  }[];
  delivery?: {
    id: string;
    deliveryStaffId: string;
    deliveryStaff: string;
    status: string;
    acceptedAt?: string;
    arrivedAt?: string;
    pickedUpAt?: string;
    outForDeliveryAt?: string;
    deliveredAt?: string;
    failedAt?: string;
    failureReason?: string;
    notes?: string;
    currentLocation?: DeliveryLocationSnapshot | null;
  };
};
export type AdminInvoice = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  issuedAt: string;
};
export type AdminPayment = {
  id: string;
  orderNumber: string;
  customerName: string;
  method: string;
  status: string;
  amount: number;
  createdAt: string;
};
export type AdminReview = {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  orderId?: string;
  rating: number;
  title?: string;
  comment: string;
  status: string;
  adminResponse?: string;
  createdAt: string;
  publishedAt?: string;
};
export type PublicReview = {
  id: string;
  customerName: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  adminResponse?: string;
};
export type AdminSupportTicket = {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category?: string;
  resolution?: string;
  assignedStaff?: string;
  createdAt: string;
  resolvedAt?: string;
};
export type AdminSupportTicketMessage = {
  id: string;
  supportTicketId: string;
  message: string;
  isInternal: boolean;
  author?: string;
  authorType: string;
  createdAt: string;
};
export type AdminNotification = {
  id: string;
  customerId?: string;
  staffUserId?: string;
  recipient: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};
export type AdminNotificationTemplate = {
  id: string;
  code: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  variables?: string;
  isEnabled: boolean;
  updatedAt: string;
};
export type AdminHealthArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  category?: string;
  tagsCsv?: string;
  authorName?: string;
  featuredImageUrl?: string;
  status: string;
  seoTitle?: string;
  metaDescription?: string;
  publishedAt?: string;
  scheduledAt?: string;
  isFeatured: boolean;
  updatedAt: string;
};
export type AdminPrescription = {
  id: string;
  prescriptionNumber: string;
  customerName: string;
  status: string;
  itemCount: number;
  reviewer?: string;
  ocrConfidence: number;
  createdAt: string;
};
export type AdminPermission = {
  id: string;
  key: string;
  description: string;
  group: string;
  isSystem: boolean;
};
export type AdminRole = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
};
export type AdminPaymentMethod = {
  id: string;
  code: string;
  displayName: string;
  instructions?: string;
  minimumOrder?: number;
  maximumOrder?: number;
  displayOrder: number;
  isEnabled: boolean;
  requiresServerVerification: boolean;
  qrCodeUrl?: string;
};
export type OrderDocument = {
  id: string;
  kind: string;
  originalFileName: string;
  contentType: string;
  length: number;
  createdAt: string;
  downloadUrl: string;
};
export type PriceVisibilitySettings = {
  defaultVisible: boolean;
  roleOverrides: Record<string, boolean>;
  customerOverrides: Record<string, boolean>;
};
export type DeliveryRulesSettings = {
  geofenceRadiusMeters: number;
  enforceGeofence: boolean;
  requiredDocumentTypes: string[];
};
export type DeliveryOrderRequirements = {
  enforceGeofence: boolean;
  geofenceRadiusMeters: number;
  requiredDocumentTypes: string[];
  uploadedDocumentTypes: string[];
  hasDestinationCoordinates: boolean;
};
export type RiderOrderCustomer = { id: string; name: string; phone: string; email: string; accountType: string; addresses: { id: string; label: string; province: string; district: string; municipality: string; ward: string; streetTole: string; landmark?: string; phone: string; latitude?: number; longitude?: number }[] };
export type RiderOrderProduct = { id: string; name: string; sku: string; unit: string; sellingPrice: number; availableQuantity: number; prescriptionRequired: boolean; allowBulk: boolean; allowSingle: boolean; minimumQuantity: number; brand?: string; barcode?: string };
export type RiderOrderInput = { customerId: string; addressId: string; items: { productId: string; quantity: number }[]; paymentMethod?: string; notes?: string; orderMode?: string; requestId?: string; expectedTotal?: number };
export type RiderOrderPreview = { subtotal: number; deliveryFee: number; total: number; items: { productId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[] };
export type RiderOrderSettings = { mode: "BULK_ONLY" | "SINGLE_ONLY" | "BULK_AND_SINGLE"; minimumBulkQuantity: number };
export type BranchOperations = { branchId: string; branchName: string; orderCount: number; customerCount: number; pharmacyOrderCount: number; pendingPaymentCount: number; assignedRiderCount: number; deliveredCount: number; orderValue: number; rangeStart: string; rangeEnd: string; productCount: number; riderCount: number; paidPaymentCount: number; paidPaymentAmount: number };
export type CustomerStatement = { customerId: string; customerName: string; customerPhone: string; from: string; to: string; orderCount: number; billedAmount: number; paidAmount: number; balance: number; orders: { orderId: string; orderNumber: string; createdAt: string; status: string; paymentStatus: string; paymentMethod: string; billedAmount: number; paidAmount: number; balance: number }[] };
export type PaymentInstructions = {
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  amountDue: number;
  instructions?: string;
  qrCodeUrl?: string;
};
export type CustomerPriceVisibility = { pricesVisible: boolean };
export type AdminCustomer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  orders: number;
  prescriptions: number;
  createdAt: string;
};
export type AdminCustomerAddress = {
  id: string;
  label: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  streetTole: string;
  landmark?: string;
  phone: string;
  isDefault: boolean;
};
export type AdminCustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  branchName?: string;
  createdAt: string;
};
export type AdminCustomerPrescription = {
  id: string;
  status: string;
  originalFileName: string;
  itemCount: number;
  createdAt: string;
};
export type AdminCustomerReview = {
  id: string;
  productName: string;
  rating: number;
  status: string;
  title?: string;
  comment: string;
  createdAt: string;
};
export type AdminCustomerDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  addresses: AdminCustomerAddress[];
  orders: AdminCustomerOrder[];
  prescriptions: AdminCustomerPrescription[];
  reviews: AdminCustomerReview[];
  supportTickets: AdminSupportTicket[];
};
export type AdminCoupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minimumOrder?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  startsAt?: string;
  endsAt?: string;
  firstOrderOnly: boolean;
  isActive: boolean;
  createdAt: string;
};
export type AdminFlashSale = {
  id: string;
  name: string;
  productId: string;
  productName: string;
  branchId?: string;
  branchName?: string;
  discountPercent: number;
  quantityLimit?: number;
  quantitySold: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  status: string;
};
export type AdminPurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  status: string;
  expectedAt?: string;
  totalAmount: number;
  itemCount: number;
  receivedItemCount: number;
  createdAt: string;
};
export type AdminPurchaseOrderDetail = AdminPurchaseOrder & {
  notes?: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    batchNumber?: string;
    expiryDate?: string;
    unit: string;
    unitMultiplier: number;
  }[];
};
export type AdminSystemHealth = {
  backend: string;
  database: string;
  databaseLatencyMs: number;
  prescriptionStorage: string;
  environment: string;
  currentTimeUtc: string;
  ocr: string;
  email: string;
  sms: string;
  whatsapp: string;
};
export type AdminIntegrations = {
  email: {
    configured: boolean;
    host?: string;
    port?: number;
    username?: string;
    senderName?: string;
    senderEmail?: string;
    encryption: string;
  };
  sms: {
    configured: boolean;
    provider?: string;
    apiUrl?: string;
    senderId?: string;
    otpExpiryMinutes: number;
    otpLength: number;
    rateLimitPerHour: number;
    retryLimit: number;
  };
  whatsapp: {
    configured: boolean;
    provider?: string;
    apiUrl?: string;
    businessNumber?: string;
    templates?: string;
  };
};
export type AdminAssistantIntegration = {
  enabled: boolean;
  configured: boolean;
  provider: string;
  model?: string;
  baseUrl?: string;
};
export type AdminFaq = {
  id: string;
  question: string;
  answer: string;
  category?: string;
  displayOrder: number;
  published: boolean;
};
export type AdminMaintenance = {
  enabled: boolean;
  message: string;
  allowAdmin: boolean;
};
export type AdminBackup = {
  id: string;
  fileName: string;
  status: string;
  provider: string;
  sizeBytes: number;
  sha256?: string;
  failureReason?: string;
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
};
export type AdminBranch = {
  id: string;
  name: string;
  address: string;
  code?: string;
  phone?: string;
  email?: string;
  province?: string;
  district?: string;
  municipality?: string;
  ward?: string;
  streetTole?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  isActive: boolean;
  createdAt: string;
};
export type AdminSupplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  isActive: boolean;
};
export type AdminTransporter = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  serviceArea?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type AdminDeliveryZone = {
  id: string;
  name: string;
  province?: string;
  district?: string;
  municipality?: string;
  ward?: string;
  branchId?: string;
  branch?: { name: string };
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minimumOrder: number;
  sameDayDelivery: boolean;
  enabled: boolean;
};
export type AdminDeliverySlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  branchId?: string;
  branchName?: string;
  maxOrders?: number;
  displayOrder: number;
  enabled: boolean;
  updatedAt: string;
};
export type DeliveryQuote = {
  zoneName?: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minimumOrder: number;
  sameDayDelivery: boolean;
};
export type PublicBranch = {
  id: string;
  name: string;
  address: string;
  province?: string;
  district?: string;
  municipality?: string;
  ward?: string;
};
export type AdminHomepageSection = {
  id: string;
  sectionKey: string;
  title: string;
  contentJson?: string;
  displayOrder: number;
  enabled: boolean;
};
export type AdminWebsiteAsset = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  buttonText?: string;
  destination?: string;
  startsAt?: string;
  endsAt?: string;
  priority: number;
  enabled: boolean;
  mobileEnabled: boolean;
  desktopEnabled: boolean;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  customLabel?: string;
  layoutVariant?: string;
  typingSpeedMs?: number;
  backgroundColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  backgroundPosition?: string;
  animationType?: string;
  slideDuration?: number;
  transitionDuration?: number;
  autoplayEnabled?: boolean;
  pauseOnHover?: boolean;
  showNavigationArrows?: boolean;
  showPaginationDots?: boolean;
  loopSlides?: boolean;
  randomizeSlides?: boolean;
  respectSchedule?: boolean;
  updatedAt?: string;
};
export type AdminHeroSlide = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  desktopImage?: string;
  mobileImage?: string;
  videoUrl?: string;
  customLabel?: string;
  layoutVariant: string;
  typingSpeedMs: number;
  backgroundColor: string;
  overlayOpacity: number;
  textAlignment: string;
  contentPosition: string;
  backgroundPosition: string;
  animationType: string;
  slideDuration: number;
  transitionDuration: number;
  displayOrder: number;
  isActive: boolean;
  autoplayEnabled: boolean;
  pauseOnHover: boolean;
  showNavigationArrows: boolean;
  showPaginationDots: boolean;
  loopSlides: boolean;
  randomizeSlides: boolean;
  respectSchedule: boolean;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
};
export type UpsertHeroSlideInput = Omit<AdminHeroSlide, "id" | "updatedAt">;
export type AdminNavigationMenuItem = {
  id: string;
  menuKey: string;
  label: string;
  url: string;
  parentId?: string;
  icon?: string;
  displayOrder: number;
  isVisible: boolean;
  openInNewTab: boolean;
  updatedAt: string;
};
export type AdminRoleSidebarMenuItem = {
  id: string;
  role: string;
  label: string;
  href: string;
  icon: string;
  displayOrder: number;
  isVisible: boolean;
};
export type AdminPopupCampaign = {
  id: string;
  kind: string;
  title: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
  destination?: string;
  delaySeconds: number;
  frequency: string;
  audience: string;
  mobileEnabled: boolean;
  desktopEnabled: boolean;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  updatedAt: string;
};
export type AdminSeoEntry = {
  id: string;
  scope: string;
  path: string;
  title?: string;
  metaDescription?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  robots: string;
  isActive: boolean;
  updatedAt: string;
};
export type AdminMediaAsset = {
  id: string;
  originalFileName: string;
  contentType: string;
  length: number;
  sha256: string;
  kind: string;
  altText?: string;
  url: string;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
};
export type AdminCmsPage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: string;
  seoTitle?: string;
  metaDescription?: string;
  publishedAt?: string;
};
export type PublicSiteConfig = {
  settings: Record<string, string>;
  sections: {
    id: string;
    sectionKey: string;
    title: string;
    contentJson?: string;
    displayOrder: number;
    enabled: boolean;
  }[];
  assets: {
    id: string;
    kind: string;
    title: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    mobileImageUrl?: string;
    buttonText?: string;
    destination?: string;
    priority: number;
    enabled: boolean;
    secondaryButtonText?: string;
    secondaryButtonUrl?: string;
    customLabel?: string;
    layoutVariant?: string;
    typingSpeedMs?: number;
    backgroundColor?: string;
    overlayOpacity?: number;
    textAlignment?: string;
    contentPosition?: string;
    backgroundPosition?: string;
    animationType?: string;
    slideDuration?: number;
    transitionDuration?: number;
    autoplayEnabled?: boolean;
    pauseOnHover?: boolean;
    showNavigationArrows?: boolean;
    showPaginationDots?: boolean;
    loopSlides?: boolean;
    randomizeSlides?: boolean;
    respectSchedule?: boolean;
  }[];
  faqs: {
    id: string;
    question: string;
    answer: string;
    category?: string;
    displayOrder: number;
    published: boolean;
  }[];
  paymentMethods: {
    code: string;
    displayName: string;
    instructions?: string;
    minimumOrder?: number;
    maximumOrder?: number;
    displayOrder: number;
    enabled: boolean;
    requiresServerVerification: boolean;
    qrCodeUrl?: string;
  }[];
  navigation?: {
    id: string;
    menuKey: string;
    label: string;
    url: string;
    parentId?: string;
    icon?: string;
    displayOrder: number;
    openInNewTab: boolean;
  }[];
  popups?: {
    id: string;
    kind: string;
    title: string;
    description?: string;
    imageUrl?: string;
    buttonText?: string;
    destination?: string;
    delaySeconds: number;
    frequency: string;
    audience: string;
    mobileEnabled: boolean;
    desktopEnabled: boolean;
  }[];
  seo?: {
    scope: string;
    path: string;
    title?: string;
    metaDescription?: string;
    keywords?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImageUrl?: string;
    canonicalUrl?: string;
    robots: string;
  };
  deliverySlots?: {
    id: string;
    label: string;
    startTime: string;
    endTime: string;
    branchId?: string;
    maxOrders?: number;
  }[];
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchWithNetworkHandling(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const requestPath = (() => {
    try { return new URL(url).pathname; } catch { return url; }
  })();
  const callerSignal = init.signal;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (caught) {
    if (callerSignal?.aborted) throw caught;
    if (timedOut) {
      throw new ApiError(
        "The request took too long. Please check your connection and try again.",
        408,
      );
    }
    if (
      caught instanceof TypeError ||
      (caught instanceof Error && caught.name === "NetworkError")
    ) {
      throw new ApiError(
        `${friendlyRequestName(requestPath)} could not be reached. Please check your connection and try again.`,
        0,
      );
    }
    throw caught;
  } finally {
    globalThis.clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function friendlyRequestName(path: string): string {
  const value = path.toLowerCase();
  if (value.includes("/auth/verify-pan")) return "PAN verification";
  if (value.includes("/auth/register")) return "Account registration";
  if (value.includes("/auth/")) return "Authentication";
  if (value.startsWith("/api/products") || value.startsWith("/api/catalog")) return "The product catalogue";
  if (value.startsWith("/api/cart")) return "Your cart";
  if (value.startsWith("/api/wishlist")) return "Your wishlist";
  if (value.startsWith("/api/orders")) return "Your order request";
  if (value.startsWith("/api/prescriptions")) return "Your prescription request";
  if (value.startsWith("/api/messaging")) return "Messaging";
  if (value.startsWith("/api/hrms")) return "The staff workspace";
  if (value.startsWith("/api/admin") || value.startsWith("/api/superadmin")) return "The management request";
  return "This request";
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  try {
    const result = await offlineRequest<T>(path, init, token, requestNetwork);
    if (typeof window !== "undefined" && !["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase())) window.dispatchEvent(new CustomEvent("anhh-form-saved", { detail: { path } }));
    return result;
  }
  catch (error) {
    if (error instanceof OfflineError) throw new ApiError(error.message, error.status);
    throw error;
  }
}

async function requestNetwork<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      title?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    } | null;
    const validationMessage = payload?.errors
      ? Object.values(payload.errors).flat().join(" ")
      : undefined;
    const genericServerTitles = new Set([
      "An unexpected error occurred.",
      "The request could not be completed.",
    ]);
    const serverMessage = payload?.message ??
      payload?.detail ??
      validationMessage ??
      (payload?.title && !genericServerTitles.has(payload.title) ? payload.title : undefined);
    const message = serverMessage ??
      (response.status >= 500
        ? `${friendlyRequestName(path)} could not be completed right now. Please try again.`
        : response.status === 401
          ? "Your session has expired. Please sign in again."
          : response.status === 403
            ? "You do not have permission to perform this action."
            : response.status === 404
              ? "The requested record could not be found."
              : "The request could not be completed.");
    throw new ApiError(message, response.status);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export async function requestApi<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  return request<T>(path, init, token);
}

function requestFormWithProgress<T>(
  path: string,
  body: FormData,
  token: string,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";
    xhr.timeout = 3 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      const payload = xhr.response as {
        message?: string;
        title?: string;
        detail?: string;
      } | null;
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(payload as T);
        return;
      }
      const message = payload?.message ?? payload?.detail ?? payload?.title ??
        (xhr.status === 401
          ? "Your session has expired. Please sign in again."
          : xhr.status === 403
            ? "You do not have permission to perform this action."
            : xhr.status === 413
              ? "The selected file is too large for the server. Choose a smaller file."
              : "The file could not be uploaded. Please try again.");
      reject(new ApiError(message, xhr.status));
    };
    xhr.onerror = () =>
      reject(new ApiError("The upload could not reach the server. Check your connection and try again.", 0));
    xhr.ontimeout = () =>
      reject(new ApiError("The upload took too long. Please try again.", 408));
    xhr.onabort = () => reject(new ApiError("The upload was cancelled.", 0));
    xhr.send(body);
  });
}

export function getAssistantConfig(): Promise<AssistantConfig> {
  return request<AssistantConfig>("/api/assistant/config");
}
export function sendAssistantMessage(message: string, sessionId?: string): Promise<AssistantChatResponse> {
  const token = typeof window === "undefined" ? undefined : window.localStorage.getItem("anhh-access-token") ?? undefined;
  return request<AssistantChatResponse>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message, sessionId }),
  }, token);
}

export function getMessagingContacts(token: string): Promise<MessagingContact[]> {
  return request<MessagingContact[]>("/api/messaging/contacts", {}, token);
}
export function getMessagingConversations(token: string): Promise<MessageConversation[]> {
  return request<MessageConversation[]>("/api/messaging/conversations", {}, token);
}
export function createMessagingConversation(input: { recipientId: string; recipientType: "customer" | "staff"; subject?: string; message?: string; orderId?: string }, token: string): Promise<MessageThread> {
  return requestApi<MessageThread>("/api/messaging/conversations", { method: "POST", body: JSON.stringify(input) }, token);
}
export function getMessagingThread(id: string, token: string): Promise<MessageThread> {
  return request<MessageThread>(`/api/messaging/conversations/${id}`, {}, token);
}
export function sendMessagingMessage(id: string, input: { body?: string; latitude?: number; longitude?: number; locationLabel?: string; locationSource?: string }, token: string): Promise<PlatformMessage> {
  return requestApi<PlatformMessage>(`/api/messaging/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function uploadMessagingAttachment(id: string, file: File, body: string, token: string): Promise<PlatformMessage> {
  const form = new FormData(); form.append("file", file); if (body.trim()) form.append("body", body.trim());
  return requestApi<PlatformMessage>(`/api/messaging/conversations/${id}/attachments`, { method: "POST", body: form }, token);
}
export function markMessagingConversationRead(id: string, token: string): Promise<void> {
  return requestApi<void>(`/api/messaging/conversations/${id}/read`, { method: "POST" }, token);
}
export async function downloadMessagingAttachment(id: string, token: string): Promise<Blob> {
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/messaging/attachments/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new ApiError("This attachment could not be opened.", response.status);
  return response.blob();
}
export function getMessagingRoleSettings(token: string): Promise<MessagingRoleSetting[]> {
  return request<MessagingRoleSetting[]>("/api/messaging/admin/role-settings", {}, token);
}
export function updateMessagingRoleSetting(role: string, isEnabled: boolean, token: string): Promise<MessagingRoleSetting> {
  return requestApi<MessagingRoleSetting>(`/api/messaging/admin/role-settings/${encodeURIComponent(role)}`, { method: "PUT", body: JSON.stringify({ isEnabled }) }, token);
}
export function getMessagingOversight(token: string): Promise<MessageConversation[]> {
  return request<MessageConversation[]>("/api/messaging/admin/conversations", {}, token);
}

export function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", { signal });
}

export function registerCustomer(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  accountType?: "PERSONAL" | "PHARMACY";
  username?: string;
  gender?: string;
  dateOfBirth?: string;
  province?: string;
  district?: string;
  municipality?: string;
  ward?: string;
  deliveryAddress?: string;
  panNumber?: string;
  panRegisteredName?: string;
  pharmacyName?: string;
  drugLicenseNumber?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  contactPersonName?: string;
  telephone?: string;
  landmark?: string;
  pharmacistRegistrationNumber?: string;
  preferredBranchId?: string;
  pharmacyCategory?: "RETAIL" | "WHOLESALE";
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyPan(panNumber: string): Promise<{
  status: string;
  registeredName?: string;
  message: string;
  source: string;
}> {
  return requestApi("/api/auth/verify-pan", {
    method: "POST",
    body: JSON.stringify({ panNumber }),
  });
}

export function loginCustomer(input: {
  emailOrPhone: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export type ForgotPasswordDemoResponse = {
  challengeId: string;
  message: string;
  demoCode?: string;
  expiresAt: string;
};
export function requestDemoPasswordReset(identifier: string, accountType: "CUSTOMER" | "STAFF"): Promise<ForgotPasswordDemoResponse> {
  return requestApi<ForgotPasswordDemoResponse>("/api/auth/forgot-password/demo", { method: "POST", body: JSON.stringify({ identifier, accountType }) });
}
export function resetDemoPassword(input: { challengeId: string; verificationCode: string; newPassword: string; confirmPassword: string }): Promise<{ message: string }> {
  return requestApi<{ message: string }>("/api/auth/reset-password/demo", { method: "POST", body: JSON.stringify(input) });
}
export function logoutSession(token: string): Promise<void> {
  return requestApi<void>("/api/auth/logout", { method: "POST" }, token);
}
export function getCustomerProfile(token: string): Promise<Customer> {
  return request<Customer>("/api/auth/me", {}, token);
}

export function loginStaff(input: {
  emailOrPhone: string;
  password: string;
}): Promise<StaffAuthResponse> {
  return request<StaffAuthResponse>("/api/auth/staff-login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function getStaffMe(token: string): Promise<Staff> {
  return request<Staff>("/api/auth/staff-me", {}, token);
}
export function getAttendanceToday(
  token: string,
): Promise<AttendanceRecord | null> {
  return request<AttendanceRecord | null>(
    "/api/hrms/attendance/today",
    {},
    token,
  );
}
export function getAttendanceDashboard(
  token: string,
): Promise<AttendanceDashboard> {
  return request<AttendanceDashboard>("/api/hrms/dashboard", {}, token);
}
export function getAttendanceHistory(
  token: string,
): Promise<AttendanceRecord[]> {
  return request<AttendanceRecord[]>("/api/hrms/attendance/history", {}, token);
}
export type AttendanceLocationInput = {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationTimestampUtc: string;
  locationSource: string;
};
export type WorkShift = {
  id: string;
  name: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  gracePeriodMinutes: number;
  minimumWorkingMinutes: number;
  lateThresholdMinutes: number;
  halfDayThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  weeklyOffDays: string;
  isActive: boolean;
};
export type AttendanceSettings = {
  lateCheckInGraceMinutes: number;
  earlyCheckInGraceMinutes: number;
  earlyCheckOutGraceMinutes: number;
  lateCheckOutGraceMinutes: number;
  defaultRadiusMeters: number;
  locationRequired: boolean;
  businessTimeZone: string;
};
export type AttendanceCorrection = {
  id: string;
  staffUserId: string;
  staffName: string;
  workDate: string;
  requestedCheckInUtc?: string;
  requestedCheckOutUtc?: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewComment?: string;
};
export type HrmsOverview = {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeaveToday: number;
  checkedInToday: number;
  checkedOutToday: number;
  overtimeMinutes: number;
  attendancePercentage: number;
};
export function checkIn(
  token: string,
  location?: AttendanceLocationInput,
): Promise<AttendanceRecord> {
  return requestApi<AttendanceRecord>(
    "/api/hrms/attendance/check-in",
    { method: "POST", body: JSON.stringify(location ?? null) },
    token,
  );
}
export function checkOut(
  token: string,
  location?: AttendanceLocationInput,
): Promise<AttendanceRecord> {
  return requestApi<AttendanceRecord>(
    "/api/hrms/attendance/check-out",
    { method: "POST", body: JSON.stringify(location ?? null) },
    token,
  );
}
export function getHrmsSettings(token: string): Promise<AttendanceSettings> {
  return request<AttendanceSettings>("/api/hrms/settings", {}, token);
}
export function saveHrmsSettings(
  token: string,
  input: Omit<AttendanceSettings, "businessTimeZone">,
): Promise<AttendanceSettings> {
  return requestApi<AttendanceSettings>(
    "/api/hrms/settings",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getHrmsShifts(token: string): Promise<WorkShift[]> {
  return request<WorkShift[]>("/api/hrms/shifts", {}, token);
}
export function createHrmsShift(
  token: string,
  input: Omit<WorkShift, "id">,
): Promise<WorkShift> {
  return requestApi<WorkShift>(
    "/api/hrms/shifts",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateHrmsShift(
  token: string,
  id: string,
  input: Omit<WorkShift, "id">,
): Promise<WorkShift> {
  return requestApi<WorkShift>(
    `/api/hrms/shifts/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAttendanceCorrections(
  token: string,
): Promise<AttendanceCorrection[]> {
  return request<AttendanceCorrection[]>(
    "/api/hrms/attendance/corrections",
    {},
    token,
  );
}
export function requestAttendanceCorrection(
  token: string,
  input: {
    workDate: string;
    requestedCheckInUtc?: string;
    requestedCheckOutUtc?: string;
    reason: string;
  },
): Promise<AttendanceCorrection> {
  return requestApi<AttendanceCorrection>(
    "/api/hrms/attendance/corrections",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function decideAttendanceCorrection(
  token: string,
  id: string,
  input: { status: string; comment?: string },
): Promise<AttendanceCorrection> {
  return requestApi<AttendanceCorrection>(
    `/api/hrms/attendance/corrections/${id}/decision`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getHrmsOverview(token: string): Promise<HrmsOverview> {
  return request<HrmsOverview>("/api/hrms/dashboard/overview", {}, token);
}
export function getTeamAttendance(
  token: string,
  date?: string,
): Promise<AttendanceRecord[]> {
  return request<AttendanceRecord[]>(
    `/api/hrms/attendance/team${date ? `?date=${encodeURIComponent(date)}` : ""}`,
    {},
    token,
  );
}
export function getAdminAttendance(
  token: string,
  filters: { from?: string; to?: string; staffUserId?: string } = {},
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.staffUserId) params.set("staffUserId", filters.staffUserId);
  const query = params.toString();
  return request<AttendanceRecord[]>(
    `/api/hrms/attendance/records${query ? `?${query}` : ""}`,
    {},
    token,
  );
}
export function createAdminAttendance(
  token: string,
  input: {
    staffUserId: string;
    workDate: string;
    checkInUtc?: string;
    checkOutUtc?: string;
    status: string;
    shiftId?: string;
  },
): Promise<AttendanceRecord> {
  return requestApi<AttendanceRecord>(
    "/api/hrms/attendance/records",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminAttendance(
  token: string,
  id: string,
  input: {
    staffUserId: string;
    workDate: string;
    checkInUtc?: string;
    checkOutUtc?: string;
    status: string;
    shiftId?: string;
  },
): Promise<AttendanceRecord> {
  return requestApi<AttendanceRecord>(
    `/api/hrms/attendance/records/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function deleteAdminAttendance(token: string, id: string): Promise<void> {
  return requestApi<void>(`/api/hrms/attendance/records/${id}`, { method: "DELETE" }, token);
}
export function getLeaveRequests(token: string): Promise<LeaveRequest[]> {
  return request<LeaveRequest[]>("/api/hrms/leave", {}, token);
}
export function createLeaveRequest(
  token: string,
  input: {
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    dayType?: string;
    supportingDocumentUrl?: string;
  },
): Promise<LeaveRequest> {
  return requestApi<LeaveRequest>(
    "/api/hrms/leave",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function createAdminLeaveRequest(
  token: string,
  input: {
    staffUserId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    dayType?: string;
    supportingDocumentUrl?: string;
  },
): Promise<LeaveRequest> {
  return requestApi<LeaveRequest>(
    "/api/hrms/leave/admin",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminLeaveRequest(
  token: string,
  id: string,
  input: {
    staffUserId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    dayType?: string;
    supportingDocumentUrl?: string;
  },
): Promise<LeaveRequest> {
  return requestApi<LeaveRequest>(
    `/api/hrms/leave/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function deleteAdminLeaveRequest(token: string, id: string): Promise<void> {
  return requestApi<void>(`/api/hrms/leave/${id}`, { method: "DELETE" }, token);
}
export function decideLeaveRequest(
  token: string,
  id: string,
  input: { status: "APPROVED" | "REJECTED"; comment?: string },
): Promise<LeaveRequest> {
  return requestApi<LeaveRequest>(
    `/api/hrms/leave/${id}/decision`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getLeaveAllocations(
  token: string,
  filters: { leaveYear?: number; staffUserId?: string } = {},
): Promise<LeaveAllocation[]> {
  const params = new URLSearchParams();
  if (filters.leaveYear) params.set("leaveYear", String(filters.leaveYear));
  if (filters.staffUserId) params.set("staffUserId", filters.staffUserId);
  const query = params.toString();
  return request<LeaveAllocation[]>(`/api/hrms/leave/allocations${query ? `?${query}` : ""}`, {}, token);
}
export function saveLeaveAllocation(
  token: string,
  input: {
    staffUserId: string;
    leaveType: string;
    leaveYear: number;
    allocatedDays: number;
    carryForwardDays: number;
    adjustmentDays: number;
    notes?: string;
  },
): Promise<LeaveAllocation> {
  return requestApi<LeaveAllocation>("/api/hrms/leave/allocations", { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getLeaveBalances(
  token: string,
  filters: { leaveYear?: number; staffUserId?: string } = {},
): Promise<LeaveBalance[]> {
  const params = new URLSearchParams();
  if (filters.leaveYear) params.set("leaveYear", String(filters.leaveYear));
  if (filters.staffUserId) params.set("staffUserId", filters.staffUserId);
  const query = params.toString();
  return request<LeaveBalance[]>(`/api/hrms/leave/balances${query ? `?${query}` : ""}`, {}, token);
}
export function getOvertimeRecords(
  token: string,
  filters: { from?: string; to?: string; staffUserId?: string } = {},
): Promise<OvertimeRecord[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.staffUserId) params.set("staffUserId", filters.staffUserId);
  const query = params.toString();
  return request<OvertimeRecord[]>(`/api/hrms/overtime${query ? `?${query}` : ""}`, {}, token);
}
export function createOvertimeRecord(
  token: string,
  input: { staffUserId: string; workDate: string; startTime: string; endTime: string; overtimeType: string; remarks?: string },
): Promise<OvertimeRecord> {
  return requestApi<OvertimeRecord>("/api/hrms/overtime", { method: "POST", body: JSON.stringify(input) }, token);
}
export function decideOvertimeRecord(
  token: string,
  id: string,
  input: { status: "APPROVED" | "REJECTED"; comment?: string },
): Promise<OvertimeRecord> {
  return requestApi<OvertimeRecord>(`/api/hrms/overtime/${id}/decision`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getEmploymentMovements(
  token: string,
  filters: { movementType?: string; staffUserId?: string } = {},
): Promise<EmploymentMovement[]> {
  const params = new URLSearchParams();
  if (filters.movementType) params.set("movementType", filters.movementType);
  if (filters.staffUserId) params.set("staffUserId", filters.staffUserId);
  const query = params.toString();
  return request<EmploymentMovement[]>(`/api/hrms/employment-movements${query ? `?${query}` : ""}`, {}, token);
}
export function createEmploymentMovement(
  token: string,
  input: { staffUserId: string; movementType: string; effectiveDate: string; newBranchId?: string; newShiftId?: string; newDepartment?: string; newJobTitle?: string; reason: string },
): Promise<EmploymentMovement> {
  return requestApi<EmploymentMovement>("/api/hrms/employment-movements", { method: "POST", body: JSON.stringify(input) }, token);
}
export function decideEmploymentMovement(
  token: string,
  id: string,
  input: { status: "APPROVED" | "REJECTED"; comment?: string },
): Promise<EmploymentMovement> {
  return requestApi<EmploymentMovement>(`/api/hrms/employment-movements/${id}/decision`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getAccountsSummary(
  token: string,
  month?: string,
): Promise<AccountsSummary> {
  return request<AccountsSummary>(
    `/api/hrms/accounts/summary${month ? `?month=${encodeURIComponent(month)}` : ""}`,
    {},
    token,
  );
}
export function getPayroll(
  token: string,
  month?: string,
): Promise<PayrollRecord[]> {
  return request<PayrollRecord[]>(
    `/api/hrms/payroll${month ? `?month=${encodeURIComponent(month)}` : ""}`,
    {},
    token,
  );
}
export function savePayroll(
  token: string,
  input: {
    staffUserId: string;
    payrollMonth: string;
    basicSalary: number;
    allowances: number;
    overtimeAmount: number;
    bonus: number;
    deductions: number;
    components?: Array<{
      componentName: string;
      componentKind: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
      amount: number;
    }>;
  },
): Promise<PayrollRecord> {
  return requestApi<PayrollRecord>(
    "/api/hrms/payroll",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getPayrollSuggestion(token: string, staffUserId: string, month?: string): Promise<PayrollSuggestion> {
  const params = new URLSearchParams({ staffUserId });
  if (month) params.set("month", month);
  return request<PayrollSuggestion>(`/api/hrms/payroll/suggestion?${params.toString()}`, {}, token);
}
export function decidePayroll(
  token: string,
  id: string,
  input: { status: "DRAFT" | "APPROVED" | "PAID"; paidAtUtc?: string; paymentMethod?: string; paymentReference?: string; paymentNotes?: string },
): Promise<PayrollRecord> {
  return requestApi<PayrollRecord>(`/api/hrms/payroll/${id}/decision`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getSalaryRevisions(token: string, staffUserId?: string): Promise<SalaryRevision[]> {
  return request<SalaryRevision[]>(`/api/hrms/salary-revisions${staffUserId ? `?staffUserId=${encodeURIComponent(staffUserId)}` : ""}`, {}, token);
}
export function createSalaryRevision(
  token: string,
  input: { staffUserId: string; title: string; revisionType: string; effectiveDate: string; revisedBasicSalary: number; reason?: string; attachmentUrl?: string },
): Promise<SalaryRevision> {
  return requestApi<SalaryRevision>("/api/hrms/salary-revisions", { method: "POST", body: JSON.stringify(input) }, token);
}
export function decideSalaryRevision(
  token: string,
  id: string,
  input: { status: "APPROVED" | "REJECTED"; comment?: string },
): Promise<SalaryRevision> {
  return requestApi<SalaryRevision>(`/api/hrms/salary-revisions/${id}/decision`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getHrmsSetupItems(token: string, category: string): Promise<HrmsSetupItem[]> {
  return request<HrmsSetupItem[]>(`/api/hrms/setup/${encodeURIComponent(category)}`, {}, token);
}
export function createHrmsSetupItem(token: string, category: string, input: { name: string; code?: string; description?: string; isActive: boolean }): Promise<HrmsSetupItem> {
  return requestApi<HrmsSetupItem>(`/api/hrms/setup/${encodeURIComponent(category)}`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function updateHrmsSetupItem(token: string, category: string, id: string, input: { name: string; code?: string; description?: string; isActive: boolean }): Promise<HrmsSetupItem> {
  return requestApi<HrmsSetupItem>(`/api/hrms/setup/${encodeURIComponent(category)}/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getOfficeOperationRecords(token: string, category: string): Promise<OfficeOperationRecord[]> {
  return request<OfficeOperationRecord[]>(`/api/hrms/office/${encodeURIComponent(category)}`, {}, token);
}
export function createOfficeOperationRecord(token: string, category: string, input: Omit<OfficeOperationRecord, "id" | "category" | "staffName" | "createdAt" | "updatedAt">): Promise<OfficeOperationRecord> {
  return requestApi<OfficeOperationRecord>(`/api/hrms/office/${encodeURIComponent(category)}`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function updateOfficeOperationRecord(token: string, category: string, id: string, input: Omit<OfficeOperationRecord, "id" | "category" | "staffName" | "createdAt" | "updatedAt">): Promise<OfficeOperationRecord> {
  return requestApi<OfficeOperationRecord>(`/api/hrms/office/${encodeURIComponent(category)}/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
const accountantQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(
    ([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)),
  );
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
};
export function getAccountantDashboard(
  token: string,
  from?: string,
  to?: string,
) {
  return request<AccountantDashboard>(
    `/api/accountant/dashboard${accountantQuery({ from, to })}`,
    {},
    token,
  );
}

const accountSetupPath = (superAdmin: boolean) => superAdmin ? "/api/superadmin/account-setup" : "/api/admin/account-setup";
export function getPartySectors(token: string, superAdmin = false) {
  return request<PartySectorRecord[]>(`${accountSetupPath(superAdmin)}/party-sectors`, {}, token);
}
export function savePartySector(token: string, input: { id?: string; name: string; code?: string; description?: string; isActive: boolean }, superAdmin = false) {
  return request<PartySectorRecord | void>(`${accountSetupPath(superAdmin)}/party-sectors${input.id ? `/${input.id}` : ""}`, { method: input.id ? "PUT" : "POST", body: JSON.stringify(input) }, token);
}
export function getAccountSetupParties(token: string, search?: string, superAdmin = false) {
  return request<AccountSetupParty[]>(`${accountSetupPath(superAdmin)}/parties${accountantQuery({ search })}`, {}, token);
}
export function assignPartySector(token: string, customerId: string, partySectorId: string | null, superAdmin = false) {
  return request<void>(`${accountSetupPath(superAdmin)}/parties/${customerId}/sector`, { method: "PUT", body: JSON.stringify({ partySectorId }) }, token);
}
export function getChartAccounts(token: string, includeInactive = false, superAdmin = false) {
  return request<ChartAccountRecord[]>(`${accountSetupPath(superAdmin)}/chart-of-accounts${accountantQuery({ includeInactive })}`, {}, token);
}
export function saveChartAccount(token: string, input: Omit<ChartAccountRecord, "id" | "parentName" | "openingDebit" | "openingCredit"> & { id?: string }, superAdmin = false) {
  return request<ChartAccountRecord | void>(`${accountSetupPath(superAdmin)}/chart-of-accounts${input.id ? `/${input.id}` : ""}`, { method: input.id ? "PUT" : "POST", body: JSON.stringify(input) }, token);
}
export function getAccountOpeningBalances(token: string, asOf?: string, superAdmin = false) {
  return request<AccountOpeningBalanceRecord[]>(`${accountSetupPath(superAdmin)}/opening-balances${accountantQuery({ asOf })}`, {}, token);
}
export function createAccountOpeningBalance(token: string, input: { accountId: string; branchId?: string; openingDate: string; debitAmount: number; creditAmount: number; reference: string; notes?: string }, superAdmin = false) {
  return request<AccountOpeningBalanceRecord>(`${accountSetupPath(superAdmin)}/opening-balances`, { method: "POST", body: JSON.stringify(input) }, token);
}

export type CommerceProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  brand?: string;
  genericName?: string;
  manufacturerId?: string;
  mrp?: number;
  salePrice: number;
  purchasePrice?: number | null;
  stock: number;
  discountPercent: number;
  bonusScheme?: string;
  taxRate: number;
  invoiceTaxRate?: number;
  batches?: { inventoryId: string; batchNumber: string; branchId: string; branch?: string; availableQuantity: number; reservedQuantity?: number; mrp: number; sellingPrice: number; expiryDate?: string }[];
  baseUnit?: string;
  purchaseUnit?: string;
  salesUnit?: string;
  purchaseUnitToBase?: number;
  salesUnitToBase?: number;
  units?: { name: string; multiplierToBase: number; isPurchaseUnit: boolean; isSalesUnit: boolean }[];
};

export type PharmacySalesTemplate = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  lines: { productId: string; product: string; quantity: number; unit?: string; discountPercent: number; bonusQuantity: number }[];
};
export type PharmacyPartyDiscount = { id: string; customerId: string; customerName: string; manufacturerId: string; manufacturerName: string; discountPercent: number; startsAt?: string; endsAt?: string; isActive: boolean };
export type PharmacySupplierDiscount = { id: string; supplierId: string; supplierName: string; manufacturerId: string; manufacturerName: string; discountPercent: number; startsAt?: string; endsAt?: string; isActive: boolean };
export type PharmacySalesBudget = { id: string; branchId?: string; branch: string; periodStart: string; periodEnd: string; targetAmount: number; actualAmount: number; variance: number; notes?: string };

const commercialSetupPath = (superAdmin = false) => `/api/${superAdmin ? "superadmin" : "admin"}/sales-purchase/setup`;
export function getPharmacySalesTemplates(token: string, superAdmin = false) { return request<PharmacySalesTemplate[]>(`${commercialSetupPath(superAdmin)}/sales-templates`, {}, token); }
export function savePharmacySalesTemplate(token: string, input: Omit<PharmacySalesTemplate, "id" | "lines"> & { id?: string; lines: Omit<PharmacySalesTemplate["lines"][number], "product">[] }, superAdmin = false) {
  const { id, ...body } = input;
  return requestApi<{ id: string }>(`${commercialSetupPath(superAdmin)}/sales-templates${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(body) }, token);
}
export function getPharmacyPartyDiscounts(token: string, superAdmin = false, customerId?: string) { return request<PharmacyPartyDiscount[]>(`${commercialSetupPath(superAdmin)}/party-discounts${accountantQuery({ customerId })}`, {}, token); }
export function savePharmacyPartyDiscount(token: string, input: Omit<PharmacyPartyDiscount, "id" | "customerName" | "manufacturerName"> & { id?: string }, superAdmin = false) {
  const { id, ...body } = input;
  return requestApi<{ id: string }>(`${commercialSetupPath(superAdmin)}/party-discounts${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(body) }, token);
}
export function getPharmacySupplierDiscounts(token: string, superAdmin = false, supplierId?: string) { return request<PharmacySupplierDiscount[]>(`${commercialSetupPath(superAdmin)}/supplier-discounts${accountantQuery({ supplierId })}`, {}, token); }
export function savePharmacySupplierDiscount(token: string, input: Omit<PharmacySupplierDiscount, "id" | "supplierName" | "manufacturerName"> & { id?: string }, superAdmin = false) {
  const { id, ...body } = input;
  return requestApi<{ id: string }>(`${commercialSetupPath(superAdmin)}/supplier-discounts${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(body) }, token);
}
export function getPharmacySalesBudgets(token: string, from?: string, to?: string, superAdmin = false) { return request<PharmacySalesBudget[]>(`${commercialSetupPath(superAdmin)}/budgets${accountantQuery({ from, to })}`, {}, token); }
export function savePharmacySalesBudget(token: string, input: { branchId?: string; periodStart: string; periodEnd: string; targetAmount: number; notes?: string }, superAdmin = false) { return requestApi<{ id: string }>(`${commercialSetupPath(superAdmin)}/budgets`, { method: "POST", body: JSON.stringify(input) }, token); }
export type CommerceSummary = {
  sales: number;
  salesCount: number;
  purchases: number;
  purchaseCount: number;
  receivables: number;
  payables: number;
  netCredit: number;
  stockValue?: number | null;
  lowStock: number;
  nearExpiry: number;
  profit: number;
  cashCollected?: number;
  creditIssued?: number;
  totalReturns?: number;
  netSales?: number;
};
export type CommerceSale = {
  id: string;
  number: string;
  customerId?: string;
  customer: string;
  customerPhone?: string;
  walkIn?: boolean;
  date: string;
  branchId?: string;
  branch?: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  invoiceNumber?: string;
  referenceCode?: string;
  accountType?: string;
  partySector?: string;
  panNumber?: string;
  province?: string;
  district?: string;
  municipality?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  salesPerson?: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  items: { productId: string; product: string; category?: string; manufacturer?: string; quantity: number; bonusQuantity?: number; unit?: string; unitPrice: number }[];
};
export type CommercePurchase = {
  id: string;
  number: string;
  supplierId?: string;
  supplier?: string;
  supplierInvoiceNumber?: string;
  notes?: string;
  branchId?: string;
  date: string;
  branch?: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number | null;
  items: { productId: string; product: string; quantity: number; unitCost: number | null; unit?: string; unitMultiplier?: number; batch?: string; expiry?: string }[];
};
export type CommerceSalesReturn = {
  id: string;
  number: string;
  orderId?: string;
  customer: string;
  branch?: string;
  date: string;
  status: string;
  returnType?: "STANDARD" | "EXPIRED" | string;
  amount: number;
  reason?: string;
  items: { productId: string; product?: string; quantity: number; unitPrice: number; batch: string }[];
};
export type UserCashSummaryRow = {
  userName: string; cashReceive: number; sales: number; receipt: number; card: number | null;
  opdCopy: number | null; drNote: number | null; cashIn: number | null; return: number;
  cashOld: number | null; crNote: number | null; purch: number | null; net: number; handOver: number;
};
export type DebtorChangeReport = {
  openingDebtor: number; closingDebtor: number; increase: number; total: number;
  rows: { date: string; openingDebtor: number; closingDebtor: number; increase: number }[];
};
export type SupplierChangeReport = {
  openingSupplier: number; closingSupplier: number; increase: number; total: number;
  rows: { date: string; openingSupplier: number; closingSupplier: number; increase: number }[];
};
export type CommercePurchaseReturn = {
  id: string;
  number: string;
  supplier?: string;
  branch?: string;
  date: string;
  status: string;
  amount: number | null;
  reason?: string;
  items: { productId: string; product?: string; quantity: number; unitCost: number | null; batch: string }[];
};
export type CommerceInventory = {
  id: string;
  productId: string;
  product?: string;
  sku?: string;
  category?: string;
  manufacturer?: string;
  storageLocation?: string;
  productActive?: boolean;
  batch: string;
  branch?: string;
  branchId: string;
  stock: number;
  reserved: number;
  available: number;
  bonusQuantity?: number;
  minimumStock?: number;
  reorderLevel?: number;
  maximumStock?: number;
  purchasePrice: number | null;
  salePrice: number;
  mrp?: number;
  expiry?: string;
  status: string;
  supplierId?: string;
  supplier?: string;
};
export type InventoryDepartmentRow = {
  id: string;
  productId: string;
  product: string;
  productCode: string;
  barcode?: string;
  genericName?: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  strength?: string;
  dosageForm?: string;
  batchNumber: string;
  branchId: string;
  branch?: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  purchasePrice?: number | null;
  sellingPrice: number;
  mrp: number;
  expiryDate?: string;
  manufacturingDate?: string;
  daysToExpiry?: number;
  status: string;
  minimumStock: number;
  reorderLevel: number;
  maximumStock: number;
  storageLocation?: string;
  rackId?: string | null;
  rackName?: string;
  rackGroup?: string;
  supplier?: string;
  purchaseReference?: string;
  baseUnit: string;
  salesUnit: string;
  batchStatus: string;
};
export type InventoryOverview = {
  summary: { activeMedicines: number; totalAvailableStock: number; stockValue?: number | null; lowStock: number; outOfStock: number; nearExpiry: number; expired: number; stockAdjustments: number; pendingTransfers: number; nonMoving: number };
  nearExpiryDays: number;
  page: number;
  pageSize: number;
  totalRows: number;
  rows: InventoryDepartmentRow[];
};
export type InventoryAlternative = {
  productId: string;
  name: string;
  brand?: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  baseUnit: string;
  available: number;
  nearestExpiry?: string;
  sellingPrice: number;
  batches: { batchNumber: string; available: number; expiryDate?: string; branchId: string; branch?: string }[];
};
export type InventoryProductMaster = {
  id: string;
  name: string;
  productCode: string;
  barcode?: string;
  genericName?: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  strength?: string;
  dosageForm?: string;
  baseUnit: string;
  purchaseUnit: string;
  salesUnit: string;
  purchaseUnitToBase: number;
  salesUnitToBase: number;
  purchaseRate?: number | null;
  saleRate: number;
  mrp: number;
  minimumStock: number;
  reorderLevel: number;
  maximumStock: number;
  storageLocation?: string;
  rackId?: string | null;
  rackName?: string;
  rackGroup?: string;
  prescriptionRequired: boolean;
  isActive: boolean;
  notes?: string;
  searchKeywords?: string;
  stock: number;
  units: { name: string; multiplierToBase: number; isPurchaseUnit: boolean; isSalesUnit: boolean }[];
};
export type InventoryMovement = {
  id: string;
  date: string;
  productId: string;
  product: string;
  batch: string;
  branchId: string;
  branch: string;
  type: string;
  quantityBefore: number;
  quantity: number;
  quantityAfter: number;
  unit: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  reason?: string;
  actorId?: string;
  batchStatusBefore?: string;
  batchStatusAfter?: string;
  isCancelled?: boolean;
};
export type CommerceProductHistoryRow = {
  id: string;
  date: string;
  invoiceNumber: string;
  batch: string;
  expiryDate?: string;
  quantity: number;
  free: number;
  rate: number;
  mrp: number;
  discountPercent: number;
  type: "Sales" | "Return" | string;
};
export type InventorySuggestion = { productId: string; product?: string; sku?: string; branchId: string; branch?: string; available: number; pendingPurchaseQuantity: number; minimumStock: number; reorderLevel: number; maximumStock: number; suggestedOrderQuantity: number; supplier?: string; supplierId?: string; purchaseUnit?: string; purchaseUnitToBase?: number; purchaseUnitCost?: number };
export type InventoryVelocity = { productId: string; product: string; quantitySold: number; currentStock: number; stockValue?: number | null; lastSaleDate?: string; daysSinceLastSale?: number; classification: string };
export type InventoryStockCount = { id: string; countNumber: string; branchId: string; branch?: string; status: string; createdAt: string; finalizedAt?: string; lineCount: number; variance: number; varianceValue?: number | null };
export type InventoryTransfer = { id: string; transferNumber: string; sourceBranchId: string; sourceBranch?: string; targetBranchId: string; targetBranch?: string; status: string; note?: string; createdAt: string; dispatchedAt?: string; receivedAt?: string; items: { id: string; productId: string; product?: string; batchNumber: string; quantity: number; receivedQuantity: number }[] };
export type CommerceCreditLedger = {
  customers: { id: string; name: string; email: string; limit: number; balance: number; aging0To30: number; aging31To60: number; aging60Plus: number }[];
  suppliers: { id: string; name: string; balance: number; invoices: number; aging0To30?: number; aging31To60?: number; aging60Plus?: number }[];
  totalReceivable: number;
  totalPayable: number;
  supplierCredit?: number;
};
export type CashHandoverStaff = { id: string; fullName: string; role: string; branchId?: string };
export type CashHandoverRecord = { id: string; handoverNumber: string; branchId: string; branch?: string; handedByStaffUserId: string; handedBy: string; receivedByStaffUserId: string; receivedBy: string; handoverAt: string; amount: number; reference: string; notes?: string; status: string };
const commercePath = (superAdmin = false) => `/api/${superAdmin ? "superadmin" : "admin"}/sales-purchase`;
export function getCommerceSummary(token: string, params: { from?: string; to?: string; branchId?: string } = {}, superAdmin = false) {
  return request<CommerceSummary>(`${commercePath(superAdmin)}/summary${accountantQuery(params)}`, {}, token);
}
export function getCommerceProducts(token: string, search?: string, branchId?: string, superAdmin = false) {
  return request<CommerceProduct[]>(`${commercePath(superAdmin)}/products${accountantQuery({ search, branchId })}`, {}, token);
}
export function getCommerceProductHistory(token: string, productId: string, branchId?: string, superAdmin = false) {
  return request<CommerceProductHistoryRow[]>(`${commercePath(superAdmin)}/products/${encodeURIComponent(productId)}/history${accountantQuery({ branchId })}`, {}, token);
}
export function getCommerceCustomers(token: string, search?: string, superAdmin = false) {
  return request<{ id: string; name: string; email: string; phone: string; accountType: string; address?: string; panNumber?: string; telephone?: string }[]>(`${commercePath(superAdmin)}/customers${accountantQuery({ search })}`, {}, token);
}
export function getCommerceSuppliers(token: string, search?: string, superAdmin = false) {
  return request<{ id: string; name: string; phone?: string; email?: string }[]>(`${commercePath(superAdmin)}/suppliers${accountantQuery({ search })}`, {}, token);
}
export function getCommerceSales(token: string, params: { from?: string; to?: string; branchId?: string; paymentStatus?: string; paymentMethod?: string; customerId?: string; productId?: string; search?: string } = {}, superAdmin = false) {
  return request<CommerceSale[]>(`${commercePath(superAdmin)}/sales${accountantQuery(params)}`, {}, token);
}
export function getCommerceSaleByInvoice(token: string, invoiceNumber: string, superAdmin = false) {
  return request<CommerceSale>(`${commercePath(superAdmin)}/sales/invoice?invoiceNumber=${encodeURIComponent(invoiceNumber)}`, {}, token);
}
export function getSalesUserCashSummary(token: string, params: { from?: string; to?: string; branchId?: string; includeCard?: boolean } = {}, superAdmin = false) {
  return request<UserCashSummaryRow[]>(`${commercePath(superAdmin)}/sales-reports/user-cash-summary${accountantQuery(params)}`, {}, token);
}
export function getSalesChangeInDebtors(token: string, params: { from?: string; to?: string; branchId?: string } = {}, superAdmin = false) {
  return request<DebtorChangeReport>(`${commercePath(superAdmin)}/sales-reports/change-in-debtors${accountantQuery(params)}`, {}, token);
}
export function getPurchaseChangeInSupplier(token: string, params: { from?: string; to?: string; branchId?: string } = {}, superAdmin = false) {
  return request<SupplierChangeReport>(`${commercePath(superAdmin)}/purchases/change-in-supplier${accountantQuery(params)}`, {}, token);
}
export function getCommercePurchases(token: string, params: { from?: string; to?: string; branchId?: string; supplierId?: string; productId?: string; paymentMethod?: string; paymentStatus?: string; search?: string } = {}, superAdmin = false) {
  return request<CommercePurchase[]>(`${commercePath(superAdmin)}/purchases${accountantQuery(params)}`, {}, token);
}
export function updateCommercePurchaseAdditionalInfo(token: string, id: string, input: { supplierInvoiceNumber?: string; notes?: string }, superAdmin = false) {
  return requestApi<{ purchaseId: string; supplierInvoiceNumber: string; notes?: string }>(`${commercePath(superAdmin)}/purchases/${id}/additional-info`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getCommerceSalesReturns(token: string, params: { from?: string; to?: string; branchId?: string; customerId?: string; search?: string } = {}, superAdmin = false) {
  return request<CommerceSalesReturn[]>(`${commercePath(superAdmin)}/sales-returns${accountantQuery(params)}`, {}, token);
}
export function getCommerceSalesReturnByNumber(token: string, number: string, superAdmin = false) {
  return request<CommerceSalesReturn>(`${commercePath(superAdmin)}/sales-returns/lookup?number=${encodeURIComponent(number)}`, {}, token);
}
export function getCommercePurchaseReturns(token: string, params: { from?: string; to?: string; branchId?: string; supplierId?: string; search?: string } = {}, superAdmin = false) {
  return request<CommercePurchaseReturn[]>(`${commercePath(superAdmin)}/purchase-returns${accountantQuery(params)}`, {}, token);
}
export function cancelCommerceSalesReturn(token: string, id: string, reason: string, superAdmin = false) {
  return requestApi<{ returnNumber: string; status: string }>(`${commercePath(superAdmin)}/sales-returns/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}
export function cancelCommercePurchaseReturn(token: string, id: string, reason: string, superAdmin = false) {
  return requestApi<{ returnNumber: string; status: string }>(`${commercePath(superAdmin)}/purchase-returns/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}
export function getCommerceInventory(token: string, branchId?: string, filter?: string, superAdmin = false) {
  return request<CommerceInventory[]>(`${commercePath(superAdmin)}/inventory${accountantQuery({ branchId, filter })}`, {}, token);
}
export function getInventoryOverview(token: string, params: { branchId?: string; filter?: string; search?: string; nearExpiryDays?: number; page?: number; pageSize?: number } = {}, superAdmin = false) {
  return request<InventoryOverview>(`${commercePath(superAdmin)}/inventory/overview${accountantQuery(params)}`, {}, token);
}
export function getInventoryAlternatives(token: string, productId: string, branchId?: string, superAdmin = false) {
  return request<{ sourceProductId: string; matchCriteriaAvailable: boolean; alternatives: InventoryAlternative[] }>(`${commercePath(superAdmin)}/inventory/products/${productId}/alternatives${accountantQuery({ branchId })}`, {}, token);
}
export function updateInventoryNearExpiryDays(token: string, days: number, superAdmin = false) {
  return requestApi<{ nearExpiryDays: number }>(`${commercePath(superAdmin)}/inventory/near-expiry-days`, { method: "PUT", body: JSON.stringify({ days }) }, token);
}
export function getInventoryProductMaster(token: string, search?: string, superAdmin = false, branchId?: string) {
  return request<InventoryProductMaster[]>(`${commercePath(superAdmin)}/inventory/product-master${accountantQuery({ search, branchId })}`, {}, token);
}
export type ProductRackGroup = { id: string; name: string; code?: string; isActive: boolean; rackCount: number };
export type ProductRack = { id: string; rackGroupId: string; rackGroup: string; name: string; code?: string; isActive: boolean; productCount: number };
export function getProductRackGroups(token: string, superAdmin = false) {
  return request<ProductRackGroup[]>(`${commercePath(superAdmin)}/setup/rack-groups`, {}, token);
}
export function saveProductRackGroup(token: string, input: { id?: string; name: string; code?: string; isActive: boolean }, superAdmin = false) {
  return requestApi<{ id: string }>(`${commercePath(superAdmin)}/setup/rack-groups${input.id ? `/${input.id}` : ""}`, { method: input.id ? "PUT" : "POST", body: JSON.stringify(input) }, token);
}
export function getProductRacks(token: string, groupId?: string, superAdmin = false) {
  return request<ProductRack[]>(`${commercePath(superAdmin)}/setup/racks${accountantQuery({ groupId })}`, {}, token);
}
export function saveProductRack(token: string, input: { id?: string; rackGroupId: string; name: string; code?: string; isActive: boolean }, superAdmin = false) {
  return requestApi<{ id: string }>(`${commercePath(superAdmin)}/setup/racks${input.id ? `/${input.id}` : ""}`, { method: input.id ? "PUT" : "POST", body: JSON.stringify(input) }, token);
}
export function updateInventoryProductMaster(token: string, id: string, input: { baseUnit: string; purchaseUnit: string; salesUnit: string; purchaseUnitToBase: number; salesUnitToBase: number; reorderLevel: number; maximumStock: number; storageLocation?: string; rackId?: string | null; notes?: string; searchKeywords?: string; isActive?: boolean; genericName?: string; strength?: string; dosageForm?: string; prescriptionRequired?: boolean; units?: { name: string; multiplierToBase: number; isPurchaseUnit: boolean; isSalesUnit: boolean; displayOrder?: number }[] }, superAdmin = false) {
  return requestApi<{ id: string; message: string }>(`${commercePath(superAdmin)}/inventory/product-master/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getInventoryMovements(token: string, params: { branchId?: string; productId?: string; inventoryId?: string; batchNumber?: string; type?: string; from?: string; to?: string } = {}, superAdmin = false) {
  return request<InventoryMovement[]>(`${commercePath(superAdmin)}/inventory/movements${accountantQuery(params)}`, {}, token);
}
export function cancelInventoryAdjustment(token: string, id: string, reason: string, superAdmin = false) {
  return requestApi<{ id: string; status: string; quantity: number; batchStatus: string }>(`${commercePath(superAdmin)}/inventory/movements/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}
export function getInventorySuggestions(token: string, branchId?: string, superAdmin = false) {
  return request<InventorySuggestion[]>(`${commercePath(superAdmin)}/inventory/suggestions${accountantQuery({ branchId })}`, {}, token);
}
export function getInventoryVelocity(token: string, branchId?: string, days = 90, classification?: string, superAdmin = false) {
  return request<{ days: number; rows: InventoryVelocity[] }>(`${commercePath(superAdmin)}/inventory/velocity${accountantQuery({ branchId, days, classification })}`, {}, token);
}
export function getInventoryStockCounts(token: string, branchId?: string, superAdmin = false) {
  return request<InventoryStockCount[]>(`${commercePath(superAdmin)}/inventory/counts${accountantQuery({ branchId })}`, {}, token);
}
export function getInventoryTransfers(token: string, branchId?: string, superAdmin = false) {
  return request<InventoryTransfer[]>(`${commercePath(superAdmin)}/inventory/transfers${accountantQuery({ branchId })}`, {}, token);
}
export function adjustInventoryDepartment(token: string, input: { inventoryId: string; quantityDelta: number; reason: string; type?: string; unit?: string; batchStatus?: string }, superAdmin = false) {
  return requestApi<InventoryDepartmentRow>(`${commercePath(superAdmin)}/inventory/adjust`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createInventoryOpeningStock(token: string, input: { productId: string; branchId: string; quantity: number; batchNumber: string; purchasePrice: number; manufacturingDate?: string; expiryDate?: string; reason: string; reference?: string; supplierName?: string }, superAdmin = false) {
  return requestApi<InventoryDepartmentRow>(`${commercePath(superAdmin)}/inventory/opening-stock`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createInventoryStockCount(token: string, input: { branchId: string; scope?: string; category?: string; location?: string; search?: string; notes?: string }, superAdmin = false) {
  return requestApi<{ id: string; countNumber: string; branchId: string; status: string; lines: { id: string; inventoryId: string; product: string; batchNumber: string; storageLocation?: string; baseUnit: string; unitCost?: number | null; systemQuantity: number; physicalQuantity?: number; variance: number; varianceValue?: number | null }[] }>(`${commercePath(superAdmin)}/inventory/counts`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function cancelInventoryStockCount(token: string, id: string, superAdmin = false) {
  return requestApi<{ id: string; status: string }>(`${commercePath(superAdmin)}/inventory/counts/${id}/cancel`, { method: "POST" }, token);
}
export function updateInventoryStockCountLines(token: string, id: string, lines: { lineId: string; physicalQuantity: number; reason?: string }[], superAdmin = false) {
  return requestApi<{ id: string; status: string; updated: number }>(`${commercePath(superAdmin)}/inventory/counts/${id}/lines`, { method: "PUT", body: JSON.stringify({ lines }) }, token);
}
export function finalizeInventoryStockCount(token: string, id: string, reason?: string, superAdmin = false) {
  return requestApi<{ id: string; status: string; finalizedAt: string; totalVariance: number; varianceValue?: number | null }>(`${commercePath(superAdmin)}/inventory/counts/${id}/finalize`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}
export function createInventoryTransfer(token: string, input: { sourceBranchId: string; targetBranchId: string; items: { inventoryId: string; quantity: number }[]; note?: string }, superAdmin = false) {
  return requestApi<{ id: string; transferNumber: string; status: string; itemCount: number }>(`${commercePath(superAdmin)}/inventory/transfers`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function dispatchInventoryTransfer(token: string, id: string, superAdmin = false) {
  return requestApi<{ id: string; status: string; dispatchedAt: string }>(`${commercePath(superAdmin)}/inventory/transfers/${id}/dispatch`, { method: "POST" }, token);
}
export function receiveInventoryTransfer(token: string, id: string, superAdmin = false) {
  return requestApi<{ id: string; status: string; receivedAt: string }>(`${commercePath(superAdmin)}/inventory/transfers/${id}/receive`, { method: "POST" }, token);
}
export function cancelInventoryTransfer(token: string, id: string, superAdmin = false) {
  return requestApi<{ id: string; status: string }>(`${commercePath(superAdmin)}/inventory/transfers/${id}/cancel`, { method: "POST" }, token);
}
export function getCommerceCreditLedger(token: string, superAdmin = false, branchId?: string) {
  return request<CommerceCreditLedger>(`${commercePath(superAdmin)}/credit-ledger${accountantQuery({ branchId })}`, {}, token);
}
export function getCashHandoverStaff(token: string, branchId?: string, superAdmin = false) {
  return request<CashHandoverStaff[]>(`${commercePath(superAdmin)}/cash-handovers/staff${accountantQuery({ branchId })}`, {}, token);
}
export function getCashHandovers(token: string, params: { from?: string; to?: string; branchId?: string } = {}, superAdmin = false) {
  return request<CashHandoverRecord[]>(`${commercePath(superAdmin)}/cash-handovers${accountantQuery(params)}`, {}, token);
}
export function createCashHandover(token: string, input: { branchId: string; receivedByStaffUserId: string; handedByStaffUserId?: string; amount: number; reference: string; notes?: string }, superAdmin = false) {
  return requestApi<CashHandoverRecord>(`${commercePath(superAdmin)}/cash-handovers`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createCommerceSale(token: string, input: { customerId?: string; walkInName?: string; walkInPhone?: string; branchId?: string; paymentMode: string; paidAmount?: number; referenceCode?: string; insuranceProvider?: string; insurancePolicyNumber?: string; items: { productId: string; quantity: number; discountPercent?: number; bonusQuantity?: number; unit?: string; inventoryId?: string }[] }, superAdmin = false) {
  return requestApi<{ orderId: string; invoiceId: string; invoiceNumber: string; total: number; paid: number; balance: number; paymentStatus: string }>(`${commercePath(superAdmin)}/pos-sales`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function updateCommerceSale(token: string, id: string, input: { sale: { customerId?: string; walkInName?: string; walkInPhone?: string; branchId?: string; paymentMode: string; paidAmount?: number; referenceCode?: string; insuranceProvider?: string; insurancePolicyNumber?: string; items: { productId: string; quantity: number; discountPercent?: number; bonusQuantity?: number; unit?: string; inventoryId?: string }[] }; reason: string }, superAdmin = false) {
  return requestApi<{ orderId: string; invoiceId: string; invoiceNumber: string; total: number; paid: number; balance: number; paymentStatus: string }>(`${commercePath(superAdmin)}/sales/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function createCommercePurchase(token: string, input: { supplierId: string; branchId: string; paymentMode: string; paidAmount?: number; supplierInvoiceNumber?: string; notes?: string; items: { productId: string; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string; unit?: string }[] }, superAdmin = false) {
  return requestApi<{ purchaseId: string; invoiceId: string; invoiceNumber: string; total: number; paid: number; balance: number }>(`${commercePath(superAdmin)}/purchase-receipts`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createCommerceCustomerPayment(token: string, input: { customerId: string; amount: number; method: string; paymentDate?: string; branchId?: string; reference?: string; notes?: string }, superAdmin = false) {
  return requestApi<{ paymentNumber: string; applied: number; unapplied: number }>(`${commercePath(superAdmin)}/customer-payments`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createCommerceSupplierPayment(token: string, input: { supplierId: string; amount: number; method: string; paymentDate?: string; branchId?: string; reference?: string; notes?: string }, superAdmin = false) {
  return requestApi<{ paymentNumber: string; applied: number; unapplied: number }>(`${commercePath(superAdmin)}/supplier-payments`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createCommerceSalesReturn(token: string, input: { orderId: string; productId: string; quantity: number; reason?: string; refundMethod?: "CASH" | "CREDIT"; expiredReturn?: boolean }, superAdmin = false) {
  return requestApi<{ returnNumber: string; amount: number; status: string }>(`${commercePath(superAdmin)}/sales-returns`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createCommercePurchaseReturn(token: string, input: { inventoryId: string; supplierId: string; branchId: string; quantity: number; reason?: string }, superAdmin = false) {
  return requestApi<{ returnNumber: string; amount: number; status: string }>(`${commercePath(superAdmin)}/purchase-returns`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function voidCommerceSale(token: string, id: string, reason: string, superAdmin = false) {
  return requestApi<{ orderId: string; status: string; restoredStock: number }>(`${commercePath(superAdmin)}/sales/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}
export function voidCommercePurchase(token: string, id: string, reason: string, superAdmin = false) {
  return requestApi<{ purchaseId: string; status: string; restoredStock: number }>(`${commercePath(superAdmin)}/purchases/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}
export function getAccountantCustomers(token: string) {
  return request<AccountantCustomer[]>("/api/accountant/customers", {}, token);
}
export function getAccountantInvoices(
  token: string,
  params: {
    from?: string;
    to?: string;
    customerId?: string;
    status?: string;
  } = {},
) {
  return request<AccountantInvoice[]>(
    `/api/accountant/invoices${accountantQuery(params)}`,
    {},
    token,
  );
}
export function getAccountantPayments(
  token: string,
  from?: string,
  to?: string,
) {
  return request<AccountantPayment[]>(
    `/api/accountant/payments${accountantQuery({ from, to })}`,
    {},
    token,
  );
}
export function recordAccountantPayment(
  token: string,
  input: {
    invoiceId?: string;
    supplierInvoiceId?: string;
    method: string;
    amount: number;
    paymentDate: string;
    reference?: string;
    notes?: string;
  },
) {
  return request<AccountantPayment>(
    "/api/accountant/payments",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getAccountantLedger(token: string) {
  return request<AccountantLedger[]>("/api/accountant/ledger", {}, token);
}
export function getAccountantSuppliers(token: string) {
  return request<{ id: string; name: string }[]>(
    "/api/accountant/suppliers",
    {},
    token,
  );
}
export function getSupplierInvoices(token: string) {
  return request<SupplierInvoice[]>(
    "/api/accountant/supplier-invoices",
    {},
    token,
  );
}
export function createSupplierInvoice(
  token: string,
  input: {
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueAt?: string;
    subtotal: number;
    taxAmount: number;
    notes?: string;
  },
) {
  return request<SupplierInvoice>(
    "/api/accountant/supplier-invoices",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getAccountantExpenses(
  token: string,
  from?: string,
  to?: string,
) {
  return request<AccountantExpense[]>(
    `/api/accountant/expenses${accountantQuery({ from, to })}`,
    {},
    token,
  );
}
export function createAccountantExpense(
  token: string,
  input: {
    category: string;
    description: string;
    amount: number;
    expenseDate: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
  },
) {
  return request<AccountantExpense>(
    "/api/accountant/expenses",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getReconciliations(token: string) {
  return request<Reconciliation[]>("/api/accountant/reconciliation", {}, token);
}
export function addReconciliation(
  token: string,
  input: {
    statementDate: string;
    bankAccount: string;
    transactionType: string;
    amount: number;
    reference: string;
    notes?: string;
  },
) {
  return request<Reconciliation>(
    "/api/accountant/reconciliation",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function matchReconciliation(token: string, id: string) {
  return request<void>(
    `/api/accountant/reconciliation/${id}/match`,
    { method: "PUT" },
    token,
  );
}
export function getTaxSettings(token: string) {
  return request<TaxSettings>("/api/accountant/tax-settings", {}, token);
}
export function saveTaxSettings(
  token: string,
  input: { name: string; vatRate: number; effectiveFrom: string },
) {
  return request<TaxSettings>(
    "/api/accountant/tax-settings",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getJournalEntries(token: string, from?: string, to?: string) {
  return request<JournalEntry[]>(
    `/api/accountant/journal${accountantQuery({ from, to })}`,
    {},
    token,
  );
}
export function createJournalEntry(
  token: string,
  input: {
    entryDate: string;
    reference: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    notes?: string;
  },
) {
  return request<JournalEntry>(
    "/api/accountant/journal",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getAccountingSummary(
  token: string,
  from?: string,
  to?: string,
) {
  return request<AccountingSummary>(
    `/api/accountant/accounting-summary${accountantQuery({ from, to })}`,
    {},
    token,
  );
}
export function accountantReportUrl(type: string, from: string, to: string) {
  return `${API_BASE_URL}/api/accountant/reports/${type}${accountantQuery({ from, to })}`;
}
export async function downloadAccountantReport(
  token: string,
  type: string,
  from: string,
  to: string,
) {
  const response = await fetchWithNetworkHandling(
    accountantReportUrl(type, from, to),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new ApiError("The report could not be generated.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${type}-${from}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function getStaffProfile(
  token: string,
  panel: "pharmacist" | "delivery" | "supervisor" = "pharmacist",
): Promise<Staff> {
  return request<Staff>(`/api/${panel}/profile`, {}, token);
}
export function updateStaffProfile(
  token: string,
  panel: "pharmacist" | "delivery" | "supervisor",
  input: {
    fullName: string;
    phone: string;
    licenseReference?: string;
    employeeId?: string;
    address?: string;
    joiningDate?: string;
  },
): Promise<Staff> {
  return requestApi<Staff>(
    `/api/${panel}/profile`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function uploadStaffProfilePhoto(
  token: string,
  file: File,
): Promise<{ url: string; contentType: string; fileName: string }> {
  const body = new FormData();
  body.append("file", file);
  return requestApi<{ url: string; contentType: string; fileName: string }>(
    "/api/staff-profile/photo",
    { method: "POST", body },
    token,
  );
}
export function changeStaffPassword(
  token: string,
  panel: "pharmacist" | "delivery" | "supervisor",
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
): Promise<void> {
  return requestApi<void>(
    `/api/${panel}/profile/password`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getStaffDashboard(
  token: string,
  panel: "pharmacist" | "delivery",
): Promise<DashboardStats> {
  return request<DashboardStats>(`/api/${panel}/dashboard`, {}, token);
}
export function getStaffPrescriptions(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<Paged<StaffPrescriptionListItem>> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  return request<Paged<StaffPrescriptionListItem>>(
    `/api/pharmacist/prescriptions?${query}`,
    {},
    token,
  );
}
export function getStaffPrescription(
  id: string,
  token: string,
): Promise<StaffPrescription> {
  return request<StaffPrescription>(
    `/api/pharmacist/prescriptions/${id}`,
    {},
    token,
  );
}
export function startPrescriptionReview(
  id: string,
  token: string,
): Promise<StaffPrescription> {
  return requestApi<StaffPrescription>(
    `/api/pharmacist/prescriptions/${id}/start-review`,
    { method: "POST" },
    token,
  );
}
export async function getStaffPrescriptionFile(
  id: string,
  token: string,
): Promise<string> {
  const response = await fetchWithNetworkHandling(
    `${API_BASE_URL}/api/pharmacist/prescriptions/${id}/file`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok)
    throw new ApiError(
      "The prescription file could not be loaded.",
      response.status,
    );
  return URL.createObjectURL(await response.blob());
}
export function reviewPrescriptionItem(
  id: string,
  itemId: string,
  input: {
    productId?: string;
    quantity?: number;
    availability: string;
    note?: string;
  },
  token: string,
): Promise<StaffPrescription> {
  return requestApi<StaffPrescription>(
    `/api/pharmacist/prescriptions/${id}/items/${itemId}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function decidePrescription(
  id: string,
  action: "approve" | "partial-approve" | "reject" | "clarification",
  input: unknown,
  token: string,
): Promise<StaffPrescription> {
  return requestApi<StaffPrescription>(
    `/api/pharmacist/prescriptions/${id}/${action}`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getStaffOrders(
  token: string,
  panel: "pharmacist" | "delivery",
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<Paged<StaffOrderListItem>> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  return request<Paged<StaffOrderListItem>>(
    `/api/${panel}/orders?${query}`,
    {},
    token,
  );
}
export function getSalesExecutiveDashboard(token: string, from?: string, to?: string): Promise<SalesExecutiveDashboard> {
  const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to);
  return request<SalesExecutiveDashboard>(`/api/sales-executive/dashboard?${query}`, {}, token);
}
export function getSalesExecutiveOrders(token: string, params: Record<string, string | number | undefined> = {}): Promise<SalesExecutiveOrdersResponse> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request<SalesExecutiveOrdersResponse>(`/api/sales-executive/orders?${query}`, {}, token);
}
export function updateSalesExecutiveOrderStatus(id: string, input: { status: string; note?: string }, token: string): Promise<SalesExecutiveOrder> {
  return requestApi<SalesExecutiveOrder>(`/api/sales-executive/orders/${id}/status`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getStaffOrder(
  id: string,
  token: string,
  panel: "pharmacist" | "delivery",
): Promise<StaffOrder> {
  return request<StaffOrder>(`/api/${panel}/orders/${id}`, {}, token);
}
export function updateRiderDeliveryLocation(
  id: string,
  input: { latitude: number; longitude: number; accuracy?: number },
  token: string,
): Promise<DeliveryLocationSnapshot> {
  return requestApi<DeliveryLocationSnapshot>(
    `/api/delivery/orders/${id}/location`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getDeliveryOrderRequirements(id: string, token: string): Promise<DeliveryOrderRequirements> {
  return request<DeliveryOrderRequirements>(`/api/delivery/orders/${id}/requirements`, {}, token);
}
export function getRiderOrderCustomers(search: string, token: string): Promise<Paged<RiderOrderCustomer>> {
  return request(`/api/delivery/customers?search=${encodeURIComponent(search)}&pageSize=25`, {}, token);
}
export function getRiderOrderProducts(search: string, token: string): Promise<RiderOrderProduct[]> {
  return request(`/api/delivery/products?search=${encodeURIComponent(search)}`, {}, token);
}
export function getRiderOrderSettings(token: string): Promise<RiderOrderSettings> {
  return request("/api/delivery/order-settings", {}, token);
}
export function previewRiderOrder(input: RiderOrderInput, token: string): Promise<RiderOrderPreview> {
  return requestApi("/api/delivery/orders/preview", { method: "POST", body: JSON.stringify(input) }, token);
}
export function createRiderOrder(input: RiderOrderInput, token: string): Promise<{ id: string; orderNumber: string; status: string; deliveryStatus: string; total: number }> {
  return requestApi("/api/delivery/orders", { method: "POST", body: JSON.stringify(input) }, token);
}
export function updatePharmacistOrder(
  id: string,
  input: { status: string; note?: string },
  token: string,
): Promise<StaffOrder> {
  return requestApi<StaffOrder>(
    `/api/pharmacist/orders/${id}/status`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getDeliveryStaff(token: string): Promise<Staff[]> {
  return request<Staff[]>("/api/pharmacist/delivery-staff", {}, token);
}
export function assignDelivery(
  id: string,
  deliveryStaffId: string,
  notes: string,
  token: string,
): Promise<StaffOrder> {
  return requestApi<StaffOrder>(
    `/api/pharmacist/orders/${id}/assign-delivery`,
    { method: "POST", body: JSON.stringify({ deliveryStaffId, notes }) },
    token,
  );
}
export function getInventory(
  token: string,
  filter?: string,
): Promise<Paged<InventoryItem>> {
  return request<Paged<InventoryItem>>(
    `/api/pharmacist/inventory${filter ? `?filter=${encodeURIComponent(filter)}` : ""}`,
    {},
    token,
  );
}
export function getStaffCustomers(
  token: string,
  search?: string,
): Promise<StaffCustomer[]> {
  return request<StaffCustomer[]>(
    `/api/pharmacist/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    {},
    token,
  );
}
export function getStaffActivity(token: string): Promise<StaffActivity[]> {
  return request<StaffActivity[]>("/api/pharmacist/activity", {}, token);
}
export function getStaffNotifications(
  token: string,
  panel: "pharmacist" | "delivery",
): Promise<StaffNotification[]> {
  return request<StaffNotification[]>(`/api/${panel}/notifications`, {}, token);
}
export function markStaffNotificationRead(
  id: string,
  token: string,
  panel: "pharmacist" | "delivery",
): Promise<void> {
  return requestApi<void>(
    `/api/${panel}/notifications/${id}/read`,
    { method: "PUT" },
    token,
  );
}
export function markAllStaffNotificationsRead(
  token: string,
  panel: "pharmacist" | "delivery",
): Promise<void> {
  return requestApi<void>(
    `/api/${panel}/notifications/read-all`,
    { method: "PUT" },
    token,
  );
}
export function transitionDelivery(
  id: string,
  action: "accept" | "arrived" | "pickup" | "start" | "delivered" | "failed",
  input: unknown,
  token: string,
): Promise<StaffOrder> {
  return requestApi<StaffOrder>(
    `/api/delivery/orders/${id}/${action}`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getRiderAvailability(token: string): Promise<RiderAvailability> {
  return request<RiderAvailability>("/api/delivery/availability", {}, token);
}
export function setRiderAvailability(isAvailable: boolean, token: string): Promise<RiderAvailability> {
  return requestApi<RiderAvailability>(
    "/api/delivery/availability",
    { method: "PUT", body: JSON.stringify({ isAvailable }) },
    token,
  );
}
export function updateAvailableRiderLocation(
  input: { latitude: number; longitude: number; accuracy?: number },
  token: string,
): Promise<DeliveryLocationSnapshot> {
  return requestApi<DeliveryLocationSnapshot>(
    "/api/delivery/availability/location",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export async function uploadOrderDocument(id: string, kind: string, file: File, token: string, delivery = false): Promise<OrderDocument> {
  const body = new FormData();
  body.append("kind", kind);
  body.append("file", file);
  const path = delivery ? `/api/delivery/orders/${id}/documents` : `/api/orders/${id}/documents`;
  return requestApi<OrderDocument>(path, { method: "POST", body }, token);
}
export async function downloadOrderDocument(url: string, token: string): Promise<void> {
  const path = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  const saved = await localDocument(url, token);
  if (saved) {
    const href = URL.createObjectURL(saved);
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = "saved-order-document"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    return;
  }
  const response = await fetchWithNetworkHandling(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; detail?: string } | null;
    throw new ApiError(payload?.message ?? payload?.detail ?? "This order document could not be opened.", response.status);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = decodeURIComponent(path.split("/").pop() ?? "order-document");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally { URL.revokeObjectURL(objectUrl); }
}

// Sync uses the original network transport, so it cannot re-enqueue its own requests.
setOfflineTransport(requestNetwork);
export function getOrderPaymentInstructions(id: string, token: string): Promise<PaymentInstructions> {
  return request<PaymentInstructions>(`/api/orders/${id}/payment-instructions`, {}, token);
}
export function getCustomerOrderDocuments(id: string, token: string): Promise<OrderDocument[]> {
  return request<OrderDocument[]>(`/api/orders/${id}/documents`, {}, token);
}
export function getCustomerPriceVisibility(token: string): Promise<CustomerPriceVisibility> {
  return request<CustomerPriceVisibility>("/api/orders/price-visibility", {}, token);
}
export function getMyWeeklyStatement(token: string, params: { from?: string; to?: string } = {}): Promise<CustomerStatement> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request(`/api/orders/weekly-statement?${query}`, {}, token);
}
export function createCustomerOrder(
  input: unknown,
  token: string,
): Promise<{
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}> {
  return requestApi(
    "/api/orders",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export type CustomerCartLine = {
  productId: string;
  productCode: string;
  productSlug: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  prescriptionRequired: boolean;
  imageUrl?: string;
  sellingPrice: number;
  pricesVisible?: boolean;
};
export type CustomerCartResponse = {
  items: CustomerCartLine[];
  warnings: string[];
  count: number;
};
export function getCustomerCart(token: string): Promise<CustomerCartResponse> {
  return requestApi<CustomerCartResponse>("/api/cart", {}, token);
}
export function addCustomerCartItem(productCode: string, quantity: number, token: string): Promise<CustomerCartResponse> {
  return requestApi<CustomerCartResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ productCode, quantity }),
  }, token);
}
export function setCustomerCartItemQuantity(productCode: string, quantity: number, token: string): Promise<CustomerCartResponse> {
  return requestApi<CustomerCartResponse>(`/api/cart/items/${encodeURIComponent(productCode)}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  }, token);
}
export function removeCustomerCartItem(productCode: string, token: string): Promise<CustomerCartResponse> {
  return requestApi<CustomerCartResponse>(`/api/cart/items/${encodeURIComponent(productCode)}`, { method: "DELETE" }, token);
}
export function clearCustomerCart(token: string): Promise<void> {
  return requestApi<void>("/api/cart", { method: "DELETE" }, token);
}
export async function mergeCustomerCartFromStorage(
  _token: string,
): Promise<CustomerCartResponse | null> {
  void _token;
  // Guest cart merging is intentionally disabled. Cart state is account-scoped
  // and must never be copied from a previous browser session into a new user.
  if (typeof window !== "undefined") window.localStorage.removeItem("anhh-cart");
  return null;
}
export function getCustomerOrders(
  token: string,
): Promise<StaffOrderListItem[]> {
  return request<StaffOrderListItem[]>("/api/orders", {}, token);
}
export function getCustomerOrder(
  id: string,
  token: string,
): Promise<StaffOrder> {
  return request<StaffOrder>(`/api/orders/${id}`, {}, token);
}
export function getCustomerDeliveryTracking(id: string, token: string): Promise<DeliveryTrackingSnapshot> {
  return request<DeliveryTrackingSnapshot>(`/api/orders/${id}/tracking`, {}, token);
}
export type PublicOrderTracking = {
  trackingId: string;
  orderNumber: string;
  status: string;
  deliveryStatus?: string;
  total: number;
  createdAt: string;
  branchName?: string;
  timeline: { status: string; createdAt: string }[];
};
export function trackPublicOrder(type: "ORDER" | "TRACKING", value: string): Promise<PublicOrderTracking> {
  return request<PublicOrderTracking>(`/api/orders/track?type=${type}&value=${encodeURIComponent(value)}`);
}
export type CustomerWishlistItem = { productId: string; productCode: string };
export function getCustomerWishlist(
  token: string,
): Promise<CustomerWishlistItem[]> {
  return request<CustomerWishlistItem[]>("/api/wishlist", {}, token);
}
export function addCustomerWishlist(
  productCode: string,
  token: string,
): Promise<CustomerWishlistItem> {
  return requestApi<CustomerWishlistItem>(
    `/api/wishlist/${encodeURIComponent(productCode)}`,
    { method: "PUT" },
    token,
  );
}
export function removeCustomerWishlist(
  productCode: string,
  token: string,
): Promise<void> {
  return requestApi<void>(
    `/api/wishlist/${encodeURIComponent(productCode)}`,
    { method: "DELETE" },
    token,
  );
}
export function getDeliveryQuote(
  input: {
    province: string;
    district: string;
    municipality: string;
    ward: string;
    subtotal: number;
    branchId?: string;
    items?: { productCode: string; quantity: number }[];
  },
  token: string,
): Promise<DeliveryQuote> {
  return requestApi<DeliveryQuote>(
    "/api/orders/delivery-quote",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}

export function getPublicBranches(
  signal?: AbortSignal,
): Promise<PublicBranch[]> {
  return request<PublicBranch[]>("/api/catalog/branches", { signal });
}
export type CouponValidation = {
  code: string;
  type: string;
  value: number;
  discountAmount: number;
  subtotal: number;
  totalAfterDiscount: number;
};
export function validateCustomerCoupon(
  code: string,
  subtotal: number,
  token: string,
): Promise<CouponValidation> {
  return requestApi<CouponValidation>(
    "/api/orders/coupon/validate",
    { method: "POST", body: JSON.stringify({ code, subtotal }) },
    token,
  );
}
export function getAdminDashboard(
  token: string,
  superAdmin = false,
  range?: string,
  from?: string,
  to?: string,
): Promise<AdminDashboard> {
  const query = new URLSearchParams();
  if (range && range !== "custom") query.set("range", range);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString();
  return request<AdminDashboard>(
    `/api/${superAdmin ? "superadmin" : "admin"}/dashboard${suffix ? `?${suffix}` : ""}`,
    {},
    token,
  );
}
export function searchAdmin(
  token: string,
  query: string,
  superAdmin = false,
): Promise<AdminGlobalSearchResult[]> {
  return request<AdminGlobalSearchResult[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/search?q=${encodeURIComponent(query)}&limit=12`,
    {},
    token,
  );
}
export type AdminReportType =
  | "orders"
  | "payments"
  | "customers"
  | "inventory"
  | "products"
  | "categories"
  | "prescriptions"
  | "delivery"
  | "branches"
  | "staff"
  | "coupons"
  | "tax";
export type AdminReportFilters = {
  branchId?: string;
  productId?: string;
  categoryId?: string;
  brandId?: string;
  status?: string;
  paymentMethod?: string;
  staffId?: string;
};
export async function downloadAdminReport(
  type: AdminReportType,
  token: string,
  superAdmin = false,
  from?: string,
  to?: string,
  format: "csv" | "pdf" = "csv",
  filters: AdminReportFilters = {},
): Promise<void> {
  const query = new URLSearchParams({ type });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  query.set("format", format);
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  const response = await fetchWithNetworkHandling(
    `${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/reports/export?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new ApiError("The report could not be exported.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `anhh-${type}-report.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
export type BranchSalesSummary = { branchId?: string; branchName: string; totalSales: number; orderCount: number; customers: string[] };
export type BranchSalesOrder = { id: string; branchId?: string; orderNumber: string; customerName: string; orderDate: string; amount: number; status: string; branchName?: string };
export type BranchSalesReport = { branches: BranchSalesSummary[]; orders: BranchSalesOrder[]; from: string; to: string };
export function getBranchSalesReport(token: string, superAdmin = true, from?: string, to?: string, branchId?: string): Promise<BranchSalesReport> {
  const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to); if (branchId) query.set("branchId", branchId);
  return request<BranchSalesReport>(`/api/${superAdmin ? "superadmin" : "admin"}/branch-sales?${query}`, {}, token);
}
export async function importAdminProducts(form: FormData, token: string, superAdmin = true): Promise<{ created: number; updated: number; deactivated: boolean; errors: string[] }> {
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/products/import`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "The product catalog could not be imported.", response.status);
  return data;
}
export type ProductImportPreviewRow = { rowNumber: number; productName: string; category: string; branchName: string; barcode?: string; salePrice?: number; isTrending: boolean; imageFilenames: string[]; isValid: boolean; errors: string[]; willUpdate: boolean };
export type ProductImportPreview = { rows: ProductImportPreviewRow[]; validRows: number; errorRows: number };
export type ProductImportResult = { added: number; updated: number; failed: number; errors: string[] };
function productImportForm(csv: File, images: File[], imagesZip?: File) { const form = new FormData(); form.append("csv", csv); images.forEach(image => form.append("images", image)); if (imagesZip) form.append("imagesZip", imagesZip); return form; }
export async function previewAdminProductImport(csv: File, images: File[], imagesZip: File | undefined, token: string, superAdmin = true): Promise<ProductImportPreview> {
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/products/import/preview`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: productImportForm(csv, images, imagesZip) });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new ApiError(data?.message ?? "The CSV could not be previewed.", response.status); return data;
}
export async function commitAdminProductImport(csv: File, images: File[], imagesZip: File | undefined, replaceExisting: boolean, token: string, superAdmin = true): Promise<ProductImportResult> {
  const form = productImportForm(csv, images, imagesZip); form.append("replaceExisting", String(replaceExisting));
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/products/import/commit`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new ApiError(data?.message ?? "The product import could not be saved.", response.status); return data;
}
export async function downloadProductImportTemplate(token: string, superAdmin = true): Promise<void> {
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/products/import/template`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new ApiError("The CSV template could not be downloaded.", response.status); const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "all-nepal-healthy-home-product-template.csv"; anchor.click(); URL.revokeObjectURL(url);
}
export type CatalogWorkbookPreviewRow = { rowNumber: number; companyCode: string; companyName: string; productName: string; isValid: boolean; isDuplicate: boolean; willUpdate: boolean; errors: string[]; imageStatus: string; demandScore: number; demandBasis: string };
export type CatalogWorkbookPreview = { rows: CatalogWorkbookPreviewRow[]; totalRows: number; validRows: number; duplicateRows: number; invalidRows: number; blankRows: number };
export type CatalogWorkbookImportResult = { added: number; updated: number; skippedDuplicates: number; invalidRows: number; missingImageRows: number; salesHistoryRows: number; researchBasedRows: number; errors: string[] };
export async function previewCatalogWorkbook(workbook: File, token: string, superAdmin = true): Promise<CatalogWorkbookPreview> {
  const form = new FormData(); form.append("workbook", workbook);
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/products/import/catalog/preview`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new ApiError(data?.message ?? "The workbook could not be previewed.", response.status); return data;
}
export async function commitCatalogWorkbook(workbook: File, token: string, superAdmin = true): Promise<CatalogWorkbookImportResult> {
  const form = new FormData(); form.append("workbook", workbook);
  const response = await fetchWithNetworkHandling(`${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/products/import/catalog/commit`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new ApiError(data?.message ?? "The workbook could not be imported.", response.status); return data;
}
export function getAdminProducts(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
  superAdmin = false,
  activeOnly = false,
  signal?: AbortSignal,
): Promise<Paged<AdminProduct>> {
  const requestParams = activeOnly
    ? { ...params, activeOnly: true }
    : { ...params, pageSize: params.pageSize === undefined || params.pageSize === 100 ? getStoredTablePageSize() : params.pageSize };
  const query = new URLSearchParams(
    Object.entries(requestParams)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  return request<Paged<AdminProduct>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/products?${query}`,
    { signal },
    token,
  );
}
export function getAdminProduct(
  id: string,
  token: string,
  superAdmin = false,
): Promise<AdminProduct> {
  return request<AdminProduct>(
    `/api/${superAdmin ? "superadmin" : "admin"}/products/${id}`,
    {},
    token,
  );
}
export function getAdminMedicines(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminMedicine[]> {
  return request<AdminMedicine[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/medicines${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function getAdminBrands(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminBrand[]> {
  return request<AdminBrand[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/brands${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function getAdminCategories(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminCategory[]> {
  return request<AdminCategory[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/categories${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function createAdminCategory(
  input: {
    name: string;
    slug: string;
    description?: string;
    isActive: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminCategory> {
  return requestApi<AdminCategory>(
    `/api/${superAdmin ? "superadmin" : "admin"}/categories`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminCategory(
  id: string,
  input: {
    name: string;
    slug: string;
    description?: string;
    isActive: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminCategory> {
  return requestApi<AdminCategory>(
    `/api/${superAdmin ? "superadmin" : "admin"}/categories/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function createAdminBrand(
  input: { name: string; slug: string; isActive: boolean },
  token: string,
  superAdmin = true,
): Promise<AdminBrand> {
  return requestApi<AdminBrand>(
    `/api/${superAdmin ? "superadmin" : "admin"}/brands`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminBrand(
  id: string,
  input: { name: string; slug: string; isActive: boolean },
  token: string,
  superAdmin = true,
): Promise<AdminBrand> {
  return requestApi<AdminBrand>(
    `/api/${superAdmin ? "superadmin" : "admin"}/brands/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminManufacturers(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminManufacturer[]> {
  return request<AdminManufacturer[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/manufacturers${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function createAdminManufacturer(
  input: { name: string; country?: string },
  token: string,
  superAdmin = true,
): Promise<AdminManufacturer> {
  return requestApi<AdminManufacturer>(
    `/api/${superAdmin ? "superadmin" : "admin"}/manufacturers`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminManufacturer(
  id: string,
  input: { name: string; country?: string },
  token: string,
  superAdmin = true,
): Promise<AdminManufacturer> {
  return requestApi<AdminManufacturer>(
    `/api/${superAdmin ? "superadmin" : "admin"}/manufacturers/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function createAdminMedicine(
  input: {
    name: string;
    genericName?: string;
    strength?: string;
    dosageForm?: string;
    prescriptionRequired: boolean;
    isActive: boolean;
    categoryId?: string;
    manufacturerId?: string;
  },
  token: string,
  superAdmin = true,
): Promise<AdminMedicine> {
  return requestApi<AdminMedicine>(
    `/api/${superAdmin ? "superadmin" : "admin"}/medicines`,
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        description: null,
        uses: null,
        warnings: null,
        sideEffects: null,
        storageInformation: null,
      }),
    },
    token,
  );
}
export function updateAdminMedicine(
  id: string,
  input: {
    name: string;
    genericName?: string;
    strength?: string;
    dosageForm?: string;
    prescriptionRequired: boolean;
    isActive: boolean;
    categoryId?: string;
    manufacturerId?: string;
  },
  token: string,
  superAdmin = true,
): Promise<AdminMedicine> {
  return requestApi<AdminMedicine>(
    `/api/${superAdmin ? "superadmin" : "admin"}/medicines/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        ...input,
        description: null,
        uses: null,
        warnings: null,
        sideEffects: null,
        storageInformation: null,
      }),
    },
    token,
  );
}
export function createAdminProduct(
  input: {
    name: string;
    slug: string;
    sku: string;
    medicineId: string;
    brandId: string;
    mrp: number;
    sellingPrice: number;
    imageUrl?: string;
    imageUrls?: string[];
    isFeatured: boolean;
    isActive: boolean;
    barcode?: string;
    packSize?: string;
    taxRate: number;
    discountPercent: number;
    isBestSeller: boolean;
    isNewArrival: boolean;
    searchKeywords?: string;
    bonusScheme?: string;
    isTrending: boolean;
    isHotDeal: boolean;
    companyCode?: string;
    companyName?: string;
    imageSourceUrl?: string;
    imageVerificationStatus?: string;
    imageSourceReference?: string;
    imageSourceWebsite?: string;
    imageSourcePageUrl?: string;
    imageSearchedAtUtc?: string;
    imageMatchingNotes?: string;
    imageMediaAssetId?: string;
    demandScore?: number;
    demandBasis?: string;
    demandSourceUrl?: string;
    demandSourceReference?: string;
    displayOrder?: number;
  },
  token: string,
  superAdmin = true,
): Promise<AdminProduct> {
  return requestApi<AdminProduct>(
    `/api/${superAdmin ? "superadmin" : "admin"}/products`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminProduct(
  id: string,
  input: {
    name: string;
    slug: string;
    sku: string;
    medicineId: string;
    brandId: string;
    mrp: number;
    sellingPrice: number;
    imageUrl?: string;
    imageUrls?: string[];
    isFeatured: boolean;
    isActive: boolean;
    barcode?: string;
    packSize?: string;
    taxRate: number;
    discountPercent: number;
    isBestSeller: boolean;
    isNewArrival: boolean;
    searchKeywords?: string;
    bonusScheme?: string;
    isTrending: boolean;
    isHotDeal: boolean;
    companyCode?: string;
    companyName?: string;
    imageSourceUrl?: string;
    imageVerificationStatus?: string;
    imageSourceReference?: string;
    imageSourceWebsite?: string;
    imageSourcePageUrl?: string;
    imageSearchedAtUtc?: string;
    imageMatchingNotes?: string;
    imageMediaAssetId?: string;
    demandScore?: number;
    demandBasis?: string;
    demandSourceUrl?: string;
    demandSourceReference?: string;
    displayOrder?: number;
  },
  token: string,
  superAdmin = true,
): Promise<AdminProduct> {
  return requestApi<AdminProduct>(
    `/api/${superAdmin ? "superadmin" : "admin"}/products/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function bulkUpdateAdminProductStatus(
  productIds: string[],
  isActive: boolean,
  token: string,
  superAdmin = true,
): Promise<{ requested: number; updated: number; missing: string[] }> {
  return requestApi(
    `/api/${superAdmin ? "superadmin" : "admin"}/products/bulk-status`,
    { method: "POST", body: JSON.stringify({ productIds, isActive }) },
    token,
  );
}
export type AdminStatusEntity =
  | "product"
  | "category"
  | "brand"
  | "medicine"
  | "branch"
  | "supplier"
  | "delivery-zone"
  | "delivery-slot"
  | "staff"
  | "customer"
  | "coupon"
  | "flash-sale"
  | "payment-method"
  | "notification-template"
  | "homepage-section"
  | "website-asset"
  | "navigation"
  | "popup"
  | "seo"
  | "media"
  | "role";
export function setAdminEntityStatus(
  entity: AdminStatusEntity,
  id: string,
  isActive: boolean,
  token: string,
  superAdmin = false,
): Promise<{ entity: string; id: string; active: boolean }> {
  return requestApi(
    `/api/${superAdmin ? "superadmin" : "admin"}/status/${entity}/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify({ isActive }) },
    token,
  );
}
export function getAdminInventory(
  token: string,
  filter?: string,
  superAdmin = false,
): Promise<Paged<AdminInventory>> {
  return request<Paged<AdminInventory>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/inventory${filter ? `?filter=${encodeURIComponent(filter)}` : ""}`,
    {},
    token,
  );
}
export function adjustAdminInventory(
  id: string,
  quantityDelta: number,
  note: string,
  type: string,
  token: string,
  superAdmin = false,
): Promise<AdminInventory> {
  return requestApi<AdminInventory>(
    `/api/${superAdmin ? "superadmin" : "admin"}/inventory/${id}/adjust`,
    { method: "POST", body: JSON.stringify({ quantityDelta, note, type }) },
    token,
  );
}
export function transferAdminInventory(
  id: string,
  targetBranchId: string,
  quantity: number,
  note: string,
  token: string,
  superAdmin = false,
): Promise<AdminInventoryTransfer> {
  return requestApi<AdminInventoryTransfer>(
    `/api/${superAdmin ? "superadmin" : "admin"}/inventory/${id}/transfer`,
    {
      method: "POST",
      body: JSON.stringify({ targetBranchId, quantity, note }),
    },
    token,
  );
}
export function getAdminOrders(
  token: string,
  params: Record<string, string | number | undefined> = {},
  superAdmin = false,
): Promise<Paged<AdminOrder>> {
  const query = new URLSearchParams(
    Object.entries({ pageSize: getStoredTablePageSize(), ...params })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return request<Paged<AdminOrder>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/orders?${query}`,
    {},
    token,
  );
}
export function getBranchOperations(token: string, params: { from?: string; to?: string; branchId?: string } = {}, superAdmin = false): Promise<BranchOperations[]> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request(`/api/${superAdmin ? "superadmin" : "admin"}/branch-operations?${query}`, {}, token);
}
export function getCustomerStatement(token: string, customerId: string, params: { from?: string; to?: string } = {}, superAdmin = false): Promise<CustomerStatement> {
  const query = new URLSearchParams({ customerId, ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])) });
  return request(`/api/${superAdmin ? "superadmin" : "admin"}/customer-statements?${query}`, {}, token);
}
export function getAdminOrder(
  id: string,
  token: string,
  superAdmin = false,
): Promise<AdminOrderDetail> {
  return request<AdminOrderDetail>(
    `/api/${superAdmin ? "superadmin" : "admin"}/orders/${id}`,
    {},
    token,
  );
}
export function updateAdminOrderAssignment(
  id: string,
  input: {
    branchId?: string;
    pharmacistId?: string;
    deliveryStaffId?: string;
    supervisorId?: string;
    assignedStaffUserId?: string;
    note?: string;
  },
  token: string,
  superAdmin = false,
): Promise<AdminOrderDetail> {
  return requestApi<AdminOrderDetail>(
    `/api/${superAdmin ? "superadmin" : "admin"}/orders/${id}/assignment`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminInvoice(
  id: string,
  token: string,
  superAdmin = false,
): Promise<AdminInvoice> {
  return request<AdminInvoice>(
    `/api/${superAdmin ? "superadmin" : "admin"}/orders/${id}/invoice`,
    {},
    token,
  );
}
export async function downloadAdminInvoice(
  id: string,
  token: string,
  superAdmin = false,
): Promise<void> {
  const response = await fetchWithNetworkHandling(
    `${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/orders/${id}/invoice/document`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new ApiError("The invoice could not be downloaded.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `invoice-${id}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function getAdminPayments(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
  superAdmin = false,
): Promise<Paged<AdminPayment>> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return request<Paged<AdminPayment>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/payments?${query}`,
    {},
    token,
  );
}
export function updateAdminPaymentStatus(
  id: string,
  input: { status: string; providerReference?: string; notes?: string },
  token: string,
  superAdmin = false,
): Promise<AdminPayment> {
  return requestApi<AdminPayment>(
    `/api/${superAdmin ? "superadmin" : "admin"}/payments/${id}/status`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminNotifications(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
  superAdmin = false,
): Promise<Paged<AdminNotification>> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return request<Paged<AdminNotification>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/notifications?${query}`,
    {},
    token,
  );
}
export function getAdminNotificationTemplates(
  token: string,
  superAdmin = false,
): Promise<AdminNotificationTemplate[]> {
  return request<AdminNotificationTemplate[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/notification-templates`,
    {},
    token,
  );
}
export function createAdminNotificationTemplate(
  input: Omit<AdminNotificationTemplate, "id" | "updatedAt">,
  token: string,
  superAdmin = false,
): Promise<AdminNotificationTemplate> {
  return requestApi<AdminNotificationTemplate>(
    `/api/${superAdmin ? "superadmin" : "admin"}/notification-templates`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminNotificationTemplate(
  id: string,
  input: Omit<AdminNotificationTemplate, "id" | "updatedAt">,
  token: string,
  superAdmin = false,
): Promise<AdminNotificationTemplate> {
  return requestApi<AdminNotificationTemplate>(
    `/api/${superAdmin ? "superadmin" : "admin"}/notification-templates/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminHealthArticles(
  token: string,
  superAdmin = false,
): Promise<AdminHealthArticle[]> {
  return request<AdminHealthArticle[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/articles`,
    {},
    token,
  );
}
export function createAdminHealthArticle(
  input: Omit<AdminHealthArticle, "id" | "updatedAt">,
  token: string,
  superAdmin = false,
): Promise<AdminHealthArticle> {
  return requestApi<AdminHealthArticle>(
    `/api/${superAdmin ? "superadmin" : "admin"}/articles`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminHealthArticle(
  id: string,
  input: Omit<AdminHealthArticle, "id" | "updatedAt">,
  token: string,
  superAdmin = false,
): Promise<AdminHealthArticle> {
  return requestApi<AdminHealthArticle>(
    `/api/${superAdmin ? "superadmin" : "admin"}/articles/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getPublicHealthArticles(): Promise<AdminHealthArticle[]> {
  return request<AdminHealthArticle[]>("/api/site/articles");
}
export function getPublicHealthArticle(
  slug: string,
): Promise<AdminHealthArticle> {
  return request<AdminHealthArticle>(
    `/api/site/articles/${encodeURIComponent(slug)}`,
  );
}
export function getPublicSiteSummary(): Promise<PublicSiteSummary> {
  return request<PublicSiteSummary>("/api/site/summary");
}
export function getFeaturedReviews(): Promise<PublicReview[]> {
  return request<PublicReview[]>("/api/site/featured-reviews");
}
export function getAdminReviews(
  token: string,
  params: { status?: string; search?: string } = {},
  superAdmin = false,
): Promise<Paged<AdminReview>> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, value as string]),
  );
  return request<Paged<AdminReview>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/reviews?pageSize=${getStoredTablePageSize()}&${query}`,
    {},
    token,
  );
}
export function updateAdminReview(
  id: string,
  input: { status: string; adminResponse?: string },
  token: string,
  superAdmin = false,
): Promise<AdminReview> {
  return requestApi<AdminReview>(
    `/api/${superAdmin ? "superadmin" : "admin"}/reviews/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getProductReviews(productId: string): Promise<PublicReview[]> {
  return request<PublicReview[]>(`/api/reviews/product/${productId}`);
}
export function createProductReview(
  input: {
    productId: string;
    orderId?: string;
    rating: number;
    title?: string;
    comment: string;
  },
  token: string,
): Promise<PublicReview> {
  return requestApi<PublicReview>(
    "/api/reviews",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getMySupportTickets(
  token: string,
): Promise<AdminSupportTicket[]> {
  return request<AdminSupportTicket[]>("/api/support-tickets", {}, token);
}
export function createSupportTicket(
  input: {
    subject: string;
    description: string;
    category?: string;
    priority: string;
  },
  token: string,
): Promise<AdminSupportTicket> {
  return requestApi<AdminSupportTicket>(
    "/api/support-tickets",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminSupportTickets(
  token: string,
  params: { status?: string; priority?: string; search?: string } = {},
  superAdmin = false,
): Promise<Paged<AdminSupportTicket>> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, value as string]),
  );
  return request<Paged<AdminSupportTicket>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/support-tickets?pageSize=${getStoredTablePageSize()}&${query}`,
    {},
    token,
  );
}
export function updateAdminSupportTicket(
  id: string,
  input: {
    status: string;
    priority: string;
    resolution?: string;
    assignedStaffId?: string;
  },
  token: string,
  superAdmin = false,
): Promise<AdminSupportTicket> {
  return requestApi<AdminSupportTicket>(
    `/api/${superAdmin ? "superadmin" : "admin"}/support-tickets/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminSupportTicketMessages(
  id: string,
  token: string,
  superAdmin = false,
): Promise<AdminSupportTicketMessage[]> {
  return request<AdminSupportTicketMessage[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/support-tickets/${id}/messages`,
    {},
    token,
  );
}
export function addAdminSupportTicketMessage(
  id: string,
  input: { message: string; isInternal: boolean },
  token: string,
  superAdmin = false,
): Promise<AdminSupportTicketMessage> {
  return requestApi<AdminSupportTicketMessage>(
    `/api/${superAdmin ? "superadmin" : "admin"}/support-tickets/${id}/messages`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminOrderStatus(
  id: string,
  status: string,
  note: string,
  token: string,
  superAdmin = false,
): Promise<AdminOrder> {
  return requestApi<AdminOrder>(
    `/api/${superAdmin ? "superadmin" : "admin"}/orders/${id}/status`,
    {
      method: "PUT",
      body: JSON.stringify({ status, note: note || undefined }),
    },
    token,
  );
}
export function getAdminPrescriptions(
  token: string,
  superAdmin = false,
): Promise<Paged<AdminPrescription>> {
  return request<Paged<AdminPrescription>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/prescriptions?pageSize=${getStoredTablePageSize()}`,
    {},
    token,
  );
}
export function getAdminPrescription(
  id: string,
  token: string,
  superAdmin = false,
): Promise<StaffPrescription> {
  return request<StaffPrescription>(
    `/api/${superAdmin ? "superadmin" : "admin"}/prescriptions/${id}`,
    {},
    token,
  );
}
export async function getAdminPrescriptionFile(
  id: string,
  token: string,
  superAdmin = false,
): Promise<string> {
  const response = await fetchWithNetworkHandling(
    `${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/prescriptions/${id}/file`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok)
    throw new ApiError(
      "The prescription file could not be loaded.",
      response.status,
    );
  return URL.createObjectURL(await response.blob());
}
export function overrideAdminPrescription(
  id: string,
  input: { status: string; reason: string },
  token: string,
  superAdmin = false,
): Promise<StaffPrescription> {
  return requestApi<StaffPrescription>(
    `/api/${superAdmin ? "superadmin" : "admin"}/prescriptions/${id}/override`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminStaff(
  token: string,
  activeOnly = false,
  superAdmin = true,
): Promise<Staff[]> {
  return request<Staff[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/staff${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function getSalesExecutiveAssignments(token: string, params: { search?: string; branchId?: string; activeOnly?: boolean; page?: number; pageSize?: number } = {}, superAdmin = true): Promise<Paged<SalesExecutiveAssignment>> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request<Paged<SalesExecutiveAssignment>>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments?${query}`, {}, token);
}
export function getSalesExecutiveAssignmentBranches(token: string, superAdmin = true): Promise<SalesAssignmentBranchOption[]> {
  return request<SalesAssignmentBranchOption[]>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignment-options/branches`, {}, token);
}
export function getSalesExecutiveAssignmentStaff(token: string, params: { search?: string; branchId?: string; page?: number; pageSize?: number } = {}, superAdmin = true): Promise<Paged<SalesExecutiveOption>> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request<Paged<SalesExecutiveOption>>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignment-options/staff?${query}`, {}, token);
}
export function getSalesExecutiveAssignmentProducts(token: string, params: { search?: string; page?: number; pageSize?: number } = {}, superAdmin = true): Promise<Paged<AdminProduct>> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request<Paged<AdminProduct>>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignment-options/products?${query}`, {}, token);
}
export function createSalesExecutiveAssignment(input: { salesExecutiveUserId: string; productId?: string; categoryId?: string; isActive?: boolean }, token: string, superAdmin = true): Promise<SalesExecutiveAssignment> {
  return requestApi<SalesExecutiveAssignment>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function createBulkSalesExecutiveAssignments(input: { salesExecutiveUserIds: string[]; productIds: string[]; isActive?: boolean }, token: string, superAdmin = true): Promise<BulkSalesExecutiveAssignmentResponse> {
  return requestApi<BulkSalesExecutiveAssignmentResponse>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments/bulk`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function updateSalesExecutiveAssignment(id: string, input: { salesExecutiveUserId: string; productId?: string; categoryId?: string; isActive?: boolean }, token: string, superAdmin = true): Promise<SalesExecutiveAssignment> {
  return requestApi<SalesExecutiveAssignment>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function deleteSalesExecutiveAssignment(id: string, token: string, superAdmin = true): Promise<void> {
  return requestApi<void>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments/${id}`, { method: "DELETE" }, token);
}
export function bulkUpdateSalesExecutiveAssignments(input: { assignmentIds: string[]; isActive?: boolean; salesExecutiveUserId?: string; productId?: string }, token: string, superAdmin = true): Promise<BulkSalesExecutiveAssignmentMutationResponse> {
  return requestApi<BulkSalesExecutiveAssignmentMutationResponse>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments/bulk`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function bulkDeleteSalesExecutiveAssignments(assignmentIds: string[], token: string, superAdmin = true): Promise<BulkSalesExecutiveAssignmentMutationResponse> {
  return requestApi<BulkSalesExecutiveAssignmentMutationResponse>(`/api/${superAdmin ? "superadmin" : "admin"}/sales-executive/assignments/bulk`, { method: "DELETE", body: JSON.stringify({ assignmentIds }) }, token);
}
export function createAdminStaff(
  input: {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    branchId?: string;
    licenseReference?: string;
    employeeId?: string;
    address?: string;
    joiningDate?: string;
    department?: string;
    jobTitle?: string;
    appointmentType?: string;
    employmentStatus?: string;
    officialEmail?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    taxNumber?: string;
    citizenshipNumber?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    bloodGroup?: string;
    deviceEnrollmentId?: string;
    mobileAccessEnabled?: boolean;
    webAccessEnabled?: boolean;
    permissions?: string[];
    isActive: boolean;
    password?: string;
  },
  token: string,
): Promise<Staff> {
  return requestApi<Staff>(
    "/api/superadmin/staff",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminStaff(
  id: string,
  input: {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    branchId?: string;
    licenseReference?: string;
    employeeId?: string;
    address?: string;
    joiningDate?: string;
    department?: string;
    jobTitle?: string;
    appointmentType?: string;
    employmentStatus?: string;
    officialEmail?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    taxNumber?: string;
    citizenshipNumber?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    bloodGroup?: string;
    deviceEnrollmentId?: string;
    mobileAccessEnabled?: boolean;
    webAccessEnabled?: boolean;
    permissions?: string[];
    isActive: boolean;
    password?: string;
  },
  token: string,
): Promise<Staff> {
  return requestApi<Staff>(
    `/api/superadmin/staff/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function uploadAdminStaffPhoto(
  id: string,
  file: File,
  token: string,
): Promise<Staff> {
  const body = new FormData();
  body.append("file", file);
  return requestApi<Staff>(
    `/api/superadmin/staff/${id}/photo`,
    { method: "POST", body },
    token,
  );
}
export function getAdminPermissions(token: string): Promise<AdminPermission[]> {
  return request<AdminPermission[]>("/api/superadmin/permissions", {}, token);
}
export function getAdminRoles(token: string): Promise<AdminRole[]> {
  return request<AdminRole[]>("/api/superadmin/roles", {}, token);
}
export function createAdminRole(
  input: {
    name: string;
    displayName: string;
    description?: string;
    isActive: boolean;
    permissions: string[];
  },
  token: string,
): Promise<AdminRole> {
  return requestApi<AdminRole>(
    "/api/superadmin/roles",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminRole(
  id: string,
  input: {
    name: string;
    displayName: string;
    description?: string;
    isActive: boolean;
    permissions: string[];
  },
  token: string,
): Promise<AdminRole> {
  return requestApi<AdminRole>(
    `/api/superadmin/roles/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminPaymentMethods(
  token: string,
): Promise<AdminPaymentMethod[]> {
  return request<AdminPaymentMethod[]>(
    "/api/superadmin/payment-methods",
    {},
    token,
  );
}
export function updateAdminPaymentMethod(
  code: string,
  input: Omit<AdminPaymentMethod, "id" | "code">,
  token: string,
): Promise<AdminPaymentMethod> {
  return requestApi<AdminPaymentMethod>(
    `/api/superadmin/payment-methods/${encodeURIComponent(code)}`,
    { method: "PUT", body: JSON.stringify({ code, ...input }) },
    token,
  );
}
export function getPriceVisibilitySettings(token: string): Promise<PriceVisibilitySettings> {
  return request<PriceVisibilitySettings>("/api/superadmin/price-visibility", {}, token);
}
export function savePriceVisibilitySettings(input: PriceVisibilitySettings, token: string): Promise<PriceVisibilitySettings> {
  return requestApi<PriceVisibilitySettings>("/api/superadmin/price-visibility", { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getDeliveryRulesSettings(token: string): Promise<DeliveryRulesSettings> {
  return request<DeliveryRulesSettings>("/api/superadmin/delivery-rules", {}, token);
}
export function saveDeliveryRulesSettings(input: DeliveryRulesSettings, token: string): Promise<DeliveryRulesSettings> {
  return requestApi<DeliveryRulesSettings>("/api/superadmin/delivery-rules", { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getAdminAuditLogs(
  token: string,
  params: {
    search?: string;
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<
  {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorRole?: string;
    previousValue?: string;
    newValue?: string;
    createdAt: string;
  }[]
> {
  const query = new URLSearchParams({
    pageSize: String(getStoredTablePageSize()),
    ...Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  });
  return request<
    Paged<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      actorRole?: string;
      previousValue?: string;
      newValue?: string;
      createdAt: string;
    }>
  >(`/api/superadmin/audit-logs?${query}`, {}, token).then((x) => x.items);
}
export function getAdminSettings(token: string, superAdmin = true): Promise<
  {
    key: string;
    value: string;
    group: string;
    isPublic: boolean;
    description?: string;
  }[]> {
  return request(`/api/${superAdmin ? "superadmin" : "admin"}/settings`, {}, token);
}
export function getManagementSidebarTheme(
  token: string,
  role?: string,
): Promise<ManagementSidebarTheme> {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return request<ManagementSidebarTheme>(`/api/admin/theme/sidebar${query}`, {}, token);
}
export function saveManagementSidebarTheme(
  theme: ManagementSidebarTheme,
  token: string,
  role = "SUPERADMIN",
): Promise<ManagementSidebarTheme> {
  return requestApi<ManagementSidebarTheme>(
    `/api/superadmin/theme/sidebar?role=${encodeURIComponent(role)}`,
    { method: "PUT", body: JSON.stringify(theme) },
    token,
  );
}
export function saveAdminSetting(
  key: string,
  input: {
    value: string;
    group: string;
    isPublic: boolean;
    description?: string;
  },
  token: string,
  superAdmin = true,
): Promise<unknown> {
  return requestApi(
    `/api/${superAdmin ? "superadmin" : "admin"}/settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify({ key, ...input }) },
    token,
  );
}
export function getAdminAssistantIntegration(token: string): Promise<AdminAssistantIntegration> {
  return request<AdminAssistantIntegration>("/api/superadmin/integrations/assistant", {}, token);
}
export function saveAdminAssistantIntegration(input: { enabled: boolean; provider: string; model: string; baseUrl: string; apiKey?: string }, token: string): Promise<AdminAssistantIntegration> {
  return requestApi<AdminAssistantIntegration>("/api/superadmin/integrations/assistant", { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getAdminFaqs(token: string): Promise<AdminFaq[]> {
  return request<AdminFaq[]>("/api/superadmin/faq", {}, token);
}
export function createAdminFaq(input: Omit<AdminFaq, "id">, token: string): Promise<AdminFaq> {
  return requestApi<AdminFaq>("/api/superadmin/faq", { method: "POST", body: JSON.stringify(input) }, token);
}
export function updateAdminFaq(id: string, input: Omit<AdminFaq, "id">, token: string): Promise<AdminFaq> {
  return requestApi<AdminFaq>(`/api/superadmin/faq/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function deleteAdminFaq(id: string, token: string): Promise<void> {
  return requestApi<void>(`/api/superadmin/faq/${id}`, { method: "DELETE" }, token);
}
export function getAdminCustomers(
  token: string,
  search?: string,
  superAdmin = false,
): Promise<Paged<AdminCustomer>> {
  return request<Paged<AdminCustomer>>(
    `/api/${superAdmin ? "superadmin" : "admin"}/customers?pageSize=${getStoredTablePageSize()}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    {},
    token,
  );
}
export function getAdminCustomer(
  id: string,
  token: string,
  superAdmin = false,
): Promise<AdminCustomerDetail> {
  return request<AdminCustomerDetail>(
    `/api/${superAdmin ? "superadmin" : "admin"}/customers/${id}`,
    {},
    token,
  );
}
export function updateAdminCustomerStatus(
  id: string,
  isActive: boolean,
  token: string,
  superAdmin = false,
): Promise<AdminCustomer> {
  return requestApi<AdminCustomer>(
    `/api/${superAdmin ? "superadmin" : "admin"}/customers/${id}/status`,
    { method: "PUT", body: JSON.stringify({ isActive }) },
    token,
  );
}
export function getAdminCoupons(token: string): Promise<AdminCoupon[]> {
  return request<AdminCoupon[]>("/api/superadmin/coupons", {}, token);
}
export function createAdminCoupon(
  input: Omit<AdminCoupon, "id" | "usedCount" | "createdAt">,
  token: string,
): Promise<AdminCoupon> {
  return requestApi<AdminCoupon>(
    "/api/superadmin/coupons",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminCoupon(
  id: string,
  input: Omit<AdminCoupon, "id" | "usedCount" | "createdAt">,
  token: string,
): Promise<AdminCoupon> {
  return requestApi<AdminCoupon>(
    `/api/superadmin/coupons/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function deactivateAdminCoupon(
  id: string,
  token: string,
): Promise<void> {
  return requestApi<void>(
    `/api/superadmin/coupons/${id}`,
    { method: "DELETE" },
    token,
  );
}
export function getAdminFlashSales(
  token: string,
  superAdmin = false,
): Promise<AdminFlashSale[]> {
  return request<AdminFlashSale[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/flash-sales`,
    {},
    token,
  );
}
export function createAdminFlashSale(
  input: {
    name: string;
    productId: string;
    branchId?: string;
    discountPercent: number;
    quantityLimit?: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  },
  token: string,
  superAdmin = false,
): Promise<AdminFlashSale> {
  return requestApi<AdminFlashSale>(
    `/api/${superAdmin ? "superadmin" : "admin"}/flash-sales`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminFlashSale(
  id: string,
  input: {
    name: string;
    productId: string;
    branchId?: string;
    discountPercent: number;
    quantityLimit?: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  },
  token: string,
  superAdmin = false,
): Promise<AdminFlashSale> {
  return requestApi<AdminFlashSale>(
    `/api/${superAdmin ? "superadmin" : "admin"}/flash-sales/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function deactivateAdminFlashSale(
  id: string,
  token: string,
  superAdmin = false,
): Promise<void> {
  return requestApi<void>(
    `/api/${superAdmin ? "superadmin" : "admin"}/flash-sales/${id}`,
    { method: "DELETE" },
    token,
  );
}
export function getAdminPurchaseOrders(
  token: string,
  superAdmin = false,
): Promise<AdminPurchaseOrder[]> {
  return request<AdminPurchaseOrder[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/purchase-orders`,
    {},
    token,
  );
}
export function getAdminPurchaseOrder(
  id: string,
  token: string,
  superAdmin = false,
): Promise<AdminPurchaseOrderDetail> {
  return request<AdminPurchaseOrderDetail>(
    `/api/${superAdmin ? "superadmin" : "admin"}/purchase-orders/${id}`,
    {},
    token,
  );
}
export function createAdminPurchaseOrder(
  input: {
    supplierId: string;
    branchId: string;
    expectedAt?: string;
    notes?: string;
    items: {
      productId: string;
      quantity: number;
      unitCost: number;
      batchNumber?: string;
      expiryDate?: string;
      unit?: string;
    }[];
  },
  token: string,
  superAdmin = false,
): Promise<AdminPurchaseOrderDetail> {
  return requestApi<AdminPurchaseOrderDetail>(
    `/api/${superAdmin ? "superadmin" : "admin"}/purchase-orders`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function receiveAdminPurchaseOrder(
  id: string,
  items: {
    itemId: string;
    quantity: number;
    batchNumber?: string;
    expiryDate?: string;
  }[],
  token: string,
  superAdmin = false,
  payment: { paymentMode?: string; paidAmount?: number; supplierInvoiceReference?: string } = {},
): Promise<AdminPurchaseOrderDetail> {
  return requestApi<AdminPurchaseOrderDetail>(
    `/api/${superAdmin ? "superadmin" : "admin"}/purchase-orders/${id}/receive`,
    { method: "POST", body: JSON.stringify({ items, ...payment }) },
    token,
  );
}
export function cancelAdminPurchaseOrder(
  id: string,
  token: string,
  superAdmin = false,
): Promise<void> {
  return requestApi<void>(
    `/api/${superAdmin ? "superadmin" : "admin"}/purchase-orders/${id}/cancel`,
    { method: "POST" },
    token,
  );
}
export function getAdminSystemHealth(
  token: string,
): Promise<AdminSystemHealth> {
  return request<AdminSystemHealth>("/api/superadmin/system/health", {}, token);
}
export async function getAdminIntegrations(
  token: string,
): Promise<AdminIntegrations> {
  const response = await request<
    AdminIntegrations & { whatsApp?: AdminIntegrations["whatsapp"] }
  >("/api/superadmin/integrations", {}, token);
  return {
    ...response,
    whatsapp: response.whatsapp ?? response.whatsApp ?? { configured: false },
  };
}
export function saveAdminEmailIntegration(
  input: {
    host: string;
    port: number;
    username: string;
    password?: string;
    senderName: string;
    senderEmail: string;
    encryption: string;
  },
  token: string,
): Promise<AdminIntegrations["email"]> {
  return requestApi<AdminIntegrations["email"]>(
    "/api/superadmin/integrations/email",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function testAdminEmail(
  to: string,
  token: string,
): Promise<{ message: string }> {
  return requestApi<{ message: string }>(
    "/api/superadmin/integrations/email/test",
    { method: "POST", body: JSON.stringify({ to }) },
    token,
  );
}
export function saveAdminSmsIntegration(
  input: {
    provider?: string;
    apiUrl?: string;
    apiKey?: string;
    senderId?: string;
    otpExpiryMinutes: number;
    otpLength: number;
    rateLimitPerHour: number;
    retryLimit: number;
  },
  token: string,
): Promise<AdminIntegrations["sms"]> {
  return requestApi<AdminIntegrations["sms"]>(
    "/api/superadmin/integrations/sms",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function saveAdminWhatsAppIntegration(
  input: {
    provider?: string;
    apiUrl?: string;
    apiKey?: string;
    businessNumber?: string;
    templates?: string;
  },
  token: string,
): Promise<AdminIntegrations["whatsapp"]> {
  return requestApi<AdminIntegrations["whatsapp"]>(
    "/api/superadmin/integrations/whatsapp",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminMaintenance(token: string): Promise<AdminMaintenance> {
  return request<AdminMaintenance>(
    "/api/superadmin/system/maintenance",
    {},
    token,
  );
}
export function saveAdminMaintenance(
  input: AdminMaintenance,
  token: string,
): Promise<AdminMaintenance> {
  return requestApi<AdminMaintenance>(
    "/api/superadmin/system/maintenance",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminBackups(token: string): Promise<AdminBackup[]> {
  return request<AdminBackup[]>("/api/superadmin/system/backups", {}, token);
}
export function createAdminBackup(token: string): Promise<AdminBackup> {
  return requestApi<AdminBackup>(
    "/api/superadmin/system/backups",
    { method: "POST" },
    token,
  );
}
export function restoreAdminBackup(
  id: string,
  token: string,
): Promise<{ message: string; fileName: string }> {
  return requestApi<{ message: string; fileName: string }>(
    `/api/superadmin/system/backups/${id}/restore`,
    { method: "POST", body: JSON.stringify({ confirm: true }) },
    token,
  );
}
export function getAdminBranches(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminBranch[]> {
  return request<AdminBranch[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/branches${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function createAdminBranch(
  input: {
    name: string;
    address: string;
    code?: string;
    phone?: string;
    email?: string;
    province?: string;
    district?: string;
    municipality?: string;
    ward?: string;
    streetTole?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    isActive: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminBranch> {
  return requestApi<AdminBranch>(
    `/api/${superAdmin ? "superadmin" : "admin"}/branches`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminBranch(
  id: string,
  input: {
    name: string;
    address: string;
    code?: string;
    phone?: string;
    email?: string;
    province?: string;
    district?: string;
    municipality?: string;
    ward?: string;
    streetTole?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    isActive: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminBranch> {
  return requestApi<AdminBranch>(
    `/api/${superAdmin ? "superadmin" : "admin"}/branches/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminSuppliers(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminSupplier[]> {
  return request<AdminSupplier[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/suppliers${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function createAdminSupplier(
  input: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
    isActive: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminSupplier> {
  return requestApi<AdminSupplier>(
    `/api/${superAdmin ? "superadmin" : "admin"}/suppliers`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminSupplier(
  id: string,
  input: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
    isActive: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminSupplier> {
  return requestApi<AdminSupplier>(
    `/api/${superAdmin ? "superadmin" : "admin"}/suppliers/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminTransporters(token: string, superAdmin = true, search?: string): Promise<AdminTransporter[]> {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return request<AdminTransporter[]>(`/api/${superAdmin ? "superadmin" : "admin"}/transporters${query}`, {}, token);
}
export function createAdminTransporter(input: Omit<AdminTransporter, "id" | "createdAt" | "updatedAt">, token: string, superAdmin = true): Promise<AdminTransporter> {
  return requestApi<AdminTransporter>(`/api/${superAdmin ? "superadmin" : "admin"}/transporters`, { method: "POST", body: JSON.stringify(input) }, token);
}
export function updateAdminTransporter(id: string, input: Omit<AdminTransporter, "id" | "createdAt" | "updatedAt">, token: string, superAdmin = true): Promise<AdminTransporter> {
  return requestApi<AdminTransporter>(`/api/${superAdmin ? "superadmin" : "admin"}/transporters/${id}`, { method: "PUT", body: JSON.stringify(input) }, token);
}
export function getAdminDeliveryZones(
  token: string,
  superAdmin = true,
  activeOnly = false,
): Promise<AdminDeliveryZone[]> {
  return request<AdminDeliveryZone[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/zones${activeOnly ? "?activeOnly=true" : ""}`,
    {},
    token,
  );
}
export function createAdminDeliveryZone(
  input: {
    name: string;
    province?: string;
    district?: string;
    municipality?: string;
    ward?: string;
    branchId?: string;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    minimumOrder: number;
    sameDayDelivery: boolean;
    enabled: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminDeliveryZone> {
  return requestApi<AdminDeliveryZone>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/zones`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminDeliveryZone(
  id: string,
  input: {
    name: string;
    province?: string;
    district?: string;
    municipality?: string;
    ward?: string;
    branchId?: string;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    minimumOrder: number;
    sameDayDelivery: boolean;
    enabled: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminDeliveryZone> {
  return requestApi<AdminDeliveryZone>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/zones/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminDeliverySlots(
  token: string,
  superAdmin = true,
): Promise<AdminDeliverySlot[]> {
  return request<AdminDeliverySlot[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/slots`,
    {},
    token,
  );
}
export function createAdminDeliverySlot(
  input: {
    label: string;
    startTime: string;
    endTime: string;
    branchId?: string;
    maxOrders?: number;
    displayOrder: number;
    enabled: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminDeliverySlot> {
  return requestApi<AdminDeliverySlot>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/slots`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminDeliverySlot(
  id: string,
  input: {
    label: string;
    startTime: string;
    endTime: string;
    branchId?: string;
    maxOrders?: number;
    displayOrder: number;
    enabled: boolean;
  },
  token: string,
  superAdmin = true,
): Promise<AdminDeliverySlot> {
  return requestApi<AdminDeliverySlot>(
    `/api/${superAdmin ? "superadmin" : "admin"}/delivery/slots/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminHomepageSections(
  token: string,
  superAdmin = true,
): Promise<AdminHomepageSection[]> {
  return request<AdminHomepageSection[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/homepage/sections`,
    {},
    token,
  );
}
export function updateAdminHomepageSection(
  id: string,
  input: Omit<AdminHomepageSection, "id">,
  token: string,
  superAdmin = true,
): Promise<AdminHomepageSection> {
  return requestApi<AdminHomepageSection>(
    `/api/${superAdmin ? "superadmin" : "admin"}/homepage/sections/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminWebsiteAssets(
  token: string,
): Promise<AdminWebsiteAsset[]> {
  return request<AdminWebsiteAsset[]>(
    "/api/superadmin/website/assets",
    {},
    token,
  );
}
export function createAdminWebsiteAsset(
  input: Omit<AdminWebsiteAsset, "id">,
  token: string,
): Promise<AdminWebsiteAsset> {
  return requestApi<AdminWebsiteAsset>(
    "/api/superadmin/website/assets",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminHeroSlides(token: string, superAdmin = true): Promise<AdminHeroSlide[]> {
  return request<AdminHeroSlide[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides`,
    {},
    token,
  );
}
export function getAdminHeroSlide(
  id: string,
  token: string,
  superAdmin = true,
): Promise<AdminHeroSlide> {
  return request<AdminHeroSlide>(
    `/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides/${id}`,
    {},
    token,
  );
}
export function createAdminHeroSlide(
  input: UpsertHeroSlideInput,
  token: string,
  superAdmin = true,
): Promise<AdminHeroSlide> {
  return requestApi<AdminHeroSlide>(
    `/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminHeroSlide(
  id: string,
  input: UpsertHeroSlideInput,
  token: string,
  superAdmin = true,
): Promise<AdminHeroSlide> {
  return requestApi<AdminHeroSlide>(
    `/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function deleteAdminHeroSlide(id: string, token: string, superAdmin = true): Promise<void> {
  return requestApi<void>(
    `/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides/${id}`,
    { method: "DELETE" },
    token,
  );
}
export function reorderAdminHeroSlides(
  slides: { id: string; displayOrder: number }[],
  token: string,
  superAdmin = true,
): Promise<AdminHeroSlide[]> {
  return requestApi<AdminHeroSlide[]>(
    `/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides/reorder`,
    { method: "PUT", body: JSON.stringify({ slides }) },
    token,
  );
}

export function uploadAdminHeroVideo(
  file: File,
  altText: string,
  token: string,
  superAdmin: boolean,
  onProgress: (percent: number) => void,
): Promise<AdminMediaAsset> {
  const form = new FormData();
  form.append("file", file);
  form.append("altText", altText);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/${superAdmin ? "superadmin" : "admin"}/website/hero-slides/video`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";
    xhr.timeout = 3 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      const payload = xhr.response as (AdminMediaAsset & { message?: string; title?: string }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && payload?.url) {
        onProgress(100);
        resolve(payload);
        return;
      }
      reject(new Error(payload?.message ?? payload?.title ?? (xhr.status === 413
        ? "Video is too large for the server. Choose a smaller file."
        : xhr.status === 401
          ? "Your session has expired. Please sign in again."
          : xhr.status === 403
            ? "You do not have permission to upload hero videos."
            : "The hero video could not be uploaded. Please try again.")));
    };
    xhr.onerror = () => reject(new Error("The video upload was interrupted. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The video upload timed out. Try a smaller video or a faster connection."));
    xhr.onabort = () => reject(new Error("The video upload was cancelled."));
    xhr.send(form);
  });
}
export function getAdminNavigation(
  token: string,
): Promise<AdminNavigationMenuItem[]> {
  return request<AdminNavigationMenuItem[]>(
    "/api/superadmin/website/navigation",
    {},
    token,
  );
}

export function getRoleSidebarConfig(
  role: string,
  token: string,
  superAdmin = false,
): Promise<AdminRoleSidebarMenuItem[]> {
  const scope = superAdmin ? "superadmin" : "admin";
  return request<AdminRoleSidebarMenuItem[]>(
    `/api/${scope}/sidebar-config?role=${encodeURIComponent(role)}`,
    {},
    token,
  );
}

export function saveRoleSidebarConfig(
  role: string,
  items: Array<Omit<AdminRoleSidebarMenuItem, "id" | "role">>,
  token: string,
): Promise<AdminRoleSidebarMenuItem[]> {
  return requestApi<AdminRoleSidebarMenuItem[]>(
    `/api/superadmin/sidebar-config/${encodeURIComponent(role)}`,
    { method: "PUT", body: JSON.stringify({ items }) },
    token,
  );
}
export function createAdminNavigation(
  input: Omit<AdminNavigationMenuItem, "id" | "updatedAt">,
  token: string,
): Promise<AdminNavigationMenuItem> {
  return requestApi<AdminNavigationMenuItem>(
    "/api/superadmin/website/navigation",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminNavigation(
  id: string,
  input: Omit<AdminNavigationMenuItem, "id" | "updatedAt">,
  token: string,
): Promise<AdminNavigationMenuItem> {
  return requestApi<AdminNavigationMenuItem>(
    `/api/superadmin/website/navigation/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function hideAdminNavigation(id: string, token: string): Promise<void> {
  return requestApi<void>(
    `/api/superadmin/website/navigation/${id}`,
    { method: "DELETE" },
    token,
  );
}
export function getAdminPopups(token: string): Promise<AdminPopupCampaign[]> {
  return request<AdminPopupCampaign[]>(
    "/api/superadmin/website/popups",
    {},
    token,
  );
}
export function createAdminPopup(
  input: Omit<AdminPopupCampaign, "id" | "updatedAt">,
  token: string,
): Promise<AdminPopupCampaign> {
  return requestApi<AdminPopupCampaign>(
    "/api/superadmin/website/popups",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminPopup(
  id: string,
  input: Omit<AdminPopupCampaign, "id" | "updatedAt">,
  token: string,
): Promise<AdminPopupCampaign> {
  return requestApi<AdminPopupCampaign>(
    `/api/superadmin/website/popups/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function deactivateAdminPopup(id: string, token: string): Promise<void> {
  return requestApi<void>(
    `/api/superadmin/website/popups/${id}`,
    { method: "DELETE" },
    token,
  );
}
export function getAdminSeo(token: string): Promise<AdminSeoEntry[]> {
  return request<AdminSeoEntry[]>("/api/superadmin/website/seo", {}, token);
}
export function createAdminSeo(
  input: Omit<AdminSeoEntry, "id" | "updatedAt">,
  token: string,
): Promise<AdminSeoEntry> {
  return requestApi<AdminSeoEntry>(
    "/api/superadmin/website/seo",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminSeo(
  id: string,
  input: Omit<AdminSeoEntry, "id" | "updatedAt">,
  token: string,
): Promise<AdminSeoEntry> {
  return requestApi<AdminSeoEntry>(
    `/api/superadmin/website/seo/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getAdminMedia(
  token: string,
  params: { search?: string; kind?: string } = {},
): Promise<AdminMediaAsset[]> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, value as string]),
  );
  return request<AdminMediaAsset[]>(
    `/api/superadmin/media?${query}`,
    {},
    token,
  );
}
export async function uploadAdminMedia(
  file: File,
  kind: string,
  altText: string,
  isPublic: boolean,
  token: string,
  superAdmin = true,
  onProgress?: (percent: number) => void,
): Promise<AdminMediaAsset> {
  const uploadFile = file;
  const body = new FormData();
  body.append("file", uploadFile);
  body.append("kind", kind);
  body.append("altText", altText);
  body.append("isPublic", String(isPublic));
  const path = `/api/${superAdmin ? "superadmin" : "admin"}/media`;
  return onProgress
    ? requestFormWithProgress<AdminMediaAsset>(path, body, token, onProgress)
    : requestApi<AdminMediaAsset>(path, { method: "POST", body }, token);
}
export function deactivateAdminMedia(id: string, token: string): Promise<void> {
  return requestApi<void>(
    `/api/superadmin/media/${id}`,
    { method: "DELETE" },
    token,
  );
}
export function getAdminCmsPages(token: string): Promise<AdminCmsPage[]> {
  return request<AdminCmsPage[]>("/api/superadmin/cms/pages", {}, token);
}
export function createAdminCmsPage(
  input: Omit<AdminCmsPage, "id">,
  token: string,
): Promise<AdminCmsPage> {
  return requestApi<AdminCmsPage>(
    "/api/superadmin/cms/pages",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}
export function updateAdminCmsPage(
  id: string,
  input: Omit<AdminCmsPage, "id">,
  token: string,
): Promise<AdminCmsPage> {
  return requestApi<AdminCmsPage>(
    `/api/superadmin/cms/pages/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}
export function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  return request<PublicSiteConfig>("/api/site/config");
}
export function getPublicCmsPage(
  slug: string,
): Promise<
  Pick<
    AdminCmsPage,
    | "slug"
    | "title"
    | "content"
    | "seoTitle"
    | "metaDescription"
    | "publishedAt"
  >
> {
  return request(`/api/site/pages/${encodeURIComponent(slug)}`);
}

export function getTrendingProducts(): Promise<TrendingProduct[]> {
  const token = typeof window === "undefined" ? undefined : window.localStorage.getItem("anhh-access-token") ?? undefined;
  return request<TrendingProduct[]>("/api/catalog/trending", {}, token);
}
export function getHotDealProducts(): Promise<TrendingProduct[]> {
  // Hot deals are an optional homepage section. A rolling deployment may still
  // have the previous backend binary, so an unavailable endpoint must not blank
  // or error the rest of the storefront.
  const token = typeof window === "undefined" ? undefined : window.localStorage.getItem("anhh-access-token") ?? undefined;
  return request<TrendingProduct[]>("/api/catalog/hot-deals", {}, token).catch(() => []);
}
export function getProducts(
  params: Record<string, string | number | boolean | undefined> = {},
  signal?: AbortSignal,
): Promise<ProductPage> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  const token =
    typeof window === "undefined"
      ? undefined
      : (window.localStorage.getItem("anhh-access-token") ?? undefined);
  return request<ProductPage>(
    `/api/products?${query.toString()}`,
    { signal },
    token,
  );
}
export function getProductBySlug(
  slugOrId: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  const token =
    typeof window === "undefined"
      ? undefined
      : (window.localStorage.getItem("anhh-access-token") ?? undefined);
  return request<ProductDetail>(
    `/api/products/${encodeURIComponent(slugOrId)}`,
    { signal },
    token,
  );
}
export function getCatalogCategories(
  signal?: AbortSignal,
): Promise<CatalogCategory[]> {
  return request<CatalogCategory[]>("/api/catalog/categories", { signal });
}
export function getCatalogBrands(
  categoryId?: string,
  signal?: AbortSignal,
): Promise<CatalogBrand[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return request<CatalogBrand[]>(`/api/catalog/brands${query}`, { signal });
}

export function createPrescription(
  file: File,
  note: string,
  token: string,
  onProgress?: (percent: number) => void,
): Promise<Prescription> {
  const body = new FormData();
  body.append("file", file);
  if (note.trim()) body.append("customerNote", note.trim());
  return onProgress
    ? requestFormWithProgress<Prescription>("/api/prescriptions", body, token, onProgress)
    : request<Prescription>("/api/prescriptions", { method: "POST", body }, token);
}
export function uploadPrescriptionClarification(
  id: string,
  file: File,
  note: string,
  token: string,
  onProgress?: (percent: number) => void,
): Promise<Prescription> {
  const body = new FormData();
  body.append("file", file);
  if (note.trim()) body.append("customerNote", note.trim());
  const path = `/api/prescriptions/${id}/clarification-upload`;
  return onProgress
    ? requestFormWithProgress<Prescription>(path, body, token, onProgress)
    : request<Prescription>(path, { method: "POST", body }, token);
}

export function getPrescriptions(token: string): Promise<Prescription[]> {
  return request<Prescription[]>("/api/prescriptions", {}, token);
}

export function getPrescription(
  id: string,
  token: string,
): Promise<Prescription> {
  return request<Prescription>(`/api/prescriptions/${id}`, {}, token);
}

export async function getPrescriptionFilePreview(
  id: string,
  token: string,
): Promise<string> {
  const response = await fetchWithNetworkHandling(
    `${API_BASE_URL}/api/prescriptions/${id}/file`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new ApiError(
      "The prescription file could not be loaded.",
      response.status,
    );
  return URL.createObjectURL(await response.blob());
}

export function submitPrescription(
  id: string,
  customerNote: string,
  token: string,
): Promise<Prescription> {
  return request<Prescription>(
    `/api/prescriptions/${id}/submit`,
    { method: "POST", body: JSON.stringify({ customerNote }) },
    token,
  );
}

export function updatePrescriptionItem(
  id: string,
  itemId: string,
  item: Omit<
    PrescriptionItem,
    "id" | "normalizedName" | "customerEdited" | "matches"
  >,
  token: string,
): Promise<Prescription> {
  return request<Prescription>(
    `/api/prescriptions/${id}/items/${itemId}`,
    { method: "PUT", body: JSON.stringify(item) },
    token,
  );
}

export function addPrescriptionItem(
  id: string,
  item: Omit<
    PrescriptionItem,
    "id" | "normalizedName" | "customerEdited" | "matches"
  >,
  token: string,
): Promise<Prescription> {
  return request<Prescription>(
    `/api/prescriptions/${id}/items`,
    { method: "POST", body: JSON.stringify(item) },
    token,
  );
}

export function deletePrescriptionItem(
  id: string,
  itemId: string,
  token: string,
): Promise<void> {
  return request<void>(
    `/api/prescriptions/${id}/items/${itemId}`,
    { method: "DELETE" },
    token,
  );
}

export { ApiError };

export function getCommerceBranches(token: string, superAdmin = false) {
  return requestApi<AdminBranch[]>(`${commercePath(superAdmin)}/branches`, {}, token);
}
