# Bases Kanban View

A Kanban board view for [Obsidian Bases](https://obsidian.md/blog/introducing-obsidian-bases/).

> [!WARNING]
> This plugin is provided **as-is** for personal use. The repository is public for anyone who wants to fork and adapt it.
> Please do not open issues for support or feature requests.

## Features

📋 **Kanban visualization** — Groups notes into columns based on a property (default: `status`)

🖱️ **Drag & drop** — Move cards between columns to update their status

➕ **Quick add** — Create new cards directly from column headers

📎 **Subtasks** — Create related notes from any card (requires `Link property name` config)

📝 **Template support** — Full integration with Obsidian's templates folder

✂️ **Title cleaning** — Strip prefixes/suffixes from card titles

## Usage

1. Create a new Base in Obsidian
2. Switch to Kanban view
3. Cards are grouped by the `status` property by default

### Configuration

<details>
<summary>📊 Columns</summary>

| Setting            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| Column property    | Frontmatter property to group by (default: `status`)  |
| Columns            | Comma-separated order, e.g. `Todo, In Progress, Done` |
| Show empty columns | Toggle visibility of empty columns                    |

</details>

<details>
<summary>🃏 Cards</summary>

| Setting                | Description                             |
| ---------------------- | --------------------------------------- |
| Strip from title start | Text to remove from beginning of titles |
| Strip from title end   | Text to remove from end of titles       |

</details>

<details>
<summary>📝 Templates & Creation</summary>

| Setting                   | Description                  |
| ------------------------- | ---------------------------- |
| Default new note title    | Suggested name for new cards |
| Default new note template | Template file for new cards  |
| Default subnote title     | Suggested name for subtasks  |
| Subnote template          | Template file for subtasks   |

</details>

<details>
<summary>⚙️ Behavior</summary>

| Setting              | Description                                   |
| -------------------- | --------------------------------------------- |
| Quick add cards      | Show `+` button in column headers             |
| Enable drag and drop | Allow moving cards between columns            |
| Show subnote button  | Show `+` on cards for subtasks                |
| Link property name   | Property for linking subnotes (e.g. `parent`) |

</details>

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [Releases](../../releases) page
2. Create `.obsidian/plugins/bases-kanban-view/` in your vault
3. Place the files in that folder
4. Enable the plugin in **Settings → Community plugins**

### BRAT

1. Install [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Run `BRAT: Add a beta plugin for testing`
3. Enter this repository URL

## Images

<img width="1514" height="951" alt="SCR-20260128-nucl" src="https://github.com/user-attachments/assets/7da8c03b-9510-4a0b-a641-ac431d9a38c7" />

<img width="1514" height="951" alt="SCR-20260128-nurd" src="https://github.com/user-attachments/assets/d3e4b40d-5b52-4220-9f81-d92318761dd6" />

## License

[MIT](LICENSE)
