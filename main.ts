import {
  App,
  Modal,
  Plugin,
  TFile,
  TFolder,
  Setting,
  FuzzyMatch,
  FuzzySuggestModal,
  setIcon
} from "obsidian";

// Type declarations for Bases API (not yet in official typings)
declare module "obsidian" {
  interface Plugin {
    registerBasesView(
      type: string,
      config: {
        name: string;
        icon: string;
        options?: () => ViewOption[];
        factory: (
          controller: QueryController,
          containerEl: HTMLElement
        ) => BasesView;
      }
    ): void;
  }

  interface ViewOption {
    displayName: string;
    key: string;
    default: string | number | boolean;
    type: "text" | "toggle" | "slider" | "dropdown";
    sliderConfig?: { min: number; max: number; step: number };
    dropdownOptions?: { value: string; display: string }[];
    options?: string[];
  }

  interface QueryController {
    app: App;
  }

  interface ViewConfig {
    get(key: string): unknown;
    getOrder(): string[];
  }

  interface GroupedData {
    key: unknown;
    entries: Value[];
  }

  interface ViewData {
    groupedData: GroupedData[];
    ungroupedData: Value[];
  }

  interface Value {
    isEmpty(): boolean;
    toString(): string;
    getValue(key: string): Value;
    file: {
      name: string;
      basename: string;
      path: string;
      extension: string;
    };
  }

  abstract class BasesView {
    readonly type: string;
    readonly app: App;
    readonly config: ViewConfig;
    readonly data: ViewData;
    constructor(controller: QueryController);
    abstract onDataUpdated(): void;
  }
}

// Re-import after declaration
import { BasesView, QueryController, Value, ViewOption } from "obsidian";

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
      },
      {
        displayName: "Show subtask button on cards",
        key: "showSubtaskButton",
        default: true,
        type: "toggle"
      },
      {
        displayName: "Subtask template",
        key: "subtaskTemplate",
        default: "",
        type: "dropdown",
        options: this.getTemplateOptions()
      },
      {
        displayName: "Default new subtask title",
        key: "defaultSubtaskTitle",
        default: "",
        type: "text"
      }
    ];
  }

  public getTemplateOptions(): string[] {
    const options: string[] = [""];
    const templateNames: string[] = [];

    const templateFolder = this.app.vault.getAbstractFileByPath("templates");
    if (templateFolder instanceof TFolder) {
      for (const child of templateFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          templateNames.push(child.basename);
        }
      }
    }

    // Sort alphabetically for consistent ordering
    templateNames.sort();
    options.push(...templateNames);

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
    const cardWidth = Number(this.config.get("cardWidth")) || 250;
    const showEmptyColumns = this.config.get("showEmptyColumns") !== false;
    const showQuickAdd = this.config.get("quickAdd") !== false;
    const showSubtaskButton = this.config.get("showSubtaskButton") !== false;
    const stripPrefix = String(this.config.get("stripPrefix") || "");
    const stripSuffix = String(this.config.get("stripSuffix") || "");
    const order = this.config.getOrder();

    // Set card width CSS variable
    this.containerEl.style.setProperty("--kanban-card-width", `${cardWidth}px`);

    // Collect all items from the data
    const allItems: Value[] = [];

    // Try groupedData first (this is how Bases provides data to views)
    if (this.data?.groupedData && Array.isArray(this.data.groupedData)) {
      for (const group of this.data.groupedData) {
        if (group?.entries && Array.isArray(group.entries)) {
          allItems.push(...group.entries);
        }
      }
    }

    // Fallback to ungroupedData if available and groupedData was empty
    if (
      allItems.length === 0 &&
      this.data?.ungroupedData &&
      Array.isArray(this.data.ungroupedData)
    ) {
      allItems.push(...this.data.ungroupedData);
    }

    if (allItems.length === 0) {
      this.containerEl.createDiv({
        cls: "bases-kanban-no-data",
        text: "No items to display."
      });
      return;
    }

    // Group data by column property
    const columnMap = new Map<string, Value[]>();

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
        columnName,
        items,
        order,
        columnProperty,
        showQuickAdd,
        showSubtaskButton,
        stripPrefix,
        stripSuffix
      );
    }
  }

  private renderColumn(
    columnName: string,
    items: Value[],
    order: string[],
    columnProperty: string,
    showQuickAdd: boolean,
    showSubtaskButton: boolean,
    stripPrefix: string,
    stripSuffix: string
  ): void {
    const columnEl = this.containerEl.createDiv("bases-kanban-column");
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
        const defaultTitle = String(this.config.get("defaultNoteTitle") || "");
        const defaultTemplateValue = this.config.get("defaultTemplate");

        console.log(
          "Raw defaultTemplateValue:",
          defaultTemplateValue,
          "type:",
          typeof defaultTemplateValue
        );

        // Bases stores the index (possibly as string), so we need to look up the template name
        let defaultTemplate = "";
        const indexValue =
          typeof defaultTemplateValue === "string"
            ? parseInt(defaultTemplateValue, 10)
            : defaultTemplateValue;

        if (
          typeof indexValue === "number" &&
          !isNaN(indexValue) &&
          indexValue > 0
        ) {
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

    // Cards container
    const cardsEl = columnEl.createDiv("bases-kanban-column-cards");

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
        stripPrefix,
        stripSuffix
      );
    }
  }

  private renderCard(
    container: HTMLElement,
    item: Value,
    order: string[],
    columnProperty: string,
    showSubtaskButton: boolean,
    stripPrefix: string,
    stripSuffix: string
  ): void {
    const cardEl = container.createDiv("bases-kanban-card");
    cardEl.dataset.path = item.file.path;

    // Make entire card clickable
    cardEl.addEventListener("click", (e) => {
      // Don't navigate if clicking on a link inside
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
        attr: { "aria-label": "Add subtask" }
      });
      setIcon(subtaskBtn, "plus");
      subtaskBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Don't open the note

        // Resolve subtask template
        const subtaskTemplateValue = this.config.get("subtaskTemplate");
        let subtaskTemplate = "";
        const indexValue =
          typeof subtaskTemplateValue === "string"
            ? parseInt(subtaskTemplateValue, 10)
            : subtaskTemplateValue;

        if (
          typeof indexValue === "number" &&
          !isNaN(indexValue) &&
          indexValue > 0
        ) {
          const options = this.plugin.getTemplateOptions();
          if (indexValue < options.length) {
            subtaskTemplate = options[indexValue];
          }
        }

        // Get default subtask title
        const defaultSubtaskTitle = String(this.config.get("defaultSubtaskTitle") || "");

        new SubtaskModal(
          this.app,
          item.file.basename,
          item.file.path,
          subtaskTemplate,
          defaultSubtaskTitle,
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

  constructor(
    app: App,
    columnProperty: string,
    columnValue: string,
    defaultTitle: string,
    defaultTemplate: string,
    plugin: BasesKanbanViewPlugin
  ) {
    super(app);
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

    // Set template from config (if configured)
    console.log("defaultTemplatePath:", this.defaultTemplatePath);
    if (this.defaultTemplatePath) {
      const templates = this.getTemplates();
      console.log(
        "Available templates:",
        templates.map((t) => t.basename)
      );
      const matchingTemplate = templates.find(
        (t) => t.basename === this.defaultTemplatePath
      );
      console.log("Matching template:", matchingTemplate);
      if (matchingTemplate) {
        this.selectedTemplate = matchingTemplate;
      }
    }
    console.log("Selected template:", this.selectedTemplate);

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
    const columnPropertyYaml = `${this.columnProperty}:\n  - ${this.columnValue}`;

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
              columnPropertyYaml
            );
          } else {
            // Add column property at the beginning
            templateFrontmatter =
              columnPropertyYaml + "\n" + templateFrontmatter;
          }

          content = `---\n${templateFrontmatter}\n---\n${templateBody}`;
        } else {
          // Malformed frontmatter, just prepend
          content = `---\n${columnPropertyYaml}\n---\n\n${templateContent}`;
        }
      } else {
        // No frontmatter in template
        content = `---\n${columnPropertyYaml}\n---\n\n${templateContent}`;
      }
    } else {
      // No template selected
      content = `---\n${columnPropertyYaml}\n---\n\n`;
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

  constructor(
    app: App,
    parentBasename: string,
    parentPath: string,
    defaultTemplate: string,
    defaultTitle: string,
    plugin: BasesKanbanViewPlugin
  ) {
    super(app);
    this.parentBasename = parentBasename;
    this.parentPath = parentPath;
    this.defaultTemplatePath = defaultTemplate;
    this.defaultTitle = defaultTitle;
    this.subtaskTitle = defaultTitle;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("bases-kanban-subtask-modal");

    contentEl.createEl("h3", { text: `Add subtask to "${this.parentBasename}"` });

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

    // Subtask title input
    new Setting(contentEl)
      .setName("Subtask title")
      .setDesc("Name for the new subtask")
      .addText((text) => {
        text.setPlaceholder("Enter subtask title...");
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

    // Create button
    new Setting(contentEl).addButton((btn) => {
      btn
        .setButtonText("Create subtask")
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
    
    // Build frontmatter with parent link
    const parentLink = `"[[${this.parentBasename}]]"`;
    const parentPropertyYaml = `parent: ${parentLink}`;

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

          // Check if template already has parent property (with or without value)
          const parentRegex = /^parent:.*$/m;

          if (parentRegex.test(templateFrontmatter)) {
            // Replace existing parent property with new value
            templateFrontmatter = templateFrontmatter.replace(
              parentRegex,
              parentPropertyYaml
            );
          } else {
            // Add parent property at the beginning
            templateFrontmatter = parentPropertyYaml + "\n" + templateFrontmatter;
          }

          content = `---\n${templateFrontmatter}\n---${templateBody}`;
        } else {
          // Malformed frontmatter, just prepend
          content = `---\n${parentPropertyYaml}\n---\n\n${templateContent}`;
        }
      } else {
        // No frontmatter in template
        content = `---\n${parentPropertyYaml}\n---\n\n${templateContent}`;
      }
    } else {
      // No template selected - create minimal note with parent
      content = `---\n${parentPropertyYaml}\nstatus:\n  - backlog\n---\n\n`;
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
