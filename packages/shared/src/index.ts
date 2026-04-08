// ============================================================
// Hato TMS — Shared Types & Constants
// ============================================================

// ---- Enums ----

export enum Locale {
  TH = "th",
  EN = "en",
}

export enum KeyStatus {
  TRANSLATED = "translated",
  PENDING = "pending",
  IN_REVIEW = "in_review",
}

export enum CRStatus {
  DRAFT = "draft",
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  PUBLISHED = "published",
}

export enum UserRole {
  DEVELOPER = "developer",
  REVIEWER = "reviewer",
  ADMIN = "admin",
}

export enum Platform {
  HS = "HS",
  HH = "HH",
  LIFF = "LIFF",
  MERCHANT = "MERCHANT",
  FLEX = "FLEX",
  COMMON = "COMMON",
}

export enum AuditAction {
  KEY_CREATED = "key.created",
  KEY_UPDATED = "key.updated",
  KEY_DELETED = "key.deleted",
  KEY_RESTORED = "key.restored",
  VALUE_UPDATED = "value.updated",
  NAMESPACE_CREATED = "namespace.created",
  NAMESPACE_UPDATED = "namespace.updated",
  IMPORT_COMPLETED = "import.completed",
  EXPORT_COMPLETED = "export.completed",
  CR_CREATED = "cr.created",
  CR_APPROVED = "cr.approved",
  CR_REJECTED = "cr.rejected",
  CR_PUBLISHED = "cr.published",
}

// ---- Interfaces ----

export interface NamespaceDTO {
  id: string;
  path: string;
  description: string | null;
  platforms: Platform[];
  keyCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationKeyDTO {
  id: string;
  namespaceId: string;
  namespacePath: string;
  keyName: string;
  fullKey: string; // namespace.keyName
  description: string | null;
  tags: string[];
  status: KeyStatus;
  platforms: Platform[];
  values: TranslationValueDTO[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationValueDTO {
  id: string;
  locale: Locale;
  value: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface ChangeRequestDTO {
  id: string;
  title: string;
  status: CRStatus;
  authorId: string;
  authorName: string;
  reviewerIds: string[];
  items: CRItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CRItemDTO {
  id: string;
  keyId: string;
  fullKey: string;
  locale: Locale;
  oldValue: string | null;
  newValue: string;
  comment: string | null;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  apiToken?: string;
}

export interface AuditLogDTO {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  timestamp: string;
  diff: Record<string, unknown> | null;
}

// ---- API Request/Response types ----

export interface CreateKeyRequest {
  namespacePath: string;
  keyName: string;
  thValue: string;
  enValue: string;
  description?: string;
  tags?: string[];
  platforms?: Platform[];
}

export interface UpdateKeyRequest {
  keyName?: string;
  description?: string;
  tags?: string[];
  platforms?: Platform[];
}

export interface UpdateValueRequest {
  locale: Locale;
  value: string;
}

export interface ImportRequest {
  format: "json" | "csv";
  namespacePath: string;
  data: string; // file content
}

export interface ImportPreview {
  added: { key: string; th: string; en: string }[];
  modified: { key: string; locale: Locale; oldValue: string; newValue: string }[];
  removed: { key: string; th: string; en: string }[];
}

export interface ExportOptions {
  format: "json_nested" | "json_flat" | "csv";
  namespacePaths: string[];
  locales?: Locale[];
}

export interface CoverageStats {
  namespacePath: string;
  totalKeys: number;
  translatedTH: number;
  translatedEN: number;
  pending: number;
  coverageTH: number; // percentage
  coverageEN: number;
}

export interface SearchParams {
  query?: string;
  namespace?: string;
  status?: KeyStatus;
  platform?: Platform;
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: "key" | "updated" | "created";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- Key Naming Validation ----

export const KEY_NAME_REGEX = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
export const NAMESPACE_PATH_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

export function validateKeyName(name: string): boolean {
  return KEY_NAME_REGEX.test(name);
}

export function validateNamespacePath(path: string): boolean {
  return NAMESPACE_PATH_REGEX.test(path);
}

export function buildFullKey(namespacePath: string, keyName: string): string {
  return `${namespacePath}.${keyName}`;
}

// ---- TH/EN UI Translations for TMS itself ----

export const TMS_UI_TRANSLATIONS: Record<string, { en: string; th: string }> = {
  // ---- Sidebar / Navigation ----
  "nav.keys": { en: "Keys", th: "คีย์" },
  "nav.changeRequests": { en: "Change Requests", th: "คำขอเปลี่ยนแปลง" },
  "nav.coverage": { en: "Coverage", th: "ความครอบคลุม" },
  "nav.importExport": { en: "Import / Export", th: "นำเข้า / ส่งออก" },
  "nav.connections": { en: "Connections", th: "การเชื่อมต่อ" },
  "nav.users": { en: "Users", th: "ผู้ใช้งาน" },

  // ---- Keys Page ----
  "page.title": { en: "Translation Management", th: "การจัดการคำแปล" },
  "cta.newKey": { en: "New Key", th: "เพิ่มคีย์ใหม่" },
  "search.placeholder": { en: "Search keys, values, or tags...", th: "ค้นหาคีย์, ค่า, หรือแท็ก..." },
  "filter.namespace": { en: "Namespace", th: "เนมสเปซ" },
  "filter.status": { en: "Status", th: "สถานะ" },
  "filter.platform": { en: "Platform", th: "แพลตฟอร์ม" },
  "filter.tags": { en: "Tags", th: "แท็ก" },
  "col.key": { en: "Key", th: "คีย์" },
  "col.th": { en: "TH", th: "ไทย" },
  "col.en": { en: "EN", th: "อังกฤษ" },
  "col.status": { en: "Status", th: "สถานะ" },
  "col.tags": { en: "Tags", th: "แท็ก" },
  "col.lastUpdated": { en: "Last Updated", th: "แก้ไขล่าสุด" },
  "col.actions": { en: "Actions", th: "การดำเนินการ" },

  // ---- Key Detail ----
  "detail.fullKey": { en: "Full Key", th: "คีย์เต็ม" },
  "detail.description": { en: "Description", th: "คำอธิบาย" },
  "detail.platforms": { en: "Platforms", th: "แพลตฟอร์ม" },
  "detail.tags": { en: "Tags", th: "แท็ก" },
  "detail.none": { en: "None", th: "ไม่มี" },
  "detail.empty": { en: "(empty)", th: "(ว่าง)" },
  "detail.versionHistory": { en: "Version History", th: "ประวัติเวอร์ชัน" },
  "detail.keyCreated": { en: "Key created", th: "สร้างคีย์" },
  "detail.save": { en: "Save", th: "บันทึก" },
  "detail.saveAll": { en: "Save Changes", th: "บันทึกการแก้ไข" },
  "detail.cancel": { en: "Cancel", th: "ยกเลิก" },
  "detail.discard": { en: "Discard", th: "ยกเลิกการแก้ไข" },
  "detail.edit": { en: "Edit", th: "แก้ไข" },
  "detail.editing": { en: "Editing", th: "กำลังแก้ไข" },
  "detail.delete": { en: "Delete", th: "ลบ" },
  "detail.deleteConfirm": { en: "Delete this key?", th: "ลบคีย์นี้?" },
  "detail.deleteDesc": { en: "This will soft-delete the key. It can be restored later.", th: "คีย์จะถูกลบแบบชั่วคราว สามารถกู้คืนได้ภายหลัง" },
  "detail.addTag": { en: "Add tag...", th: "เพิ่มแท็ก..." },
  "detail.duplicateTag": { en: "Tag already exists", th: "แท็กนี้มีอยู่แล้ว" },
  "detail.noChanges": { en: "No changes to save", th: "ไม่มีการเปลี่ยนแปลง" },
  "detail.fieldChanged": { en: "changed", th: "เปลี่ยน" },
  "detail.from": { en: "from", th: "จาก" },
  "detail.to": { en: "to", th: "เป็น" },
  "detail.fieldsChanged": { en: "fields changed", th: "ฟิลด์ที่เปลี่ยน" },

  // ---- Status ----
  "status.translated": { en: "Translated", th: "แปลแล้ว" },
  "status.pending": { en: "Pending", th: "รอดำเนินการ" },
  "status.inReview": { en: "In Review", th: "อยู่ระหว่างรีวิว" },
  "status.approved": { en: "Approved", th: "อนุมัติแล้ว" },
  "status.rejected": { en: "Rejected", th: "ปฏิเสธแล้ว" },
  "status.published": { en: "Published", th: "เผยแพร่แล้ว" },
  "status.draft": { en: "Draft", th: "แบบร่าง" },

  // ---- Change Requests ----
  "cr.title": { en: "Change Requests", th: "คำขอเปลี่ยนแปลง" },
  "cr.createCR": { en: "Create CR", th: "สร้างคำขอ" },
  "col.crTitle": { en: "Title", th: "ชื่อ" },
  "col.author": { en: "Author", th: "ผู้สร้าง" },
  "col.changes": { en: "Changes", th: "รายการแก้ไข" },
  "col.created": { en: "Created", th: "สร้างเมื่อ" },
  "col.reviewers": { en: "Reviewers", th: "ผู้ตรวจสอบ" },
  "cr.approve": { en: "Approve", th: "อนุมัติ" },
  "cr.reject": { en: "Reject", th: "ปฏิเสธ" },
  "cr.publish": { en: "Publish Changes", th: "เผยแพร่" },
  "cr.reviewTitle": { en: "Review this Change Request", th: "ตรวจสอบคำขอเปลี่ยนแปลง" },
  "cr.rejectTitle": { en: "Reject Change Request", th: "ปฏิเสธคำขอเปลี่ยนแปลง" },
  "cr.rejectReason": { en: "Please provide a reason for rejecting this change request:", th: "กรุณาระบุเหตุผลในการปฏิเสธคำขอเปลี่ยนแปลง:" },
  "cr.rejectPlaceholder": { en: "Reason for rejection...", th: "เหตุผลในการปฏิเสธ..." },
  "cr.approvedBy": { en: "Approved by {name}", th: "อนุมัติโดย {name}" },
  "cr.rejectedBy": { en: "Rejected by {name}", th: "ปฏิเสธโดย {name}" },
  "cr.publishedBanner": { en: "All translation changes have been applied successfully.", th: "การเปลี่ยนแปลงคำแปลทั้งหมดถูกนำไปใช้เรียบร้อยแล้ว" },
  "cr.waitingApproval": { en: "Waiting for reviewer approval", th: "รอการอนุมัติจากผู้ตรวจสอบ" },
  "cr.waitingApprovalDesc": { en: "You cannot review your own change request. A reviewer must approve or reject it.", th: "คุณไม่สามารถตรวจสอบคำขอของตัวเองได้ ผู้ตรวจสอบต้องอนุมัติหรือปฏิเสธ" },
  "cr.approvedDesc": { en: "This change request has been approved. Click Publish to apply the new values to your translations.", th: "คำขอเปลี่ยนแปลงนี้ได้รับการอนุมัติแล้ว กดเผยแพร่เพื่อนำค่าใหม่ไปใช้" },
  "cr.backToList": { en: "Back to Change Requests", th: "กลับไปรายการคำขอ" },
  "cr.noneAssigned": { en: "None assigned", th: "ยังไม่ได้กำหนด" },
  "cr.items": { en: "{count} items", th: "{count} รายการ" },
  "cr.approvalPrompt": { en: "Approve this change request?", th: "อนุมัติคำขอเปลี่ยนแปลงนี้?" },
  "cr.changes": { en: "Changes", th: "รายการแก้ไข" },
  "col.locale": { en: "Locale", th: "ภาษา" },
  "col.oldValue": { en: "Old Value", th: "ค่าเดิม" },
  "col.newValue": { en: "New Value", th: "ค่าใหม่" },
  "col.comment": { en: "Comment", th: "ความคิดเห็น" },
  "cr.new": { en: "(new)", th: "(ใหม่)" },

  // ---- Create CR ----
  "createCR.title": { en: "Create Change Request", th: "สร้างคำขอเปลี่ยนแปลง" },
  "createCR.crTitle": { en: "Title", th: "ชื่อคำขอ" },
  "createCR.titlePlaceholder": { en: "e.g. Update menu translations", th: "เช่น แก้ไขคำแปลหน้าเมนู" },
  "createCR.selectKeys": { en: "Select Keys", th: "เลือกคีย์" },
  "createCR.selectKeysPlaceholder": { en: "Search and select keys to change", th: "ค้นหาและเลือกคีย์ที่ต้องการเปลี่ยน" },
  "createCR.reviewer": { en: "Reviewer", th: "ผู้ตรวจสอบ" },
  "createCR.submit": { en: "Submit Change Request", th: "ส่งคำขอเปลี่ยนแปลง" },

  // ---- Coverage ----
  "coverage.title": { en: "Translation Coverage", th: "ความครอบคลุมคำแปล" },

  // ---- Import/Export ----
  "action.import": { en: "Import", th: "นำเข้า" },
  "action.export": { en: "Export", th: "ส่งออก" },
  "import.title": { en: "Import Translations", th: "นำเข้าคำแปล" },
  "export.title": { en: "Export Translations", th: "ส่งออกคำแปล" },

  // ---- Connections ----
  "connections.title": { en: "Connections", th: "การเชื่อมต่อ" },
  "connections.subtitle": { en: "Pull translations into your projects", th: "ดึงคำแปลไปใช้ในโปรเจคของคุณ" },
  "connections.quickSetup": { en: "Quick Setup", th: "ตั้งค่าด่วน" },
  "connections.yourToken": { en: "Your API Token", th: "API Token ของคุณ" },

  // ---- Users ----
  "users.title": { en: "User Management", th: "จัดการผู้ใช้งาน" },
  "users.subtitle": { en: "Manage team members and their access levels", th: "จัดการสมาชิกทีมและระดับการเข้าถึง" },
  "users.invite": { en: "Invite User", th: "เชิญผู้ใช้" },
  "users.inviteTitle": { en: "Invite New User", th: "เชิญผู้ใช้ใหม่" },
  "users.editTitle": { en: "Edit User", th: "แก้ไขผู้ใช้" },
  "users.searchPlaceholder": { en: "Search by name or email...", th: "ค้นหาจากชื่อหรืออีเมล..." },
  "col.user": { en: "User", th: "ผู้ใช้" },
  "col.role": { en: "Role", th: "บทบาท" },
  "col.email": { en: "Email", th: "อีเมล" },
  "col.name": { en: "Name", th: "ชื่อ" },
  "users.you": { en: "You", th: "คุณ" },
  "users.active": { en: "Active", th: "ใช้งาน" },
  "users.inactive": { en: "Inactive", th: "ปิดใช้งาน" },
  "users.deactivate": { en: "Deactivate", th: "ปิดใช้งาน" },
  "users.activate": { en: "Activate", th: "เปิดใช้งาน" },
  "users.deactivateConfirm": { en: "Are you sure you want to deactivate {name}?", th: "คุณแน่ใจหรือไม่ว่าต้องการปิดใช้งาน {name}?" },
  "users.saveChanges": { en: "Save Changes", th: "บันทึกการเปลี่ยนแปลง" },
  "users.cannotChangeOwnRole": { en: "You cannot change your own role.", th: "คุณไม่สามารถเปลี่ยนบทบาทของตัวเองได้" },
  "users.cannotDeactivateSelf": { en: "Cannot deactivate yourself", th: "ไม่สามารถปิดใช้งานตัวเองได้" },
  "users.sendInvite": { en: "Invite User", th: "เชิญผู้ใช้" },

  // ---- Roles ----
  "role.admin": { en: "Admin", th: "ผู้ดูแลระบบ" },
  "role.editor": { en: "Editor", th: "ผู้แก้ไข" },
  "role.translator": { en: "Translator", th: "นักแปล" },
  "role.viewer": { en: "Viewer", th: "ผู้ดู" },
  "role.admin.desc": { en: "Full access", th: "เข้าถึงทั้งหมด" },
  "role.editor.desc": { en: "Create/edit keys", th: "สร้าง/แก้ไขคีย์" },
  "role.translator.desc": { en: "Edit translation values (TH/EN)", th: "แก้ไขค่าคำแปล (ไทย/อังกฤษ)" },
  "role.viewer.desc": { en: "View only", th: "ดูอย่างเดียว" },

  // ---- User Profile Dropdown ----
  "dropdown.apiToken": { en: "API Token", th: "API Token" },
  "dropdown.tokenHint": { en: "Use this token in Figma plugin or CLI", th: "ใช้ token นี้ใน Figma plugin หรือ CLI" },
  "dropdown.regenerate": { en: "Regenerate", th: "สร้างใหม่" },
  "dropdown.language": { en: "Language", th: "ภาษา" },
  "dropdown.theme": { en: "Theme", th: "ธีม" },
  "dropdown.logout": { en: "Logout", th: "ออกจากระบบ" },
  "dropdown.logoutConfirm": { en: "Are you sure you want to logout?", th: "คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?" },
  "dropdown.regenerateTitle": { en: "Regenerate API Token", th: "สร้าง API Token ใหม่" },
  "dropdown.regenerateDesc": { en: "This will invalidate your current token. Any integrations using it (Figma plugin, CLI, GitHub Action) will need to be updated.", th: "Token เดิมจะใช้ไม่ได้อีกต่อไป การเชื่อมต่อที่ใช้อยู่ (Figma plugin, CLI, GitHub Action) จะต้องอัปเดต" },

  // ---- Common ----
  "common.save": { en: "Save", th: "บันทึก" },
  "common.cancel": { en: "Cancel", th: "ยกเลิก" },
  "common.delete": { en: "Delete", th: "ลบ" },
  "common.edit": { en: "Edit", th: "แก้ไข" },
  "common.close": { en: "Close", th: "ปิด" },
  "common.back": { en: "Back", th: "กลับ" },
  "common.submit": { en: "Submit", th: "ส่ง" },
  "common.search": { en: "Search", th: "ค้นหา" },
  "common.noData": { en: "No data", th: "ไม่มีข้อมูล" },
  "common.loading": { en: "Loading...", th: "กำลังโหลด..." },
  "common.confirm": { en: "Confirm", th: "ยืนยัน" },
  "common.by": { en: "by", th: "โดย" },
  "common.on": { en: "on", th: "เมื่อ" },
  "common.keysSelected": { en: "{count} key(s) selected", th: "เลือก {count} คีย์" },

  // ---- Success Messages ----
  "success.keyCreated": { en: "Key created successfully!", th: "สร้างคีย์สำเร็จ!" },
  "success.valueSaved": { en: "Value saved successfully", th: "บันทึกค่าสำเร็จ" },
  "success.keyDeleted": { en: "Key deleted", th: "ลบคีย์แล้ว" },
  "success.importComplete": { en: "{count} keys imported successfully!", th: "นำเข้า {count} คีย์สำเร็จ!" },
  "success.crApproved": { en: "Change request approved", th: "อนุมัติคำขอเปลี่ยนแปลงแล้ว" },
  "success.crRejected": { en: "Change request rejected", th: "ปฏิเสธคำขอเปลี่ยนแปลงแล้ว" },
  "success.crPublished": { en: "Changes published \u2014 translations updated", th: "เผยแพร่แล้ว \u2014 คำแปลถูกอัปเดต" },
  "success.tokenCopied": { en: "Token copied!", th: "คัดลอก Token แล้ว!" },
  "success.tokenRegenerated": { en: "Token regenerated!", th: "สร้าง Token ใหม่แล้ว!" },
  "success.userInvited": { en: "User invited successfully", th: "เชิญผู้ใช้สำเร็จ" },
  "success.userUpdated": { en: "User updated", th: "อัปเดตผู้ใช้แล้ว" },
  "success.userDeactivated": { en: "User deactivated", th: "ปิดใช้งานผู้ใช้แล้ว" },
  "success.userActivated": { en: "User activated", th: "เปิดใช้งานผู้ใช้แล้ว" },
  "success.langSwitched": { en: "Language switched to {lang}", th: "เปลี่ยนภาษาเป็น{lang}" },
  "success.loggedIn": { en: "Logged in successfully", th: "เข้าสู่ระบบสำเร็จ" },

  // ---- Error Messages ----
  "error.duplicateKey": { en: "A key with this name already exists in this namespace.", th: "คีย์ชื่อนี้มีอยู่แล้วในเนมสเปซนี้" },
  "error.importFailed": { en: "Import failed. Check file format and try again.", th: "นำเข้าไม่สำเร็จ กรุณาตรวจสอบไฟล์แล้วลองใหม่" },
  "error.loginFailed": { en: "Login failed. Please check your email and try again.", th: "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลแล้วลองใหม่" },
  "error.loadFailed": { en: "Failed to load", th: "โหลดไม่สำเร็จ" },
  "error.saveFailed": { en: "Failed to save", th: "บันทึกไม่สำเร็จ" },
  "error.noToken": { en: "No API token found", th: "ไม่พบ API Token" },

  // ---- Diff ----
  "diff.added": { en: "Added", th: "เพิ่มใหม่" },
  "diff.modified": { en: "Modified", th: "แก้ไข" },
  "diff.removed": { en: "Removed", th: "ลบแล้ว" },

  // ---- Empty States ----
  "empty.noKeys": { en: "No translation keys yet. Create your first key to get started.", th: "ยังไม่มีคีย์คำแปล สร้างคีย์แรกเพื่อเริ่มต้น" },
  "empty.noCRs": { en: "No change requests yet.", th: "ยังไม่มีคำขอเปลี่ยนแปลง" },
  "empty.tokenNotFound": { en: "API token not found. Generate one in Settings to use the integrations above.", th: "ไม่พบ API Token สร้าง token ในหน้าตั้งค่าเพื่อใช้งานการเชื่อมต่อข้างบน" },

  // ---- Figma Plugin ----
  "figma.linkKey": { en: "Link to Key", th: "เชื่อมต่อ Key" },
  "figma.switchLang": { en: "Switch Language", th: "สลับภาษา" },

  // ---- Login ----
  "login.title": { en: "Hato TMS", th: "Hato TMS" },
  "login.subtitle": { en: "Translation Management System", th: "ระบบจัดการคำแปล" },
  "login.email": { en: "Email", th: "อีเมล" },
  "login.emailPlaceholder": { en: "you@example.com", th: "you@example.com" },
  "login.emailRequired": { en: "Please enter your email", th: "กรุณากรอกอีเมล" },
  "login.emailInvalid": { en: "Please enter a valid email", th: "กรุณากรอกอีเมลที่ถูกต้อง" },
  "login.signIn": { en: "Sign In", th: "เข้าสู่ระบบ" },

  // ---- Theme ----
  "theme.light": { en: "Light", th: "สว่าง" },
  "theme.dark": { en: "Dark", th: "มืด" },
  "theme.system": { en: "System", th: "ระบบ" },

  // ---- Coverage Page ----
  "coverage.totalKeys": { en: "Total Keys", th: "คีย์ทั้งหมด" },
  "coverage.thCoverage": { en: "TH Coverage", th: "ครอบคลุม TH" },
  "coverage.enCoverage": { en: "EN Coverage", th: "ครอบคลุม EN" },
  "coverage.namespaces": { en: "Namespaces", th: "เนมสเปซ" },
  "coverage.details": { en: "Details", th: "รายละเอียด" },
  "coverage.keys": { en: "{count} keys", th: "{count} คีย์" },
  "coverage.pendingCount": { en: "{count} pending", th: "{count} รอดำเนินการ" },
  "coverage.missingKeys": { en: "Missing Keys — {ns}", th: "คีย์ที่ขาด — {ns}" },
  "coverage.missing": { en: "Missing", th: "ขาด" },
  "coverage.ok": { en: "OK", th: "มี" },
  "coverage.loadFailed": { en: "Failed to load coverage data", th: "โหลดข้อมูลความครอบคลุมไม่สำเร็จ" },

  // ---- Import/Export Page ----
  "import.upload": { en: "Upload", th: "อัปโหลด" },
  "import.previewDiff": { en: "Preview Diff", th: "ตรวจสอบความแตกต่าง" },
  "import.confirmStep": { en: "Confirm", th: "ยืนยัน" },
  "import.selectNamespace": { en: "Select namespace", th: "เลือกเนมสเปซ" },
  "import.uploadHint": { en: "Click or drag file to upload", th: "คลิกหรือลากไฟล์เพื่ออัปโหลด" },
  "import.uploadDesc": { en: "Supports JSON and CSV formats", th: "รองรับไฟล์ JSON และ CSV" },
  "import.previewChanges": { en: "Preview Changes", th: "ตรวจสอบการเปลี่ยนแปลง" },
  "import.keysCount": { en: "{count} keys", th: "{count} คีย์" },
  "import.valuesCount": { en: "{count} values", th: "{count} ค่า" },
  "import.confirmApply": { en: "Confirm & Apply", th: "ยืนยันและนำไปใช้" },
  "import.complete": { en: "Import Complete", th: "นำเข้าสำเร็จ" },
  "import.completeDesc": { en: "Changes have been applied to namespace \"{ns}\".", th: "การเปลี่ยนแปลงถูกนำไปใช้ในเนมสเปซ \"{ns}\" แล้ว" },
  "import.importMore": { en: "Import More", th: "นำเข้าเพิ่มเติม" },
  "export.format": { en: "Format", th: "รูปแบบ" },
  "export.jsonNested": { en: "JSON Nested", th: "JSON Nested" },
  "export.jsonFlat": { en: "JSON Flat", th: "JSON Flat" },
  "export.csv": { en: "CSV", th: "CSV" },
  "export.locales": { en: "Locales", th: "ภาษา" },
  "export.thLabel": { en: "Thai (TH)", th: "ไทย (TH)" },
  "export.enLabel": { en: "English (EN)", th: "อังกฤษ (EN)" },
  "export.download": { en: "Download", th: "ดาวน์โหลด" },
  "export.downloaded": { en: "Export downloaded", th: "ส่งออกสำเร็จ" },
  "export.failed": { en: "Export failed", th: "ส่งออกไม่สำเร็จ" },

  // ---- Create Key Modal ----
  "createKey.keyName": { en: "Key Name", th: "ชื่อคีย์" },
  "createKey.thValue": { en: "Thai Value (TH)", th: "ค่าภาษาไทย (TH)" },
  "createKey.enValue": { en: "English Value (EN)", th: "ค่าภาษาอังกฤษ (EN)" },
  "createKey.create": { en: "Create", th: "สร้าง" },
  "createKey.nsPlaceholder": { en: "e.g. common, hs.home", th: "เช่น common, hs.home" },
  "createKey.keyPlaceholder": { en: "e.g. welcomeMessage", th: "เช่น welcomeMessage" },
  "createKey.thPlaceholder": { en: "Thai translation", th: "คำแปลภาษาไทย" },
  "createKey.enPlaceholder": { en: "English translation", th: "คำแปลภาษาอังกฤษ" },
  "createKey.nsRequired": { en: "Namespace is required", th: "กรุณาระบุเนมสเปซ" },
  "createKey.keyRequired": { en: "Key name is required", th: "กรุณาระบุชื่อคีย์" },
  "createKey.thRequired": { en: "Thai value is required", th: "กรุณาระบุค่าภาษาไทย" },
  "createKey.enRequired": { en: "English value is required", th: "กรุณาระบุค่าภาษาอังกฤษ" },
  "createKey.keyInvalid": { en: "Key must start with lowercase letter, use camelCase (a-z, A-Z, 0-9)", th: "คีย์ต้องขึ้นต้นด้วยตัวพิมพ์เล็ก ใช้ camelCase (a-z, A-Z, 0-9)" },
  "createKey.moreOptions": { en: "More Options", th: "ตัวเลือกเพิ่มเติม" },
  "createKey.lessOptions": { en: "Less Options", th: "ตัวเลือกน้อยลง" },
  "createKey.descPlaceholder": { en: "Optional description for this key", th: "คำอธิบาย (ไม่จำเป็น)" },
  "createKey.addTags": { en: "Add tags", th: "เพิ่มแท็ก" },
  "createKey.platformScope": { en: "Platform Scope", th: "ขอบเขตแพลตฟอร์ม" },

  // ---- Create CR Page ----
  "createCR.selectKeyFirst": { en: "Please select a key first", th: "กรุณาเลือกคีย์ก่อน" },
  "createCR.alreadyAdded": { en: "{key} ({locale}) is already added", th: "{key} ({locale}) ถูกเพิ่มแล้ว" },
  "createCR.created": { en: "Change request created", th: "สร้างคำขอเปลี่ยนแปลงแล้ว" },
  "createCR.failed": { en: "Failed to create change request", th: "สร้างคำขอเปลี่ยนแปลงไม่สำเร็จ" },
  "createCR.currentValue": { en: "Current Value", th: "ค่าปัจจุบัน" },
  "createCR.newValuePlaceholder": { en: "Enter new value…", th: "ระบุค่าใหม่…" },
  "createCR.commentPlaceholder": { en: "Optional note…", th: "หมายเหตุ (ไม่จำเป็น)…" },
  "createCR.noChanges": { en: "No changes added yet. Select a key above and click Add.", th: "ยังไม่มีรายการเปลี่ยนแปลง เลือกคีย์ด้านบนแล้วกด เพิ่ม" },
  "createCR.addBtn": { en: "Add", th: "เพิ่ม" },
  "createCR.changesCount": { en: "Changes ({count})", th: "รายการแก้ไข ({count})" },
  "createCR.searchKey": { en: "Search and select a key…", th: "ค้นหาและเลือกคีย์…" },
  "createCR.reviewers": { en: "Reviewers", th: "ผู้ตรวจสอบ" },
  "createCR.reviewerPlaceholder": { en: "Select reviewers (optional)", th: "เลือกผู้ตรวจสอบ (ไม่จำเป็น)" },

  // ---- Additional Common ----
  "common.retry": { en: "Retry", th: "ลองใหม่" },
  "common.clear": { en: "Clear", th: "ล้าง" },
  "common.all": { en: "All", th: "ทั้งหมด" },

  // ---- Additional Error Messages ----
  "error.loadKeys": { en: "Failed to load keys", th: "โหลดคีย์ไม่สำเร็จ" },
  "error.loadKeysDesc": { en: "Please check your connection and try again.", th: "กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่" },
  "error.loadCR": { en: "Failed to load change requests", th: "โหลดคำขอเปลี่ยนแปลงไม่สำเร็จ" },
  "error.loadCRDetail": { en: "Failed to load change request", th: "โหลดรายละเอียดคำขอเปลี่ยนแปลงไม่สำเร็จ" },
  "error.deleteFailed": { en: "Failed to delete some keys", th: "ลบคีย์บางรายการไม่สำเร็จ" },
  "error.approveFailed": { en: "Failed to approve", th: "อนุมัติไม่สำเร็จ" },
  "error.rejectFailed": { en: "Failed to reject", th: "ปฏิเสธไม่สำเร็จ" },
  "error.publishFailed": { en: "Failed to publish", th: "เผยแพร่ไม่สำเร็จ" },
  "error.updateValue": { en: "Failed to update value", th: "อัปเดตค่าไม่สำเร็จ" },
  "error.deleteKey": { en: "Failed to delete key", th: "ลบคีย์ไม่สำเร็จ" },
  "error.regenFailed": { en: "Failed to regenerate token", th: "สร้าง Token ใหม่ไม่สำเร็จ" },
  "error.sessionExpired": { en: "Session expired. Please log in again.", th: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" },

  // ---- Additional Success Messages ----
  "success.keysDeleted": { en: "{count} key(s) deleted", th: "ลบ {count} คีย์แล้ว" },

  // ---- Key List ----
  "keys.noMatch": { en: "No keys match your filters.", th: "ไม่มีคีย์ตรงกับตัวกรอง" },
  "keys.total": { en: "{count} keys", th: "{count} คีย์" },
  "keys.keysSelected": { en: "{count} key(s) selected", th: "เลือก {count} คีย์" },

  // ---- CR ----
  "cr.total": { en: "{count} change requests", th: "{count} คำขอเปลี่ยนแปลง" },
  "cr.approvedOtherDesc": { en: "This change request has been approved. The author can publish it to apply the changes.", th: "คำขอเปลี่ยนแปลงนี้ได้รับการอนุมัติแล้ว ผู้สร้างสามารถเผยแพร่เพื่อนำการเปลี่ยนแปลงไปใช้" },
  "cr.rejectedDesc": { en: "This change request was rejected by {name}.", th: "คำขอเปลี่ยนแปลงนี้ถูกปฏิเสธโดย {name}" },

  // ---- Sidebar Footer ----
  "app.subtitle": { en: "Hato Translation Management", th: "ระบบจัดการคำแปล Hato" },
  "app.noToken": { en: "No token", th: "ไม่มี token" },
};
