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
        type: "group",
        displayName: "Columns",
        items: [
          {
            displayName: "Column property",
            key: "columnProperty",
            default: "status",
            type: "text",
            placeholder: "Property to group cards by"
          },
          {
            displayName: "Columns (comma-separated)",
            key: "columns",
            default: "",
            type: "text",
            placeholder: "Leave empty for auto-detect"
          },
          {
            displayName: "Show empty columns",
            key: "showEmptyColumns",
            default: true,
            type: "toggle"
          }
        ]
      },
      {
        type: "group",
        displayName: "Cards",
        items: [
          {
            displayName: "Card size",
            key: "cardSize",
            default: 270,
            type: "slider",
            min: 100,
            max: 500,
            step: 10,
            instant: true
          },
          {
            displayName: "Strip from title start",
            key: "stripPrefix",
            default: "",
            type: "text"
          },
          {
            displayName: "Strip from title end",
            key: "stripSuffix",
            default: "",
            type: "text"
          }
        ]
      },
      {
        type: "group",
        displayName: "Templates",
        items: [
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
            options: this.getTemplateOptionsRecord()
          },
          {
            displayName: "Default subnote title",
            key: "defaultSubtaskTitle",
            default: "",
            type: "text"
          },
          {
            displayName: "Subnote template",
            key: "subtaskTemplate",
            default: "",
            type: "dropdown",
            options: this.getTemplateOptionsRecord()
          }
        ]
      },
      {
        type: "group",
        displayName: "Behavior",
        items: [
          {
            displayName: "Quick add cards",
            key: "quickAdd",
            default: true,
            type: "toggle"
          },
          {
            displayName: "Enable drag and drop",
            key: "enableDragDrop",
            default: true,
            type: "toggle"
          },
          {
            displayName: "Show subnote button",
            key: "showSubtaskButton",
            default: true,
            type: "toggle"
          },
          {
            displayName: "Link property name",
            key: "linkPropertyName",
            default: "",
            type: "text",
            placeholder: "Property to auto-set when creating notes. Empty = disabled."
          }
        ]
      }
    ];
  }
  getTemplateOptionsRecord() {
    const options = { "": "(None)" };
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof import_obsidian.TFolder) {
      const templateNames = [];
      for (const child of templateFolder.children) {
        if (child instanceof import_obsidian.TFile && child.extension === "md") {
          templateNames.push(child.basename);
        }
      }
      templateNames.sort();
      for (const name of templateNames) {
        options[name] = name;
      }
    }
    return options;
  }
  getTemplateOptions() {
    const options = [""];
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof import_obsidian.TFolder) {
      const templateNames = [];
      for (const child of templateFolder.children) {
        if (child instanceof import_obsidian.TFile && child.extension === "md") {
          templateNames.push(child.basename);
        }
      }
      templateNames.sort();
      options.push(...templateNames);
    }
    return options;
  }
};
var KanbanView = class extends import_obsidian.BasesView {
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
    const showEmptyColumns = this.config.get("showEmptyColumns") !== false;
    const showQuickAdd = this.config.get("quickAdd") !== false;
    const showSubtaskButton = this.config.get("showSubtaskButton") !== false;
    const enableDragDrop = this.config.get("enableDragDrop") !== false;
    const stripPrefix = String(this.config.get("stripPrefix") || "");
    const stripSuffix = String(this.config.get("stripSuffix") || "");
    const linkPropertyName = String(this.config.get("linkPropertyName") || "");
    const cardWidth = Number(this.config.get("cardSize")) || 270;
    const order = this.config.getOrder();
    this.containerEl.style.setProperty("--kanban-card-width", `${cardWidth}px`);
    const embeddingFile = this.getEmbeddingFile();
    const linkValue = embeddingFile ? `[[${embeddingFile.basename}]]` : "";
    const allItems = [];
    if (((_a = this.data) == null ? void 0 : _a.groupedData) && Array.isArray(this.data.groupedData)) {
      for (const group of this.data.groupedData) {
        if ((group == null ? void 0 : group.entries) && Array.isArray(group.entries)) {
          allItems.push(...group.entries);
        }
      }
    }
    if (allItems.length === 0 && ((_b = this.data) == null ? void 0 : _b.data) && Array.isArray(this.data.data)) {
      allItems.push(...this.data.data);
    }
    if (allItems.length === 0 && !(columnsConfig && showEmptyColumns)) {
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
        this.containerEl,
        columnName,
        items,
        order,
        columnProperty,
        showQuickAdd,
        showSubtaskButton,
        enableDragDrop,
        stripPrefix,
        stripSuffix,
        linkPropertyName,
        linkValue,
        embeddingFile
      );
    }
  }
  /**
   * Auto-detect the file that embeds this base view.
   * When a .base file is embedded in a markdown note (e.g., ![[tasks.base]]),
   * this method finds that parent note so we can use it as the parent property.
   */
  getEmbeddingFile() {
    try {
      const leaf = this.containerEl.closest(".workspace-leaf");
      if (!leaf) return null;
      const viewHeader = leaf.querySelector(".view-header-title");
      if (viewHeader && viewHeader.textContent) {
        const files = this.app.vault.getMarkdownFiles();
        const matchingFile = files.find(
          (f) => f.basename === viewHeader.textContent
        );
        if (matchingFile) return matchingFile;
      }
      const embedContainer = this.containerEl.closest(".markdown-embed");
      if (embedContainer) {
        const markdownView = embedContainer.closest(
          ".markdown-reading-view, .markdown-source-view"
        );
        if (markdownView) {
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile && activeFile.extension === "md") {
            return activeFile;
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  renderColumn(container, columnName, items, order, columnProperty, showQuickAdd, showSubtaskButton, enableDragDrop, stripPrefix, stripSuffix, linkPropertyName, linkValue, embeddingFile = null) {
    const columnEl = container.createDiv("bases-kanban-column");
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
        let defaultTitle = String(this.config.get("defaultNoteTitle") || "");
        let defaultTemplateValue = this.config.get("defaultTemplate");
        if (embeddingFile && embeddingFile.basename.toLowerCase().startsWith("task ")) {
          const subTitle = this.config.get("defaultSubtaskTitle");
          if (subTitle) defaultTitle = String(subTitle);
          const subTemplate = this.config.get("subtaskTemplate");
          if (subTemplate) defaultTemplateValue = subTemplate;
        }
        const defaultTemplate = typeof defaultTemplateValue === "string" ? defaultTemplateValue : "";
        new QuickAddModal(
          this.app,
          columnProperty,
          columnName,
          defaultTitle,
          defaultTemplate,
          linkPropertyName,
          linkValue,
          this.plugin
        ).open();
      });
    }
    const cardsEl = columnEl.createDiv("bases-kanban-column-cards");
    if (enableDragDrop) {
      cardsEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        cardsEl.addClass("drag-over");
      });
      cardsEl.addEventListener("dragleave", (e) => {
        if (!cardsEl.contains(e.relatedTarget)) {
          cardsEl.removeClass("drag-over");
        }
      });
      cardsEl.addEventListener("drop", async (e) => {
        var _a;
        e.preventDefault();
        cardsEl.removeClass("drag-over");
        const filePath = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain");
        if (!filePath) return;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof import_obsidian.TFile)) return;
        try {
          await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            frontmatter[columnProperty] = [columnName];
          });
        } catch (err) {
          console.error("Failed to update card column:", err);
        }
      });
    }
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
        showSubtaskButton,
        enableDragDrop,
        stripPrefix,
        stripSuffix,
        linkPropertyName
      );
    }
  }
  renderCard(container, item, order, columnProperty, showSubtaskButton, enableDragDrop, stripPrefix, stripSuffix, linkPropertyName) {
    const cardEl = container.createDiv("bases-kanban-card");
    cardEl.dataset.path = item.file.path;
    if (enableDragDrop) {
      cardEl.draggable = true;
      cardEl.addEventListener("dragstart", (e) => {
        var _a;
        (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/plain", item.file.path);
        cardEl.addClass("is-dragging");
      });
      cardEl.addEventListener("dragend", () => {
        cardEl.removeClass("is-dragging");
      });
    }
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
    const headerEl = cardEl.createDiv("bases-kanban-card-header");
    const titleEl = headerEl.createDiv("bases-kanban-card-title");
    titleEl.createSpan({ text: displayTitle });
    if (showSubtaskButton) {
      const subtaskBtn = headerEl.createEl("button", {
        cls: "bases-kanban-subtask-btn clickable-icon",
        attr: { "aria-label": "Add subnote" }
      });
      (0, import_obsidian.setIcon)(subtaskBtn, "plus");
      subtaskBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const subtaskTemplateValue = this.config.get("subtaskTemplate");
        const subtaskTemplate = typeof subtaskTemplateValue === "string" ? subtaskTemplateValue : "";
        const defaultSubtaskTitle = String(
          this.config.get("defaultSubtaskTitle") || ""
        );
        new SubtaskModal(
          this.app,
          item.file.basename,
          item.file.path,
          subtaskTemplate,
          defaultSubtaskTitle,
          linkPropertyName,
          this.plugin
        ).open();
      });
    }
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
  constructor(app, columnProperty, columnValue, defaultTitle, defaultTemplate, linkPropertyName, linkValue, plugin) {
    super(app);
    this.noteTitle = "";
    this.selectedTemplate = null;
    this.columnProperty = columnProperty;
    this.columnValue = columnValue;
    this.defaultTitle = defaultTitle;
    this.noteTitle = defaultTitle;
    this.defaultTemplatePath = defaultTemplate;
    this.linkPropertyName = linkPropertyName;
    this.linkValue = linkValue;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("bases-kanban-quick-add-modal");
    contentEl.createEl("h3", { text: "Add new card" });
    if (this.defaultTemplatePath) {
      const templates = this.getTemplates();
      const matchingTemplate = templates.find(
        (t) => t.basename === this.defaultTemplatePath
      );
      if (matchingTemplate) {
        this.selectedTemplate = matchingTemplate;
      }
    }
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
    let frontmatterProps = `${this.columnProperty}:
  - ${this.columnValue}`;
    if (this.linkPropertyName && this.linkValue) {
      frontmatterProps += `
${this.linkPropertyName}: "${this.linkValue}"`;
    }
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
              `${this.columnProperty}:
  - ${this.columnValue}`
            );
          } else {
            templateFrontmatter = `${this.columnProperty}:
  - ${this.columnValue}
` + templateFrontmatter;
          }
          if (this.linkPropertyName && this.linkValue) {
            const linkPropRegex = new RegExp(
              `^${this.linkPropertyName}:.*$`,
              "m"
            );
            if (linkPropRegex.test(templateFrontmatter)) {
              templateFrontmatter = templateFrontmatter.replace(
                linkPropRegex,
                `${this.linkPropertyName}: "${this.linkValue}"`
              );
            } else {
              templateFrontmatter += `
${this.linkPropertyName}: "${this.linkValue}"`;
            }
          }
          content = `---
${templateFrontmatter}
---
${templateBody}`;
        } else {
          content = `---
${frontmatterProps}
---

${templateContent}`;
        }
      } else {
        content = `---
${frontmatterProps}
---

${templateContent}`;
      }
    } else {
      content = `---
${frontmatterProps}
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
var SubtaskModal = class extends import_obsidian.Modal {
  constructor(app, parentBasename, parentPath, defaultTemplate, defaultTitle, linkPropertyName, plugin) {
    super(app);
    this.subtaskTitle = "";
    this.selectedTemplate = null;
    this.parentBasename = parentBasename;
    this.parentPath = parentPath;
    this.defaultTemplatePath = defaultTemplate;
    this.defaultTitle = defaultTitle;
    this.subtaskTitle = defaultTitle;
    this.linkPropertyName = linkPropertyName;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("bases-kanban-subtask-modal");
    contentEl.createEl("h3", {
      text: `Add subnote to "${this.parentBasename}"`
    });
    if (this.defaultTemplatePath) {
      const templates = this.getTemplates();
      const matchingTemplate = templates.find(
        (t) => t.basename === this.defaultTemplatePath
      );
      if (matchingTemplate) {
        this.selectedTemplate = matchingTemplate;
      }
    }
    new import_obsidian.Setting(contentEl).setName("Subnote title").setDesc("Name for the new subnote").addText((text) => {
      text.setPlaceholder("Enter subnote title...");
      text.setValue(this.defaultTitle);
      text.onChange((value) => {
        this.subtaskTitle = value;
      });
      setTimeout(() => text.inputEl.focus(), 50);
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.createSubtask();
        }
      });
    });
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Create subnote").setCta().onClick(() => this.createSubtask());
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
  async createSubtask() {
    if (!this.subtaskTitle.trim()) {
      return;
    }
    const fileName = `${this.subtaskTitle.trim()}.md`;
    const linkValue = `"[[${this.parentBasename}]]"`;
    const linkPropertyYaml = this.linkPropertyName ? `${this.linkPropertyName}: ${linkValue}` : "";
    let content;
    if (this.selectedTemplate) {
      const templateContent = await this.app.vault.read(this.selectedTemplate);
      if (templateContent.startsWith("---")) {
        const endOfFrontmatter = templateContent.indexOf("---", 3);
        if (endOfFrontmatter !== -1) {
          let templateFrontmatter = templateContent.slice(4, endOfFrontmatter).trim();
          const templateBody = templateContent.slice(endOfFrontmatter + 3);
          if (this.linkPropertyName) {
            const linkPropRegex = new RegExp(
              `^${this.linkPropertyName}:.*$`,
              "m"
            );
            if (linkPropRegex.test(templateFrontmatter)) {
              templateFrontmatter = templateFrontmatter.replace(
                linkPropRegex,
                linkPropertyYaml
              );
            } else {
              templateFrontmatter = linkPropertyYaml + "\n" + templateFrontmatter;
            }
          }
          content = `---
${templateFrontmatter}
---${templateBody}`;
        } else {
          const fm = linkPropertyYaml ? linkPropertyYaml + "\n" : "";
          content = `---
${fm}---

${templateContent}`;
        }
      } else {
        const fm = linkPropertyYaml ? linkPropertyYaml + "\n" : "";
        content = `---
${fm}---

${templateContent}`;
      }
    } else {
      const fm = linkPropertyYaml ? linkPropertyYaml + "\n" : "";
      content = `---
${fm}status:
  - backlog
---

`;
    }
    try {
      const file = await this.app.vault.create(fileName, content);
      this.app.workspace.getLeaf(false).openFile(file);
      this.close();
    } catch (e) {
      console.error("Failed to create subtask:", e);
    }
  }
};
