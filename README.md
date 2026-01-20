# Bases Kanban View

A custom Kanban board view for Obsidian, designed to work with **Obsidian Bases**.

> **⚠️ Disclaimer**
>
> This plugin is provided **as-is** for my personal use. I have made the repository public so that others may fork it and adapt it to their needs if they wish.
>
> Please do not open issues asking for support or changes. If you want to change something, please **fork the repository**.

## Features

- **Kanban Visualization**: Automatically groups your notes into columns based on a specific property (default: `status`).
- **Drag & Drop Workflow**:
  - Move cards between columns to update their status property.
- **Quick Add**: Create new cards directly from column headers.
- **Subtasks/Subnotes**: Create related notes directly from a card (requires `Link property name` configuration under Behavior in the View settings).
- **Template Support**: Full integration with core Obsidian `templates` folder for creating new cards and subnotes.
- **Title Cleaning**: options to strip specific prefixes or suffixes from card titles for cleaner presentation.

## Installation

### Manual Installation

1. Go to the [Releases](https://github.com/sil-so/bases-kanban-view/releases) page of this repository.
2. Download the `main.js`, `manifest.json`, and `styles.css` files from the latest release.
3. Create a folder named `bases-kanban-view` in your vault's `.obsidian/plugins/` directory.
4. Place the downloaded files into that folder.
5. Reload Obsidian and enable "Bases Kanban View" in **Settings > Community plugins**.

### BRAT Installation (Recommended for Updates)

1. Install the **Obsidian 42 - BRAT** community plugin.
2. Open the command palette and run `BRAT: Add a beta plugin for testing`.
3. Enter this repository URL.
4. The plugin will be installed and can be updated via BRAT.

## Configuration

This view offers several configuration options.

### Columns

- **Column property**: The frontmatter property used to group notes into columns (default: `status`).
- **Columns (comma-separated)**: Manually define the column order (e.g., `Todo, In Progress, Done`). If left empty, columns are auto-detected from your data.
- **Show empty columns**: Toggle the visibility of columns that contain no cards.

### Cards

- **Strip from title start**: Text to automatically remove from the beginning of card titles (e.g., `Task - `).
- **Strip from title end**: Text to automatically remove from the end of card titles.

### Templates & Creation

- **Default new note title**: The default name suggested when creating a new card.
- **Default new note template**: Select a template file (from your `templates` folder) to use for new cards.
- **Default subnote title**: The default name suggested when limiting subtasks.
- **Subnote template**: Select a template file to use when creating subtasks/subnotes.

### Behavior

- **Quick add cards**: Show a `+` button in each column header for fast note creation.
- **Enable drag and drop**: Toggle the ability to drag cards between columns.
- **Show subnote button**: Show a `+` button on individual cards on hover to create sub-items.
- **Link property name**: The property name to use for linking subnotes to their parent (e.g., `parent`). Required for the subtask feature to work effectively.

## License

[MIT](LICENSE)
