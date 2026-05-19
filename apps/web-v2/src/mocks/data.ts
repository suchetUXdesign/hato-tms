import { CRStatus, KeyStatus, Locale, UserRole, Platform } from '@hato-tms/shared'
import type {
  NamespaceDTO,
  TranslationKeyDTO,
  ChangeRequestDTO,
  UserDTO,
} from '@hato-tms/shared'

const NOW = new Date().toISOString()
const YESTERDAY = new Date(Date.now() - 86400000).toISOString()

export const mockUsers: UserDTO[] = [
  { id: 'user-1', email: 'admin@hato.com',      name: 'Admin User',    role: UserRole.ADMIN },
  { id: 'user-2', email: 'dev@hato.com',         name: 'Dev User',      role: UserRole.DEVELOPER },
  { id: 'user-3', email: 'reviewer@hato.com',    name: 'Reviewer User', role: UserRole.REVIEWER },
]

export const mockNamespaces: NamespaceDTO[] = [
  { id: 'ns-1', path: 'liff.dinein',   description: 'Dine-in LIFF app',   platforms: [Platform.LIFF],     keyCount: 12, createdAt: YESTERDAY, updatedAt: NOW },
  { id: 'ns-2', path: 'hs.checkout',   description: 'HS checkout flow',   platforms: [Platform.HS],       keyCount: 8,  createdAt: YESTERDAY, updatedAt: NOW },
  { id: 'ns-3', path: 'common.errors', description: 'Shared error texts', platforms: [Platform.COMMON],   keyCount: 5,  createdAt: YESTERDAY, updatedAt: NOW },
]

export const mockKeys: TranslationKeyDTO[] = [
  {
    id: 'key-1', namespaceId: 'ns-1', namespacePath: 'liff.dinein',
    keyName: 'confirmButton', fullKey: 'liff.dinein.confirmButton',
    description: 'Confirm order button', tags: ['button', 'action'], status: KeyStatus.TRANSLATED,
    platforms: [Platform.LIFF], createdBy: 'Admin User', createdAt: YESTERDAY, updatedAt: NOW,
    values: [
      { id: 'v-1', locale: Locale.TH, value: 'ยืนยัน', version: 1, updatedBy: 'Admin User', updatedAt: NOW },
      { id: 'v-2', locale: Locale.EN, value: 'Confirm', version: 1, updatedBy: 'Admin User', updatedAt: NOW },
    ],
  },
  {
    id: 'key-2', namespaceId: 'ns-1', namespacePath: 'liff.dinein',
    keyName: 'cancelButton', fullKey: 'liff.dinein.cancelButton',
    description: 'Cancel order button', tags: ['button'], status: KeyStatus.TRANSLATED,
    platforms: [Platform.LIFF], createdBy: 'Admin User', createdAt: YESTERDAY, updatedAt: NOW,
    values: [
      { id: 'v-3', locale: Locale.TH, value: 'ยกเลิก', version: 1, updatedBy: 'Admin User', updatedAt: NOW },
      { id: 'v-4', locale: Locale.EN, value: 'Cancel', version: 1, updatedBy: 'Admin User', updatedAt: NOW },
    ],
  },
  {
    id: 'key-3', namespaceId: 'ns-1', namespacePath: 'liff.dinein',
    keyName: 'welcomeMessage', fullKey: 'liff.dinein.welcomeMessage',
    description: 'Welcome message on home screen', tags: ['heading'], status: KeyStatus.PENDING,
    platforms: [Platform.LIFF], createdBy: 'Dev User', createdAt: YESTERDAY, updatedAt: NOW,
    values: [
      { id: 'v-5', locale: Locale.TH, value: 'ยินดีต้อนรับ', version: 1, updatedBy: 'Dev User', updatedAt: NOW },
    ],
  },
  {
    id: 'key-4', namespaceId: 'ns-2', namespacePath: 'hs.checkout',
    keyName: 'payNowButton', fullKey: 'hs.checkout.payNowButton',
    description: 'Pay now CTA', tags: ['button', 'payment'], status: KeyStatus.TRANSLATED,
    platforms: [Platform.HS], createdBy: 'Admin User', createdAt: YESTERDAY, updatedAt: NOW,
    values: [
      { id: 'v-6', locale: Locale.TH, value: 'ชำระเงินตอนนี้', version: 2, updatedBy: 'Admin User', updatedAt: NOW },
      { id: 'v-7', locale: Locale.EN, value: 'Pay Now', version: 2, updatedBy: 'Admin User', updatedAt: NOW },
    ],
  },
  {
    id: 'key-5', namespaceId: 'ns-2', namespacePath: 'hs.checkout',
    keyName: 'orderSummaryTitle', fullKey: 'hs.checkout.orderSummaryTitle',
    description: null, tags: [], status: KeyStatus.IN_REVIEW,
    platforms: [Platform.HS], createdBy: 'Dev User', createdAt: YESTERDAY, updatedAt: NOW,
    values: [
      { id: 'v-8', locale: Locale.TH, value: 'สรุปคำสั่งซื้อ', version: 1, updatedBy: 'Dev User', updatedAt: NOW },
      { id: 'v-9', locale: Locale.EN, value: 'Order Summary', version: 1, updatedBy: 'Dev User', updatedAt: NOW },
    ],
  },
  {
    id: 'key-6', namespaceId: 'ns-3', namespacePath: 'common.errors',
    keyName: 'networkError', fullKey: 'common.errors.networkError',
    description: 'Generic network error', tags: ['error'], status: KeyStatus.TRANSLATED,
    platforms: [Platform.COMMON], createdBy: 'Admin User', createdAt: YESTERDAY, updatedAt: NOW,
    values: [
      { id: 'v-10', locale: Locale.TH, value: 'เกิดข้อผิดพลาดทางเครือข่าย', version: 1, updatedBy: 'Admin User', updatedAt: NOW },
      { id: 'v-11', locale: Locale.EN, value: 'Network error occurred', version: 1, updatedBy: 'Admin User', updatedAt: NOW },
    ],
  },
]

export const mockChangeRequests: ChangeRequestDTO[] = [
  {
    id: 'cr-1', title: 'Update checkout button labels', status: CRStatus.PENDING,
    authorId: 'user-2', authorName: 'Dev User', reviewerIds: ['user-3'],
    items: [
      { id: 'item-1', keyId: 'key-4', fullKey: 'hs.checkout.payNowButton', locale: Locale.EN, oldValue: 'Pay Now', newValue: 'Pay Now (Updated)', comment: 'Clearer label' },
      { id: 'item-2', keyId: 'key-4', fullKey: 'hs.checkout.payNowButton', locale: Locale.TH, oldValue: 'ชำระเงินตอนนี้', newValue: 'ชำระเงิน', comment: null },
    ],
    createdAt: YESTERDAY, updatedAt: NOW,
  },
  {
    id: 'cr-2', title: 'Add welcome message translations', status: CRStatus.APPROVED,
    authorId: 'user-2', authorName: 'Dev User', reviewerIds: ['user-1', 'user-3'],
    items: [
      { id: 'item-3', keyId: 'key-3', fullKey: 'liff.dinein.welcomeMessage', locale: Locale.EN, oldValue: null, newValue: 'Welcome!', comment: 'New EN translation' },
    ],
    createdAt: YESTERDAY, updatedAt: NOW,
  },
  {
    id: 'cr-3', title: 'Fix network error message', status: CRStatus.PUBLISHED,
    authorId: 'user-1', authorName: 'Admin User', reviewerIds: ['user-3'],
    items: [
      { id: 'item-4', keyId: 'key-6', fullKey: 'common.errors.networkError', locale: Locale.EN, oldValue: 'Network error', newValue: 'Network error occurred', comment: null },
    ],
    createdAt: YESTERDAY, updatedAt: NOW,
  },
]

export const mockImportPreview = {
  added: [
    { key: 'liff.dinein.newFeatureLabel', th: 'ฟีเจอร์ใหม่', en: 'New Feature' },
  ],
  modified: [
    { key: 'liff.dinein.confirmButton', locale: Locale.TH, oldValue: 'ยืนยัน', newValue: 'ยืนยันคำสั่ง' },
  ],
  removed: [],
}
