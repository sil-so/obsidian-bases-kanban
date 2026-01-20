"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  KANBAN_VIEW_TYPE: () => KANBAN_VIEW_TYPE,
  default: () => BasesKanbanViewPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_obsidian2 = require("obsidian");
var KANBAN_VIEW_TYPE = "kanban";
var BasesKanbanViewPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerBasesView(KANBAN_VIEW_TYPE, {
      name: "Kanban",
      icon: "layout-dashboard",
      options: () => this.getViewOptions(),
      factory: (controller, containerEl) => {
        return new KanbanView(controller, containerEl, this);
      }
    });
  }
  async onunload() {
  }
  getViewOptions() {
    return [
      {
        displayName: "Column property",
        key: "columnProperty",
        default: "status",
        type: "text"
      },
      {
        displayName: "Columns (comma-separated, leave empty for auto)",
        key: "columns",
        default: "",
        type: "text"
      },
      {
        displayName: "Strip from card title start",
        key: "stripPrefix",
        default: "",
        type: "text"
      },
      {
        displayName: "Strip from card title end",
        key: "stripSuffix",
        default: "",
        type: "text"
      },
      {
        displayName: "Default new note title",
        key: "defaultNoteTitle",
        default: "",
        type: "text"
      },
      {
        displayName: "Default new note template",
        key: "defaultTemplate",
        default: "",
        type: "dropdown",
        options: this.getTemplateOptions()
      },
      {
        displayName: "Card width (px)",
        key: "cardWidth",
        default: 250,
        type: "slider",
        sliderConfig: { min: 150, max: 400, step: 10 }
      },
      {
        displayName: "Show empty columns",
        key: "showEmptyColumns",
        default: true,
        type: "toggle"
      },
      {
        displayName: "Quick add cards",
        key: "quickAdd",
        default: true,
        type: "toggle"
      }
    ];
  }
  getTemplateOptions() {
    const options = [""];
    const templateNames = [];
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof import_obsidian.TFolder) {
      for (const child of templateFolder.children) {
        if (child instanceof import_obsidian.TFile && child.extension === "md") {
          templateNames.push(child.basename);
        }
      }
    }
    templateNames.sort();
    options.push(...templateNames);
    return options;
  }
};
var KanbanView = class extends import_obsidian2.BasesView {
  constructor(controller, parentEl, plugin) {
    super(controller);
    this.type = KANBAN_VIEW_TYPE;
    this.plugin = plugin;
    this.containerEl = parentEl.createDiv("bases-kanban-container");
  }
  onDataUpdated() {
    var _a, _b, _c, _d;
    this.containerEl.empty();
    const rawColumnProp = this.config.get("columnProperty");
    const columnProperty = rawColumnProp && rawColumnProp !== "undefined" ? String(rawColumnProp) : "status";
    const columnsConfig = String(this.config.get("columns") || "").trim();
    const cardWidth = Number(this.config.get("cardWidth")) || 250;
    const showEmptyColumns = this.config.get("showEmptyColumns") !== false;
    const showQuickAdd = this.config.get("quickAdd") !== false;
    const stripPrefix = String(this.config.get("stripPrefix") || "");
    const stripSuffix = String(this.config.get("stripSuffix") || "");
    const order = this.config.getOrder();
    this.containerEl.style.setProperty("--kanban-card-width", `${cardWidth}px`);
    const allItems = [];
    if (((_a = this.data) == null ? void 0 : _a.groupedData) && Array.isArray(this.data.groupedData)) {
      for (const group of this.data.groupedData) {
        if ((group == null ? void 0 : group.entries) && Array.isArray(group.entries)) {
          allItems.push(...group.entries);
        }
      }
    }
    if (allItems.length === 0 && ((_b = this.data) == null ? void 0 : _b.ungroupedData) && Array.isArray(this.data.ungroupedData)) {
      allItems.push(...this.data.ungroupedData);
    }
    if (allItems.length === 0) {
      this.containerEl.createDiv({
        cls: "bases-kanban-no-data",
        text: "No items to display."
      });
      return;
    }
    const columnMap = /* @__PURE__ */ new Map();
    for (const item of allItems) {
      let columnKey = "Uncategorized";
      try {
        const columnValue = item.getValue(columnProperty);
        const valueStr = ((_c = columnValue == null ? void 0 : columnValue.toString) == null ? void 0 : _c.call(columnValue)) || "";
        columnKey = !valueStr || valueStr === "null" || valueStr === "undefined" || ((_d = columnValue == null ? void 0 : columnValue.isEmpty) == null ? void 0 : _d.call(columnValue)) ? "Uncategorized" : valueStr;
      } catch (e) {
      }
      if (!columnMap.has(columnKey)) {
        columnMap.set(columnKey, []);
      }
      columnMap.get(columnKey).push(item);
    }
    let columns;
    if (columnsConfig) {
      columns = columnsConfig.split(",").map((c) => c.trim()).filter(Boolean);
      for (const key of columnMap.keys()) {
        if (!columns.includes(key)) {
          columns.push(key);
        }
      }
    } else {
      columns = Array.from(columnMap.keys()).sort();
    }
    for (const columnName of columns) {
      const items = columnMap.get(columnName) || [];
      if (!showEmptyColumns && items.length === 0) {
        continue;
      }
      this.renderColumn(
        columnName,
        items,
        order,
        columnProperty,
        showQuickAdd,
        stripPrefix,
        stripSuffix
      );
    }
  }
  renderColumn(columnName, items, order, columnProperty, showQuickAdd, stripPrefix, stripSuffix) {
    const columnEl = this.containerEl.createDiv("bases-kanban-column");
    columnEl.dataset.column = columnName;
    const headerEl = columnEl.createDiv("bases-kanban-column-header");
    headerEl.createSpan({ cls: "bases-kanban-column-title", text: columnName });
    if (showQuickAdd) {
      const addBtn = headerEl.createEl("button", {
        cls: "bases-kanban-add-btn clickable-icon",
        attr: { "aria-label": "Add card" }
      });
      (0, import_obsidian.setIcon)(addBtn, "plus");
      addBtn.addEventListener("click", () => {
        const defaultTitle = String(this.config.get("defaultNoteTitle") || "");
        const defaultTemplateValue = this.config.get("defaultTemplate");
        console.log("Raw defaultTemplateValue:", defaultTemplateValue, "type:", typeof defaultTemplateValue);
        let defaultTemplate = "";
        const indexValue = typeof defaultTemplateValue === "string" ? parseInt(defaultTemplateValue, 10) : defaultTemplateValue;
        if (typeof indexValue === "number" && !isNaN(indexValue) && indexValue > 0) {
          const options = this.plugin.getTemplateOptions();
          console.log("Options:", options, "index:", indexValue);
          if (indexValue < options.length) {
            defaultTemplate = options[indexValue];
          }
        }
        console.log("Resolved template name:", defaultTemplate);
        new QuickAddModal(
          this.app,
          columnProperty,
          columnName,
          defaultTitle,
          defaultTemplate,
          this.plugin
        ).open();
      });
    }
    const cardsEl = columnEl.createDiv("bases-kanban-column-cards");
    if (items.length === 0) {
      cardsEl.createDiv({
        cls: "bases-kanban-column-empty",
        text: "No items"
      });
      return;
    }
    for (const item of items) {
      this.renderCard(
        cardsEl,
        item,
        order,
        columnProperty,
        stripPrefix,
        stripSuffix
      );
    }
  }
  renderCard(container, item, order, columnProperty, stripPrefix, stripSuffix) {
    const cardEl = container.createDiv("bases-kanban-card");
    cardEl.dataset.path = item.file.path;
    cardEl.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const file = this.app.vault.getAbstractFileByPath(item.file.path);
      if (file instanceof import_obsidian.TFile) {
        this.app.workspace.getLeaf(false).openFile(file);
      }
    });
    let displayTitle = item.file.basename;
    if (stripPrefix && displayTitle.toLowerCase().startsWith(stripPrefix.toLowerCase())) {
      displayTitle = displayTitle.slice(stripPrefix.length).trim();
    }
    if (stripSuffix && displayTitle.toLowerCase().endsWith(stripSuffix.toLowerCase())) {
      displayTitle = displayTitle.slice(0, -stripSuffix.length).trim();
    }
    const titleEl = cardEl.createDiv("bases-kanban-card-title");
    titleEl.createSpan({ text: displayTitle });
    cardEl.addEventListener("mouseover", (e) => {
      this.app.workspace.trigger("hover-link", {
        event: e,
        source: "bases-kanban-view",
        hoverParent: cardEl,
        targetEl: cardEl,
        linktext: item.file.path
      });
    });
    const propsEl = cardEl.createDiv("bases-kanban-card-properties");
    for (const propName of order) {
      if (propName === "file.name" || propName === "file.basename") continue;
      if (propName === columnProperty) continue;
      try {
        const propValue = item.getValue(propName);
        let valueStr = "";
        let isEmpty = true;
        if (propValue === null || propValue === void 0) {
          isEmpty = true;
        } else if (typeof propValue === "object" && "isEmpty" in propValue && typeof propValue.isEmpty === "function") {
          isEmpty = propValue.isEmpty();
          valueStr = propValue.toString();
        } else if (typeof propValue === "object" && "toString" in propValue) {
          valueStr = propValue.toString();
          isEmpty = !valueStr || valueStr === "" || valueStr === "null" || valueStr === "undefined";
        } else {
          valueStr = String(propValue);
          isEmpty = !valueStr || valueStr === "" || valueStr === "null" || valueStr === "undefined";
        }
        if (isEmpty) continue;
        const propEl = propsEl.createDiv("bases-kanban-card-property");
        const displayName = propName.replace("file.", "").replace("formula.", "").replace("note.", "");
        propEl.createDiv({ cls: "kanban-property-label", text: displayName });
        propEl.createDiv({ cls: "kanban-property-value", text: valueStr });
      } catch (e) {
      }
    }
  }
};
var QuickAddModal = class extends import_obsidian.Modal {
  constructor(app, columnProperty, columnValue, defaultTitle, defaultTemplate, plugin) {
    super(app);
    this.noteTitle = "";
    this.selectedTemplate = null;
    this.columnProperty = columnProperty;
    this.columnValue = columnValue;
    this.defaultTitle = defaultTitle;
    this.noteTitle = defaultTitle;
    this.defaultTemplatePath = defaultTemplate;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("bases-kanban-quick-add-modal");
    contentEl.createEl("h3", { text: "Add new card" });
    console.log("defaultTemplatePath:", this.defaultTemplatePath);
    if (this.defaultTemplatePath) {
      const templates = this.getTemplates();
      console.log("Available templates:", templates.map((t) => t.basename));
      const matchingTemplate = templates.find(
        (t) => t.basename === this.defaultTemplatePath
      );
      console.log("Matching template:", matchingTemplate);
      if (matchingTemplate) {
        this.selectedTemplate = matchingTemplate;
      }
    }
    console.log("Selected template:", this.selectedTemplate);
    new import_obsidian.Setting(contentEl).setName("Title").setDesc("Name for the new note").addText((text) => {
      text.setPlaceholder("Enter note title...");
      text.setValue(this.defaultTitle);
      text.onChange((value) => {
        this.noteTitle = value;
      });
      setTimeout(() => text.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Create").setCta().onClick(() => this.createNote());
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
  getTemplates() {
    const templates = [];
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof import_obsidian.TFolder) {
      for (const child of templateFolder.children) {
        if (child instanceof import_obsidian.TFile && child.extension === "md") {
          templates.push(child);
        }
      }
    }
    templates.sort((a, b) => a.basename.localeCompare(b.basename));
    return templates;
  }
  async createNote() {
    if (!this.noteTitle.trim()) {
      return;
    }
    const fileName = `${this.noteTitle.trim()}.md`;
    const columnPropertyYaml = `${this.columnProperty}:
  - ${this.columnValue}`;
    let content;
    if (this.selectedTemplate) {
      const templateContent = await this.app.vault.read(this.selectedTemplate);
      if (templateContent.startsWith("---")) {
        const endOfFrontmatter = templateContent.indexOf("---", 3);
        if (endOfFrontmatter !== -1) {
          let templateFrontmatter = templateContent.slice(4, endOfFrontmatter).trim();
          const templateBody = templateContent.slice(endOfFrontmatter + 3);
          const propRegex = new RegExp(
            `^${this.columnProperty}:.*(?:\\n  - .*)*`,
            "m"
          );
          if (propRegex.test(templateFrontmatter)) {
            templateFrontmatter = templateFrontmatter.replace(
              propRegex,
              columnPropertyYaml
            );
          } else {
            templateFrontmatter = columnPropertyYaml + "\n" + templateFrontmatter;
          }
          content = `---
${templateFrontmatter}
---
${templateBody}`;
        } else {
          content = `---
${columnPropertyYaml}
---

${templateContent}`;
        }
      } else {
        content = `---
${columnPropertyYaml}
---

${templateContent}`;
      }
    } else {
      content = `---
${columnPropertyYaml}
---

`;
    }
    try {
      const file = await this.app.vault.create(fileName, content);
      this.app.workspace.getLeaf(false).openFile(file);
      this.close();
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  }
};
