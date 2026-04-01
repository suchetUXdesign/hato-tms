import { PrismaClient, UserRole, Platform, KeyStatus, Locale, CRStatus } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Hato TMS database...\n");

  // ---- Users ----
  const admin = await prisma.user.upsert({
    where: { email: "admin@hato.co" },
    update: {},
    create: {
      email: "admin@hato.co",
      name: "Admin",
      role: UserRole.ADMIN,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  const dev1 = await prisma.user.upsert({
    where: { email: "dev1@hato.co" },
    update: {},
    create: {
      email: "dev1@hato.co",
      name: "Somchai Dev",
      role: UserRole.EDITOR,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  const dev2 = await prisma.user.upsert({
    where: { email: "dev2@hato.co" },
    update: {},
    create: {
      email: "dev2@hato.co",
      name: "Siriporn Dev",
      role: UserRole.EDITOR,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@hato.co" },
    update: {},
    create: {
      email: "reviewer@hato.co",
      name: "Nattapong Reviewer",
      role: UserRole.EDITOR,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  // Extra demo users for different roles
  await prisma.user.upsert({
    where: { email: "translator@hato.co" },
    update: {},
    create: {
      email: "translator@hato.co",
      name: "Pimchanok Translator",
      role: UserRole.TRANSLATOR,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@hato.co" },
    update: {},
    create: {
      email: "viewer@hato.co",
      name: "Kanokwan Viewer",
      role: UserRole.VIEWER,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  const suchet = await prisma.user.upsert({
    where: { email: "suchet@indiedish.co" },
    update: { role: UserRole.ADMIN },
    create: {
      email: "suchet@indiedish.co",
      name: "Suchet",
      role: UserRole.ADMIN,
      apiToken: crypto.randomBytes(32).toString("hex"),
    },
  });

  console.log(`  ✓ Created ${5} users`);

  // ---- Namespaces ----
  const namespaces = await Promise.all([
    prisma.namespace.upsert({
      where: { path: "common.auth" },
      update: {},
      create: { path: "common.auth", description: "Shared authentication strings", platforms: [Platform.COMMON] },
    }),
    prisma.namespace.upsert({
      where: { path: "common.navigation" },
      update: {},
      create: { path: "common.navigation", description: "Shared navigation labels", platforms: [Platform.COMMON] },
    }),
    prisma.namespace.upsert({
      where: { path: "common.errors" },
      update: {},
      create: { path: "common.errors", description: "Common error messages", platforms: [Platform.COMMON] },
    }),
    prisma.namespace.upsert({
      where: { path: "liff.dinein.menu" },
      update: {},
      create: { path: "liff.dinein.menu", description: "Dine-in menu feature", platforms: [Platform.LIFF] },
    }),
    prisma.namespace.upsert({
      where: { path: "liff.dinein.cart" },
      update: {},
      create: { path: "liff.dinein.cart", description: "Dine-in cart feature", platforms: [Platform.LIFF] },
    }),
    prisma.namespace.upsert({
      where: { path: "liff.delivery.tracking" },
      update: {},
      create: { path: "liff.delivery.tracking", description: "Delivery tracking", platforms: [Platform.LIFF] },
    }),
    prisma.namespace.upsert({
      where: { path: "hs.orders" },
      update: {},
      create: { path: "hs.orders", description: "HS back-office order management", platforms: [Platform.HS] },
    }),
    prisma.namespace.upsert({
      where: { path: "hs.dashboard" },
      update: {},
      create: { path: "hs.dashboard", description: "HS back-office dashboard", platforms: [Platform.HS] },
    }),
    prisma.namespace.upsert({
      where: { path: "hh.settings" },
      update: {},
      create: { path: "hh.settings", description: "HH back-office settings", platforms: [Platform.HH] },
    }),
    prisma.namespace.upsert({
      where: { path: "merchant.kitchen" },
      update: {},
      create: { path: "merchant.kitchen", description: "Merchant kitchen display", platforms: [Platform.MERCHANT] },
    }),
    prisma.namespace.upsert({
      where: { path: "flex.notification" },
      update: {},
      create: { path: "flex.notification", description: "LINE Flex Message notifications", platforms: [Platform.FLEX] },
    }),
  ]);

  console.log(`  ✓ Created ${namespaces.length} namespaces`);

  // ---- Translation Keys + Values ----
  const keyData: {
    nsPath: string;
    keyName: string;
    th: string;
    en: string;
    desc?: string;
    tags?: string[];
    status?: KeyStatus;
  }[] = [
    // common.auth
    { nsPath: "common.auth", keyName: "loginTitle", th: "เข้าสู่ระบบ", en: "Sign In", desc: "Login page title", tags: ["auth"] },
    { nsPath: "common.auth", keyName: "loginButton", th: "เข้าสู่ระบบ", en: "Sign In", tags: ["auth", "cta"] },
    { nsPath: "common.auth", keyName: "logoutButton", th: "ออกจากระบบ", en: "Sign Out", tags: ["auth", "cta"] },
    { nsPath: "common.auth", keyName: "emailPlaceholder", th: "กรอกอีเมล", en: "Enter your email", tags: ["auth"] },
    { nsPath: "common.auth", keyName: "passwordPlaceholder", th: "กรอกรหัสผ่าน", en: "Enter your password", tags: ["auth"] },
    { nsPath: "common.auth", keyName: "forgotPassword", th: "ลืมรหัสผ่าน?", en: "Forgot password?", tags: ["auth"] },
    { nsPath: "common.auth", keyName: "rememberMe", th: "จดจำฉัน", en: "Remember me", tags: ["auth"] },

    // common.navigation
    { nsPath: "common.navigation", keyName: "home", th: "หน้าหลัก", en: "Home", tags: ["navigation"] },
    { nsPath: "common.navigation", keyName: "orders", th: "รายการสั่งซื้อ", en: "Orders", tags: ["navigation"] },
    { nsPath: "common.navigation", keyName: "menu", th: "เมนู", en: "Menu", tags: ["navigation"] },
    { nsPath: "common.navigation", keyName: "settings", th: "ตั้งค่า", en: "Settings", tags: ["navigation"] },
    { nsPath: "common.navigation", keyName: "profile", th: "โปรไฟล์", en: "Profile", tags: ["navigation"] },
    { nsPath: "common.navigation", keyName: "notifications", th: "การแจ้งเตือน", en: "Notifications", tags: ["navigation"] },
    { nsPath: "common.navigation", keyName: "help", th: "ช่วยเหลือ", en: "Help", tags: ["navigation"] },

    // common.errors
    { nsPath: "common.errors", keyName: "genericError", th: "เกิดข้อผิดพลาด กรุณาลองใหม่", en: "Something went wrong. Please try again.", tags: ["error"] },
    { nsPath: "common.errors", keyName: "networkError", th: "ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต", en: "Unable to connect. Please check your internet.", tags: ["error"] },
    { nsPath: "common.errors", keyName: "notFound", th: "ไม่พบหน้าที่คุณต้องการ", en: "Page not found.", tags: ["error"] },
    { nsPath: "common.errors", keyName: "unauthorized", th: "กรุณาเข้าสู่ระบบ", en: "Please sign in to continue.", tags: ["error", "auth"] },
    { nsPath: "common.errors", keyName: "forbidden", th: "คุณไม่มีสิทธิ์เข้าถึง", en: "You don't have permission to access this.", tags: ["error"] },

    // liff.dinein.menu
    { nsPath: "liff.dinein.menu", keyName: "addToCart", th: "เพิ่มลงตะกร้า", en: "Add to Cart", tags: ["cta", "menu"], desc: "Add item to cart button" },
    { nsPath: "liff.dinein.menu", keyName: "menuTitle", th: "เมนูอาหาร", en: "Food Menu", tags: ["menu"] },
    { nsPath: "liff.dinein.menu", keyName: "searchMenu", th: "ค้นหาเมนู...", en: "Search menu...", tags: ["menu"] },
    { nsPath: "liff.dinein.menu", keyName: "popular", th: "ยอดนิยม", en: "Popular", tags: ["menu"] },
    { nsPath: "liff.dinein.menu", keyName: "recommended", th: "แนะนำ", en: "Recommended", tags: ["menu"] },
    { nsPath: "liff.dinein.menu", keyName: "outOfStock", th: "สินค้าหมด", en: "Out of Stock", tags: ["menu", "error"] },
    { nsPath: "liff.dinein.menu", keyName: "customizeOrder", th: "ปรับแต่งรายการ", en: "Customize Order", tags: ["menu"] },
    { nsPath: "liff.dinein.menu", keyName: "specialInstructions", th: "คำขอพิเศษ", en: "Special Instructions", tags: ["menu"] },
    { nsPath: "liff.dinein.menu", keyName: "allergyWarning", th: "ข้อมูลสารก่อภูมิแพ้", en: "Allergy Information", tags: ["menu"] },

    // liff.dinein.cart
    { nsPath: "liff.dinein.cart", keyName: "cartTitle", th: "ตะกร้าสินค้า", en: "Your Cart", tags: ["cart"] },
    { nsPath: "liff.dinein.cart", keyName: "emptyCart", th: "ตะกร้าว่างเปล่า", en: "Your cart is empty", tags: ["cart"] },
    { nsPath: "liff.dinein.cart", keyName: "totalPrice", th: "ราคารวม", en: "Total", tags: ["cart"] },
    { nsPath: "liff.dinein.cart", keyName: "placeOrder", th: "สั่งอาหาร", en: "Place Order", tags: ["cart", "cta"] },
    { nsPath: "liff.dinein.cart", keyName: "removeItem", th: "ลบรายการ", en: "Remove", tags: ["cart"] },
    { nsPath: "liff.dinein.cart", keyName: "quantity", th: "จำนวน", en: "Quantity", tags: ["cart"] },
    { nsPath: "liff.dinein.cart", keyName: "orderNote", th: "หมายเหตุคำสั่งซื้อ", en: "Order Notes", tags: ["cart"] },

    // liff.delivery.tracking
    { nsPath: "liff.delivery.tracking", keyName: "trackingTitle", th: "ติดตามคำสั่งซื้อ", en: "Track Your Order", tags: ["delivery"] },
    { nsPath: "liff.delivery.tracking", keyName: "preparing", th: "กำลังเตรียมอาหาร", en: "Preparing your food", tags: ["delivery", "status"] },
    { nsPath: "liff.delivery.tracking", keyName: "onTheWay", th: "กำลังจัดส่ง", en: "On the way", tags: ["delivery", "status"] },
    { nsPath: "liff.delivery.tracking", keyName: "delivered", th: "จัดส่งแล้ว", en: "Delivered", tags: ["delivery", "status"] },
    { nsPath: "liff.delivery.tracking", keyName: "estimatedTime", th: "เวลาโดยประมาณ", en: "Estimated Time", tags: ["delivery"] },
    { nsPath: "liff.delivery.tracking", keyName: "contactDriver", th: "ติดต่อคนขับ", en: "Contact Driver", tags: ["delivery", "cta"] },

    // hs.orders
    { nsPath: "hs.orders", keyName: "orderList", th: "รายการคำสั่งซื้อ", en: "Order List", tags: ["orders"] },
    { nsPath: "hs.orders", keyName: "statusPending", th: "รอดำเนินการ", en: "Pending", tags: ["orders", "status"] },
    { nsPath: "hs.orders", keyName: "statusConfirmed", th: "ยืนยันแล้ว", en: "Confirmed", tags: ["orders", "status"] },
    { nsPath: "hs.orders", keyName: "statusCompleted", th: "เสร็จสิ้น", en: "Completed", tags: ["orders", "status"] },
    { nsPath: "hs.orders", keyName: "statusCancelled", th: "ยกเลิก", en: "Cancelled", tags: ["orders", "status"] },
    { nsPath: "hs.orders", keyName: "orderDetails", th: "รายละเอียดคำสั่งซื้อ", en: "Order Details", tags: ["orders"] },
    { nsPath: "hs.orders", keyName: "totalAmount", th: "ยอดรวม", en: "Total Amount", tags: ["orders"] },

    // hs.dashboard
    { nsPath: "hs.dashboard", keyName: "dashboardTitle", th: "แดชบอร์ด", en: "Dashboard", tags: ["dashboard"] },
    { nsPath: "hs.dashboard", keyName: "todayOrders", th: "คำสั่งซื้อวันนี้", en: "Today's Orders", tags: ["dashboard"] },
    { nsPath: "hs.dashboard", keyName: "revenue", th: "รายรับ", en: "Revenue", tags: ["dashboard"] },
    { nsPath: "hs.dashboard", keyName: "topItems", th: "รายการขายดี", en: "Top Selling Items", tags: ["dashboard"] },

    // hh.settings
    { nsPath: "hh.settings", keyName: "settingsTitle", th: "ตั้งค่า", en: "Settings", tags: ["settings"] },
    { nsPath: "hh.settings", keyName: "language", th: "ภาษา", en: "Language", tags: ["settings"] },
    { nsPath: "hh.settings", keyName: "timezone", th: "เขตเวลา", en: "Timezone", tags: ["settings"] },
    { nsPath: "hh.settings", keyName: "saveChanges", th: "บันทึกการเปลี่ยนแปลง", en: "Save Changes", tags: ["settings", "cta"] },

    // merchant.kitchen
    { nsPath: "merchant.kitchen", keyName: "kitchenDisplay", th: "หน้าจอครัว", en: "Kitchen Display", tags: ["kitchen"] },
    { nsPath: "merchant.kitchen", keyName: "newOrder", th: "คำสั่งซื้อใหม่", en: "New Order", tags: ["kitchen"] },
    { nsPath: "merchant.kitchen", keyName: "markComplete", th: "ทำเสร็จแล้ว", en: "Mark Complete", tags: ["kitchen", "cta"], desc: "Button to mark an order as prepared" },
    { nsPath: "merchant.kitchen", keyName: "orderTimer", th: "เวลาผ่านไป", en: "Time Elapsed", tags: ["kitchen"] },

    // flex.notification
    { nsPath: "flex.notification", keyName: "orderConfirmed", th: "คำสั่งซื้อของคุณได้รับการยืนยัน", en: "Your order has been confirmed", tags: ["notification"] },
    { nsPath: "flex.notification", keyName: "orderReady", th: "คำสั่งซื้อของคุณพร้อมแล้ว", en: "Your order is ready", tags: ["notification"] },
    { nsPath: "flex.notification", keyName: "deliveryUpdate", th: "อัปเดตการจัดส่ง", en: "Delivery Update", tags: ["notification"] },
    { nsPath: "flex.notification", keyName: "promotionTitle", th: "โปรโมชั่นพิเศษ", en: "Special Promotion", tags: ["notification", "campaign"] },

    // Some pending translations (missing one language)
    { nsPath: "liff.dinein.menu", keyName: "dietaryFilter", th: "", en: "Dietary Filter", tags: ["menu"], status: KeyStatus.PENDING },
    { nsPath: "hs.orders", keyName: "bulkAction", th: "ดำเนินการหลายรายการ", en: "", tags: ["orders"], status: KeyStatus.PENDING },
    { nsPath: "merchant.kitchen", keyName: "priorityOrder", th: "", en: "Priority Order", tags: ["kitchen"], status: KeyStatus.PENDING },
  ];

  let keyCount = 0;
  const nsMap = new Map(namespaces.map((ns) => [ns.path, ns]));

  for (const item of keyData) {
    const ns = nsMap.get(item.nsPath);
    if (!ns) continue;

    const key = await prisma.translationKey.upsert({
      where: { namespaceId_keyName: { namespaceId: ns.id, keyName: item.keyName } },
      update: {},
      create: {
        namespaceId: ns.id,
        keyName: item.keyName,
        description: item.desc || null,
        tags: item.tags || [],
        status: item.status || KeyStatus.TRANSLATED,
        platforms: ns.platforms,
        createdById: dev1.id,
      },
    });

    // Create TH value
    if (item.th) {
      await prisma.translationValue.upsert({
        where: { keyId_locale_version: { keyId: key.id, locale: Locale.TH, version: 1 } },
        update: {},
        create: { keyId: key.id, locale: Locale.TH, value: item.th, version: 1, updatedById: dev1.id },
      });
    }

    // Create EN value
    if (item.en) {
      await prisma.translationValue.upsert({
        where: { keyId_locale_version: { keyId: key.id, locale: Locale.EN, version: 1 } },
        update: {},
        create: { keyId: key.id, locale: Locale.EN, value: item.en, version: 1, updatedById: dev1.id },
      });
    }

    keyCount++;
  }

  console.log(`  ✓ Created ${keyCount} translation keys with values`);

  // ---- Sample Change Request ----
  const cr = await prisma.changeRequest.create({
    data: {
      title: "Update menu translations for new dine-in flow",
      status: CRStatus.PENDING,
      authorId: dev2.id,
      reviewers: {
        create: { userId: reviewer.id },
      },
    },
  });

  // Find a key to add CR item for
  const addToCartKey = await prisma.translationKey.findFirst({
    where: { keyName: "addToCart" },
    include: { values: true },
  });

  if (addToCartKey) {
    await prisma.cRItem.create({
      data: {
        changeRequestId: cr.id,
        keyId: addToCartKey.id,
        locale: Locale.TH,
        oldValue: "เพิ่มลงตะกร้า",
        newValue: "หยิบใส่ตะกร้า",
        comment: "Updated to use more common phrasing",
      },
    });
  }

  console.log(`  ✓ Created 1 sample change request`);

  // ---- Audit logs ----
  await prisma.auditLog.create({
    data: {
      action: "import.completed",
      entityType: "system",
      entityId: "initial-seed",
      actorId: admin.id,
      diff: { keysImported: keyCount, source: "seed" },
    },
  });

  console.log(`  ✓ Created audit log entries`);

  console.log(`\n✅ Seed complete!`);
  console.log(`   ${5} users | ${namespaces.length} namespaces | ${keyCount} keys | 1 change request`);
  console.log(`\n   Admin token:    ${admin.apiToken}`);
  console.log(`   Dev1 token:     ${dev1.apiToken}`);
  console.log(`   Dev2 token:     ${dev2.apiToken}`);
  console.log(`   Reviewer token: ${reviewer.apiToken}`);
  console.log(`   Suchet token:   ${suchet.apiToken}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
