import {
  App,
  Modal,
  Plugin,
  TFile,
  TFolder,
  Setting,
  FuzzyMatch,
  FuzzySuggestModal,
  setIcon,
  BasesView,
  QueryController,
  BasesEntry,
  ViewOption
} from "obsidian";

export const KANBAN_VIEW_TYPE = "kanban";

export default class BasesKanbanViewPlugin extends Plugin {
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
    // Cleanup handled automatically by Obsidian
  }

  private getViewOptions(): ViewOption[] {
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
            placeholder:
              "Property to auto-set when creating notes. Empty = disabled."
          }
        ]
      }
    ];
  }

  private getTemplateOptionsRecord(): Record<string, string> {
    const options: Record<string, string> = { "": "(None)" };

    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof TFolder) {
      const templateNames: string[] = [];
      for (const child of templateFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
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

  public getTemplateOptions(): string[] {
    const options: string[] = [""];
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof TFolder) {
      const templateNames: string[] = [];
      for (const child of templateFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          templateNames.push(child.basename);
        }
      }
      templateNames.sort();
      options.push(...templateNames);
    }
    return options;
  }
}

class KanbanView extends BasesView {
  readonly type = KANBAN_VIEW_TYPE;
  private containerEl: HTMLElement;
  private plugin: BasesKanbanViewPlugin;

  constructor(
    controller: QueryController,
    parentEl: HTMLElement,
    plugin: BasesKanbanViewPlugin
  ) {
    super(controller);
    this.plugin = plugin;
    this.containerEl = parentEl.createDiv("bases-kanban-container");
  }

  public onDataUpdated(): void {
    this.containerEl.empty();

    // Get config with proper defaults
    const rawColumnProp = this.config.get("columnProperty");
    const columnProperty =
      rawColumnProp && rawColumnProp !== "undefined"
        ? String(rawColumnProp)
        : "status";
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

    // Apply card width as CSS custom property
    this.containerEl.style.setProperty("--kanban-card-width", `${cardWidth}px`);

    // Auto-detect parent from embedding file (only used if linkPropertyName is set)
    const embeddingFile = this.getEmbeddingFile();
    const linkValue = embeddingFile ? `[[${embeddingFile.basename}]]` : "";

    // Collect all items from the data
    const allItems: BasesEntry[] = [];

    // Try groupedData first (this is how Bases provides data to views)
    if (this.data?.groupedData && Array.isArray(this.data.groupedData)) {
      for (const group of this.data.groupedData) {
        if (group?.entries && Array.isArray(group.entries)) {
          allItems.push(...group.entries);
        }
      }
    }

    // Fallback to data if available and groupedData was empty
    if (
      allItems.length === 0 &&
      this.data?.data &&
      Array.isArray(this.data.data)
    ) {
      allItems.push(...this.data.data);
    }

    if (allItems.length === 0 && !(columnsConfig && showEmptyColumns)) {
      this.containerEl.createDiv({
        cls: "bases-kanban-no-data",
        text: "No items to display."
      });
      return;
    }

    // Group data by column property
    const columnMap = new Map<string, BasesEntry[]>();

    for (const item of allItems) {
      let columnKey = "Uncategorized";
      try {
        const columnValue = item.getValue(columnProperty);
        const valueStr = columnValue?.toString?.() || "";
        columnKey =
          !valueStr ||
          valueStr === "null" ||
          valueStr === "undefined" ||
          columnValue?.isEmpty?.()
            ? "Uncategorized"
            : valueStr;
      } catch {
        // Use Uncategorized if property can't be read
      }

      if (!columnMap.has(columnKey)) {
        columnMap.set(columnKey, []);
      }
      columnMap.get(columnKey)!.push(item);
    }

    // Determine column order
    let columns: string[];
    if (columnsConfig) {
      columns = columnsConfig
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      // Add any columns from data that weren't explicitly configured
      for (const key of columnMap.keys()) {
        if (!columns.includes(key)) {
          columns.push(key);
        }
      }
    } else {
      // Auto-detect columns from data
      columns = Array.from(columnMap.keys()).sort();
    }

    // Render columns
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
  private getEmbeddingFile(): TFile | null {
    try {
      // Find the workspace leaf that contains this view
      const leaf = this.containerEl.closest(".workspace-leaf");
      if (!leaf) return null;

      // Try to find the view header title which shows the current file
      const viewHeader = leaf.querySelector(".view-header-title");
      if (viewHeader && viewHeader.textContent) {
        // The header shows the file name
        const files = this.app.vault.getMarkdownFiles();
        const matchingFile = files.find(
          (f) => f.basename === viewHeader.textContent
        );
        if (matchingFile) return matchingFile;
      }

      // Alternative: look for embedded content indicator
      // When embedded, the container is inside a markdown-embed
      const embedContainer = this.containerEl.closest(".markdown-embed");
      if (embedContainer) {
        // Find the parent markdown-reading-view or markdown-source-view
        const markdownView = embedContainer.closest(
          ".markdown-reading-view, .markdown-source-view"
        );
        if (markdownView) {
          // Get the file from the active leaf or view
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile && activeFile.extension === "md") {
            return activeFile;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private renderColumn(
    container: HTMLElement,
    columnName: string,
    items: BasesEntry[],
    order: string[],
    columnProperty: string,
    showQuickAdd: boolean,
    showSubtaskButton: boolean,
    enableDragDrop: boolean,
    stripPrefix: string,
    stripSuffix: string,
    linkPropertyName: string,
    linkValue: string,
    embeddingFile: TFile | null = null
  ): void {
    const columnEl = container.createDiv("bases-kanban-column");
    columnEl.dataset.column = columnName;

    // Column header
    const headerEl = columnEl.createDiv("bases-kanban-column-header");
    headerEl.createSpan({ cls: "bases-kanban-column-title", text: columnName });

    if (showQuickAdd) {
      const addBtn = headerEl.createEl("button", {
        cls: "bases-kanban-add-btn clickable-icon",
        attr: { "aria-label": "Add card" }
      });
      setIcon(addBtn, "plus");
      addBtn.addEventListener("click", () => {
        let defaultTitle = String(this.config.get("defaultNoteTitle") || "");
        let defaultTemplateValue = this.config.get("defaultTemplate");

        // If embedded in a task note, intelligently fallback to subtask properties
        if (embeddingFile && embeddingFile.basename.toLowerCase().startsWith("task ")) {
          const subTitle = this.config.get("defaultSubtaskTitle");
          if (subTitle) defaultTitle = String(subTitle);
          
          const subTemplate = this.config.get("subtaskTemplate");
          if (subTemplate) defaultTemplateValue = subTemplate;
        }

        // Dropdown stores the template basename directly
        const defaultTemplate =
          typeof defaultTemplateValue === "string" ? defaultTemplateValue : "";

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

    // Cards container
    const cardsEl = columnEl.createDiv("bases-kanban-column-cards");

    // Set up drag-drop on column for receiving cards
    if (enableDragDrop) {
      cardsEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        cardsEl.addClass("drag-over");
      });

      cardsEl.addEventListener("dragleave", (e) => {
        // Only remove if leaving the container entirely
        if (!cardsEl.contains(e.relatedTarget as Node)) {
          cardsEl.removeClass("drag-over");
        }
      });

      cardsEl.addEventListener("drop", async (e) => {
        e.preventDefault();
        cardsEl.removeClass("drag-over");

        const filePath = e.dataTransfer?.getData("text/plain");
        if (!filePath) return;

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return;

        // Update the column property in frontmatter
        try {
          await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // Set as array format like the QuickAdd does
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

    // Render cards
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

  private renderCard(
    container: HTMLElement,
    item: BasesEntry,
    order: string[],
    columnProperty: string,
    showSubtaskButton: boolean,
    enableDragDrop: boolean,
    stripPrefix: string,
    stripSuffix: string,
    linkPropertyName: string
  ): void {
    const cardEl = container.createDiv("bases-kanban-card");
    cardEl.dataset.path = item.file.path;

    // Enable drag and drop
    if (enableDragDrop) {
      cardEl.draggable = true;
      cardEl.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", item.file.path);
        cardEl.addClass("is-dragging");
      });
      cardEl.addEventListener("dragend", () => {
        cardEl.removeClass("is-dragging");
      });
    }

    // Make entire card clickable
    cardEl.addEventListener("click", (e) => {
      // Don't navigate if clicking on a link inside or dragging
      if ((e.target as HTMLElement).closest("a")) return;
      const file = this.app.vault.getAbstractFileByPath(item.file.path);
      if (file instanceof TFile) {
        this.app.workspace.getLeaf(false).openFile(file);
      }
    });

    // Process title - strip prefix/suffix if configured
    let displayTitle = item.file.basename;
    if (
      stripPrefix &&
      displayTitle.toLowerCase().startsWith(stripPrefix.toLowerCase())
    ) {
      displayTitle = displayTitle.slice(stripPrefix.length).trim();
    }
    if (
      stripSuffix &&
      displayTitle.toLowerCase().endsWith(stripSuffix.toLowerCase())
    ) {
      displayTitle = displayTitle.slice(0, -stripSuffix.length).trim();
    }

    // Card header with title and subtask button
    const headerEl = cardEl.createDiv("bases-kanban-card-header");
    const titleEl = headerEl.createDiv("bases-kanban-card-title");
    titleEl.createSpan({ text: displayTitle });

    // Add subtask button
    if (showSubtaskButton) {
      const subtaskBtn = headerEl.createEl("button", {
        cls: "bases-kanban-subtask-btn clickable-icon",
        attr: { "aria-label": "Add subnote" }
      });
      setIcon(subtaskBtn, "plus");
      subtaskBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Don't open the note

        // Resolve subtask template - dropdown stores the basename directly
        const subtaskTemplateValue = this.config.get("subtaskTemplate");
        const subtaskTemplate =
          typeof subtaskTemplateValue === "string" ? subtaskTemplateValue : "";

        // Get default subtask title
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

    // Handle hover preview on card
    cardEl.addEventListener("mouseover", (e) => {
      this.app.workspace.trigger("hover-link", {
        event: e,
        source: "bases-kanban-view",
        hoverParent: cardEl,
        targetEl: cardEl,
        linktext: item.file.path
      });
    });

    // Render selected properties
    const propsEl = cardEl.createDiv("bases-kanban-card-properties");

    for (const propName of order) {
      // Skip file.name (already shown as title) and the column property
      if (propName === "file.name" || propName === "file.basename") continue;
      if (propName === columnProperty) continue;

      try {
        const propValue = item.getValue(propName);

        // Handle different return types from getValue
        let valueStr = "";
        let isEmpty = true;

        if (propValue === null || propValue === undefined) {
          isEmpty = true;
        } else if (
          typeof propValue === "object" &&
          "isEmpty" in propValue &&
          typeof propValue.isEmpty === "function"
        ) {
          // It's a Value object with isEmpty method
          isEmpty = propValue.isEmpty();
          valueStr = propValue.toString();
        } else if (typeof propValue === "object" && "toString" in propValue) {
          // Object with toString
          valueStr = propValue.toString();
          isEmpty =
            !valueStr ||
            valueStr === "" ||
            valueStr === "null" ||
            valueStr === "undefined";
        } else {
          // Primitive value
          valueStr = String(propValue);
          isEmpty =
            !valueStr ||
            valueStr === "" ||
            valueStr === "null" ||
            valueStr === "undefined";
        }

        if (isEmpty) continue;

        const propEl = propsEl.createDiv("bases-kanban-card-property");

        // Clean up property name for display
        const displayName = propName
          .replace("file.", "")
          .replace("formula.", "")
          .replace("note.", "");

        propEl.createDiv({ cls: "kanban-property-label", text: displayName });
        propEl.createDiv({ cls: "kanban-property-value", text: valueStr });
      } catch {
        // Silently skip properties that can't be read
      }
    }
  }
}

class QuickAddModal extends Modal {
  private columnProperty: string;
  private columnValue: string;
  private plugin: BasesKanbanViewPlugin;
  private noteTitle: string = "";
  private selectedTemplate: TFile | null = null;
  private defaultTitle: string;
  private defaultTemplatePath: string;
  private linkPropertyName: string;
  private linkValue: string;

  constructor(
    app: App,
    columnProperty: string,
    columnValue: string,
    defaultTitle: string,
    defaultTemplate: string,
    linkPropertyName: string,
    linkValue: string,
    plugin: BasesKanbanViewPlugin
  ) {
    super(app);
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

    // Set template from config (if configured)
    if (this.defaultTemplatePath) {
      const templates = this.getTemplates();
      const matchingTemplate = templates.find(
        (t) => t.basename === this.defaultTemplatePath
      );
      if (matchingTemplate) {
        this.selectedTemplate = matchingTemplate;
      }
    }

    // Note title input
    new Setting(contentEl)
      .setName("Title")
      .setDesc("Name for the new note")
      .addText((text) => {
        text.setPlaceholder("Enter note title...");
        text.setValue(this.defaultTitle);
        text.onChange((value) => {
          this.noteTitle = value;
        });
        // Focus the input
        setTimeout(() => text.inputEl.focus(), 50);
      });

    // Create button
    new Setting(contentEl).addButton((btn) => {
      btn
        .setButtonText("Create")
        .setCta()
        .onClick(() => this.createNote());
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private getTemplates(): TFile[] {
    const templates: TFile[] = [];
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");

    if (templateFolder instanceof TFolder) {
      for (const child of templateFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          templates.push(child);
        }
      }
    }

    // Sort alphabetically for consistent ordering
    templates.sort((a, b) => a.basename.localeCompare(b.basename));
    return templates;
  }

  private async createNote() {
    if (!this.noteTitle.trim()) {
      return;
    }

    const fileName = `${this.noteTitle.trim()}.md`;

    // Build frontmatter with list format for column property
    let frontmatterProps = `${this.columnProperty}:\n  - ${this.columnValue}`;

    // Add link property if configured (quote to prevent YAML [[]] list interpretation)
    if (this.linkPropertyName && this.linkValue) {
      frontmatterProps += `\n${this.linkPropertyName}: "${this.linkValue}"`;
    }

    let content: string;

    if (this.selectedTemplate) {
      const templateContent = await this.app.vault.read(this.selectedTemplate);

      // If template has frontmatter, modify it
      if (templateContent.startsWith("---")) {
        const endOfFrontmatter = templateContent.indexOf("---", 3);
        if (endOfFrontmatter !== -1) {
          let templateFrontmatter = templateContent
            .slice(4, endOfFrontmatter)
            .trim();
          const templateBody = templateContent.slice(endOfFrontmatter + 3);

          // Check if template already has the column property
          // Match patterns like "status:" or "status:\n  - value"
          const propRegex = new RegExp(
            `^${this.columnProperty}:.*(?:\\n  - .*)*`,
            "m"
          );

          if (propRegex.test(templateFrontmatter)) {
            // Replace existing column property with new value
            templateFrontmatter = templateFrontmatter.replace(
              propRegex,
              `${this.columnProperty}:\n  - ${this.columnValue}`
            );
          } else {
            // Add column property at the beginning
            templateFrontmatter =
              `${this.columnProperty}:\n  - ${this.columnValue}` +
              "\n" +
              templateFrontmatter;
          }

          // Handle link property if configured
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
              templateFrontmatter += `\n${this.linkPropertyName}: "${this.linkValue}"`;
            }
          }

          content = `---\n${templateFrontmatter}\n---\n${templateBody}`;
        } else {
          // Malformed frontmatter, just prepend
          content = `---\n${frontmatterProps}\n---\n\n${templateContent}`;
        }
      } else {
        // No frontmatter in template
        content = `---\n${frontmatterProps}\n---\n\n${templateContent}`;
      }
    } else {
      // No template selected
      content = `---\n${frontmatterProps}\n---\n\n`;
    }

    try {
      const file = await this.app.vault.create(fileName, content);
      this.app.workspace.getLeaf(false).openFile(file);
      this.close();
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  }
}

class SubtaskModal extends Modal {
  private parentBasename: string;
  private parentPath: string;
  private plugin: BasesKanbanViewPlugin;
  private subtaskTitle: string = "";
  private selectedTemplate: TFile | null = null;
  private defaultTemplatePath: string;
  private defaultTitle: string;
  private linkPropertyName: string;

  constructor(
    app: App,
    parentBasename: string,
    parentPath: string,
    defaultTemplate: string,
    defaultTitle: string,
    linkPropertyName: string,
    plugin: BasesKanbanViewPlugin
  ) {
    super(app);
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

    // Set template from config (if configured)
    if (this.defaultTemplatePath) {
      const templates = this.getTemplates();
      const matchingTemplate = templates.find(
        (t) => t.basename === this.defaultTemplatePath
      );
      if (matchingTemplate) {
        this.selectedTemplate = matchingTemplate;
      }
    }

    new Setting(contentEl)
      .setName("Subnote title")
      .setDesc("Name for the new subnote")
      .addText((text) => {
        text.setPlaceholder("Enter subnote title...");
        text.setValue(this.defaultTitle);
        text.onChange((value) => {
          this.subtaskTitle = value;
        });
        // Focus the input
        setTimeout(() => text.inputEl.focus(), 50);

        // Submit on Enter
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.createSubtask();
          }
        });
      });

    new Setting(contentEl).addButton((btn) => {
      btn
        .setButtonText("Create subnote")
        .setCta()
        .onClick(() => this.createSubtask());
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private getTemplates(): TFile[] {
    const templates: TFile[] = [];
    const templateFolder = this.app.vault.getAbstractFileByPath("templates");

    if (templateFolder instanceof TFolder) {
      for (const child of templateFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          templates.push(child);
        }
      }
    }

    templates.sort((a, b) => a.basename.localeCompare(b.basename));
    return templates;
  }

  private async createSubtask() {
    if (!this.subtaskTitle.trim()) {
      return;
    }

    const fileName = `${this.subtaskTitle.trim()}.md`;

    // Build frontmatter with link property (only if configured)
    const linkValue = `"[[${this.parentBasename}]]"`;
    const linkPropertyYaml = this.linkPropertyName
      ? `${this.linkPropertyName}: ${linkValue}`
      : "";

    let content: string;

    if (this.selectedTemplate) {
      const templateContent = await this.app.vault.read(this.selectedTemplate);

      // If template has frontmatter, modify it
      if (templateContent.startsWith("---")) {
        const endOfFrontmatter = templateContent.indexOf("---", 3);
        if (endOfFrontmatter !== -1) {
          let templateFrontmatter = templateContent
            .slice(4, endOfFrontmatter)
            .trim();
          const templateBody = templateContent.slice(endOfFrontmatter + 3);

          // Handle link property if configured
          if (this.linkPropertyName) {
            const linkPropRegex = new RegExp(
              `^${this.linkPropertyName}:.*$`,
              "m"
            );

            if (linkPropRegex.test(templateFrontmatter)) {
              // Replace existing property with new value
              templateFrontmatter = templateFrontmatter.replace(
                linkPropRegex,
                linkPropertyYaml
              );
            } else {
              // Add property at the beginning
              templateFrontmatter =
                linkPropertyYaml + "\n" + templateFrontmatter;
            }
          }

          content = `---\n${templateFrontmatter}\n---${templateBody}`;
        } else {
          // Malformed frontmatter, just prepend
          const fm = linkPropertyYaml ? linkPropertyYaml + "\n" : "";
          content = `---\n${fm}---\n\n${templateContent}`;
        }
      } else {
        // No frontmatter in template
        const fm = linkPropertyYaml ? linkPropertyYaml + "\n" : "";
        content = `---\n${fm}---\n\n${templateContent}`;
      }
    } else {
      // No template selected - create minimal note
      const fm = linkPropertyYaml ? linkPropertyYaml + "\n" : "";
      content = `---\n${fm}status:\n  - backlog\n---\n\n`;
    }

    try {
      const file = await this.app.vault.create(fileName, content);
      this.app.workspace.getLeaf(false).openFile(file);
      this.close();
    } catch (e) {
      console.error("Failed to create subtask:", e);
    }
  }
}
