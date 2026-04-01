// Hato TMS — Figma Plugin Main Code (runs in Figma sandbox)

const TMS_KEY_ID = "hato-tms-key-id";
const TMS_KEY_NAME = "hato-tms-key-name";
const TMS_LOCALE = "hato-tms-locale";

figma.showUI(__html__, { width: 300, height: 400, themeColors: true });

// ---- Message handling ----

figma.ui.onmessage = async (msg: {
  type: string;
  [key: string]: unknown;
}) => {
  switch (msg.type) {
    case "get-selection":
      handleGetSelection();
      break;

    case "search":
      // Search is handled in the UI via API calls; this just passes through
      // No sandbox work needed
      break;

    case "link-key":
      handleLinkKey(
        msg.keyId as string,
        msg.keyName as string,
        msg.value as string,
        msg.locale as string
      );
      break;

    case "switch-language":
      await handleSwitchLanguage(msg.locale as string, msg.translations as Record<string, Record<string, string>>);
      break;

    case "create-key":
      // Key creation is handled in the UI via API calls
      // After creation, we link it to the selected node
      handleLinkKey(
        msg.keyId as string,
        msg.keyName as string,
        msg.value as string,
        msg.locale as string
      );
      break;

    case "sync-all":
      await handleSyncAll(msg.translations as Record<string, Record<string, string>>, msg.locale as string);
      break;

    case "bulk-sync":
      await handleBulkSync(
        msg.items as { nodeId: string; keyId: string; keyName: string; value: string; locale: string }[]
      );
      break;

    case "highlight-unlinked":
      handleHighlightUnlinked();
      break;

    case "notify":
      figma.notify(msg.message as string);
      break;

    case "close":
      figma.closePlugin();
      break;

    default:
      break;
  }
};

// ---- Selection change listener ----

figma.on("selectionchange", () => {
  handleGetSelection();
});

// ---- Handlers ----

function handleGetSelection(): void {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: "selection", data: null });
    return;
  }

  if (selection.length > 1) {
    // Collect all text layers in multi-selection
    const textLayers = selection
      .filter((n) => n.type === "TEXT")
      .map((n) => {
        const t = n as TextNode;
        const keyId = t.getPluginData(TMS_KEY_ID);
        const keyName = t.getPluginData(TMS_KEY_NAME);
        return {
          id: t.id,
          name: t.name,
          text: t.characters,
          linked: !!keyId,
          keyId: keyId || null,
          keyName: keyName || null,
        };
      });

    figma.ui.postMessage({
      type: "selection",
      data: {
        multiple: true,
        count: selection.length,
        textCount: textLayers.length,
        textLayers,
      },
    });
    return;
  }

  const node = selection[0];

  if (node.type !== "TEXT") {
    figma.ui.postMessage({
      type: "selection",
      data: {
        id: node.id,
        name: node.name,
        type: node.type,
        isText: false,
      },
    });
    return;
  }

  const textNode = node as TextNode;
  const keyId = textNode.getPluginData(TMS_KEY_ID);
  const keyName = textNode.getPluginData(TMS_KEY_NAME);
  const locale = textNode.getPluginData(TMS_LOCALE) || "th";

  figma.ui.postMessage({
    type: "selection",
    data: {
      id: textNode.id,
      name: textNode.name,
      type: textNode.type,
      isText: true,
      text: textNode.characters,
      linked: !!keyId,
      keyId: keyId || null,
      keyName: keyName || null,
      locale,
    },
  });
}

function handleLinkKey(
  keyId: string,
  keyName: string,
  value: string,
  locale: string
): void {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1 || selection[0].type !== "TEXT") {
    figma.notify("Please select a single text layer.");
    return;
  }

  const textNode = selection[0] as TextNode;

  // Store TMS metadata on the node
  textNode.setPluginData(TMS_KEY_ID, keyId);
  textNode.setPluginData(TMS_KEY_NAME, keyName);
  textNode.setPluginData(TMS_LOCALE, locale);

  // Rename layer to key name
  if (keyName) {
    textNode.name = keyName;
  }

  // Update the text content
  loadFontsAndSetText(textNode, value).then(() => {
    figma.notify(`Linked to ${keyName}`);
    handleGetSelection(); // Refresh UI
  });
}

async function handleSwitchLanguage(
  targetLocale: string,
  translations: Record<string, Record<string, string>>
): Promise<void> {
  const textNodes = findAllLinkedTextNodes();
  let updated = 0;

  for (const node of textNodes) {
    const keyId = node.getPluginData(TMS_KEY_ID);
    if (!keyId || !translations[keyId]) continue;

    const newValue = translations[keyId][targetLocale];
    if (!newValue) continue;

    await loadFontsAndSetText(node, newValue);
    node.setPluginData(TMS_LOCALE, targetLocale);

    // Ensure layer name matches key name
    const keyName = node.getPluginData(TMS_KEY_NAME);
    if (keyName && node.name !== keyName) {
      node.name = keyName;
    }
    updated++;
  }

  figma.notify(
    `Switched ${updated} text layers to ${targetLocale.toUpperCase()}`
  );
  handleGetSelection();
}

async function handleSyncAll(
  translations: Record<string, Record<string, string>>,
  locale: string
): Promise<void> {
  const textNodes = findAllLinkedTextNodes();
  let synced = 0;

  for (const node of textNodes) {
    const keyId = node.getPluginData(TMS_KEY_ID);
    const currentLocale = node.getPluginData(TMS_LOCALE) || locale;

    if (!keyId || !translations[keyId]) continue;

    const newValue = translations[keyId][currentLocale];
    if (!newValue) continue;

    if (node.characters !== newValue) {
      await loadFontsAndSetText(node, newValue);
      synced++;
    }

    // Ensure layer name matches key name
    const keyName = node.getPluginData(TMS_KEY_NAME);
    if (keyName && node.name !== keyName) {
      node.name = keyName;
    }
  }

  figma.notify(`Synced ${synced} text layers with latest TMS values`);
}

async function handleBulkSync(
  items: { nodeId: string; keyId: string; keyName: string; value: string; locale: string }[]
): Promise<void> {
  let linked = 0;
  let renamed = 0;

  for (const item of items) {
    const node = figma.getNodeById(item.nodeId);
    if (!node || node.type !== "TEXT") continue;

    const textNode = node as TextNode;

    // Store TMS metadata
    textNode.setPluginData(TMS_KEY_ID, item.keyId);
    textNode.setPluginData(TMS_KEY_NAME, item.keyName);
    textNode.setPluginData(TMS_LOCALE, item.locale);

    // Update text content
    await loadFontsAndSetText(textNode, item.value);
    linked++;

    // Rename layer to key name
    textNode.name = item.keyName;
    renamed++;
  }

  figma.notify(`Synced ${linked} layers, renamed ${renamed} to key names`);
  handleGetSelection();
}

function handleHighlightUnlinked(): void {
  const page = figma.currentPage;
  const unlinked: SceneNode[] = [];

  function walk(node: SceneNode): void {
    if (node.type === "TEXT") {
      const keyId = (node as TextNode).getPluginData(TMS_KEY_ID);
      if (!keyId) {
        unlinked.push(node);
      }
    }
    if ("children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child as SceneNode);
      }
    }
  }

  for (const child of page.children) {
    walk(child);
  }

  if (unlinked.length === 0) {
    figma.notify("All text layers are linked!");
    return;
  }

  // Select unlinked nodes
  figma.currentPage.selection = unlinked;
  figma.viewport.scrollAndZoomIntoView(unlinked);
  figma.notify(`Found ${unlinked.length} unlinked text layers`);
}

// ---- Helpers ----

function findAllLinkedTextNodes(): TextNode[] {
  const result: TextNode[] = [];
  const page = figma.currentPage;

  function walk(node: SceneNode): void {
    if (node.type === "TEXT") {
      const keyId = (node as TextNode).getPluginData(TMS_KEY_ID);
      if (keyId) {
        result.push(node as TextNode);
      }
    }
    if ("children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child as SceneNode);
      }
    }
  }

  for (const child of page.children) {
    walk(child);
  }

  return result;
}

async function loadFontsAndSetText(
  node: TextNode,
  text: string
): Promise<void> {
  // Load all fonts used in the text node
  const fontNames = node.getRangeAllFontNames(0, node.characters.length);
  for (const font of fontNames) {
    await figma.loadFontAsync(font);
  }
  node.characters = text;
}
