# nice

**N**ode **I**ntegrated **C**ontent **E**ditor
A small schema-driven local content editor. Define a JSON schema, run `nice`, and get a local web UI for creating and editing matching JSON content files right inside your project.

There's no database or hosted service. Content lives as plain JSON files in your repo wherever you want them so your app reads them exactly the way it already reads any other JSON file, in any framework.

## Installation

```bash
npm install --save-dev @jasstsg/nice
```

## Quick start

1. Create a schema describing the shape of one kind of content:

   ```jsonc
   // nice/schemas/post.nice-schema.json
   {
     "name": "post",
     "label": "Blog Post",
     "fields": [
       { "name": "title", "type": "string" },
       { "name": "published", "type": "boolean" },
       { "name": "tags", "type": "array", "items": { "type": "string" } }
     ]
   }
   ```

2. Run it:

   ```bash
   npx nice
   ```

   OR 

   Add it as a script in your `package.json` file:
   ```json
   ...
   scripts:
    {
      ...
      "nice": "nice",
      ...
    },
    ...
    ```

    and use:
    ```bash
    npm run nice
    ```


3. Open the URL it prints (`http://localhost:6423` by default). In the **Content editor** tab, click **+ New**, pick "Blog Post" from the searchable list, fill in the fields, and save.

4. A new file shows up at `nice/content/post/<slug>.json`. Use it in your app like any other JSON:

   ```js
   import post from '../nice/content/post/my-first-post.json';
   ```

## Configuration

`nice` looks for a `nice.config.json` in the directory you run it from. Everything in it is optional — these are the defaults:

```json
{
  "schemaRoots": ["nice/schemas"],
  "contentRoots": ["nice/content"],
  "styleRoots": ["nice/styles"],
  "port": 6423
}
```

Everything defaults to living under one `nice/` folder at your project root, rather than several separate top-level folders.

| Option | Default | Description |
|---|---|---|
| `schemaRoots` | `["nice/schemas"]` | One or more folders scanned recursively for `*.nice-schema.json` files. Add more if you want schemas organized across separate locations (e.g. split by feature in a larger project). |
| `contentRoots` | `["nice/content"]` | One or more folders scanned recursively for content files. Add more if you want content to live in more than one place (e.g. alongside specific pages). |
| `styleRoots` | `["nice/styles"]` | One or more folders scanned recursively for `*.css` files. See [Customizing the look](#customizing-the-look). |
| `port` | `6423` | Local server port. (It spells N‑I‑C‑E on a phone keypad.) |

All paths are resolved relative to the current working directory `nice` is launched from.

### Customizing the look

The UI's colors, fonts, and corner radius are all CSS custom properties defined at the top of its stylesheet, so re-theming doesn't require overriding individual rules — just redeclare the variables you want to change. Drop as many `.css` files as you want under a configured `styleRoot` (`nice/styles/` by default) — they're all loaded, concatenated in path order, after the built-in stylesheet, so anything they declare wins the cascade:

```css
/* nice/styles/theme.css */
:root {
  --nice-accent: #ff6600;
  --nice-sidebar-bg: #14161c;
  --nice-radius: 8px;
}
```

No config needed beyond having the file exist somewhere under a `styleRoot` — same self-organizing model as schemas and content. The full list of variables (accent/danger colors, sidebar palette, fonts, border radius) is at the top of [`src/styles.css`](src/styles.css) in this repo. For anything the variables don't cover, these files are also just loaded after the built-in one, so any selector you write wins the cascade too.

## Schemas

A schema file needs a `name` and a `fields` array. `label` is optional and only affects display text in the UI.

```json
{
  "name": "work-experience-item",
  "label": "Work Experience",
  "fields": [
    { "name": "institution", "type": "string" },
    { "name": "title", "type": "string" },
    { "name": "dateStarted", "type": "string" },
    { "name": "dateEnded", "type": "string" },
    { "name": "skills", "type": "array", "items": { "type": "string" } }
  ]
}
```

Schema files must live somewhere under one of your configured `schemaRoots` and their filename must end in `.nice-schema.json` — that extension is how they're discovered, so a schema folder can safely hold other unrelated JSON without it being mistaken for a schema.

### Field types

| Type | Renders as | Extra properties |
|---|---|---|
| `string` | Text input | |
| `number` | Number input | |
| `boolean` | Checkbox | |
| `enum` | Dropdown of fixed choices | `options: string[]` |
| `object` | Embedded sub-form, reusing another schema's shape | `schema: "<schema name>"` |
| `array` | Repeatable list (add / remove / reorder) | `items: <a field definition>` — the item type, which can itself be any type above, including `object` or `reference` |
| `reference` | Picker pointing at another schema's saved content, by id | `schema: "<schema name>"` |

A `reference` field's value is a small self-describing object, `{ "$niceSchema": "<schema>", "$id": "<id>" }`, rather than a bare id string — that's what lets it be resolved back into the full object later (see below) without needing to consult the schema that produced it.

A schema can reference another schema's items instead of embedding them, which is how you split content across multiple files while still composing it into a larger shape:

```json
{
  "name": "resume",
  "label": "Resume",
  "fields": [
    { "name": "summary", "type": "string" },
    {
      "name": "work",
      "type": "array",
      "items": { "type": "reference", "schema": "work-experience-item" }
    }
  ]
}
```

Here, `resume.work` stores an ordered list of references to `work-experience-item` entries rather than embedding the full objects — each work item stays its own separately-editable file:

```json
{
  "$niceSchema": "resume",
  "$id": "resume",
  "summary": "...",
  "work": [
    { "$niceSchema": "work-experience-item", "$id": "acme-robotics" },
    { "$niceSchema": "work-experience-item", "$id": "initrode-systems" }
  ]
}
```

## Content files

Content files self-identify with two reserved keys, `$niceSchema` and `$id`, which `nice` stamps in automatically — you never write them by hand, and they're only used internally by `nice` itself to find and manage files (see [Using the content in your app](#using-the-content-in-your-app) for how they get stripped back out before you touch the data):

```json
{
  "$niceSchema": "work-experience-item",
  "$id": "acme-corp",
  "institution": "Acme Corp",
  "title": "Senior Engineer",
  "dateStarted": "Jan 2022",
  "dateEnded": "Present",
  "skills": ["TypeScript", "Node.js"]
}
```

Because discovery works off the `$niceSchema` key rather than file location, a content file can live *anywhere* inside a configured `contentRoot` — including nested in subfolders — and it'll still be found.

- **New items created without a specific path** are auto-named `<contentRoot>/<schema-name>/<slug>.json`, where the slug comes from the item's first `string` field.
- **You can instead give a new item an exact path** (a "File path" field is shown when creating something new). This is useful when your app already imports a specific filename and you don't want that import to change — e.g. pinning a `resume` schema's only instance to `nice/content/resume.json` instead of an auto-generated name.
- Once created, an item's id and file location are stable — editing it later never moves or renames the file, since other content may hold a `reference` pointing at that id.

## The UI

- **Content editor** tab — the sidebar shows a live tree of everything under your `contentRoots`. Click any recognized file to edit it right there in the main panel (no popups, no separate pages). **+ New** opens a type-to-filter list of schemas to create from.
- **Schema editor** tab — the sidebar shows a tree of your `.nice-schema.json` files. Schemas are edited as raw JSON (with server-side validation on save) rather than a visual builder, since field shapes vary enough by type that a form-based editor would add more complexity than it saves for now.
- A small **CONTENT** / **SCHEMA** badge on whatever's open in the main panel makes it unambiguous which kind of thing you're editing.

## Using the content in your app

It's just JSON on disk, so you're always free to read it however your framework already reads JSON — a pinned singleton with no references is just `import resume from '../nice/content/resume.json'`, no library needed.

For everything else, `nice` ships a single helper, `readNiceContent`, so you don't have to hand-roll directory-enumeration or reference-resolution boilerplate yourself. Pass it a file to read one item, or a directory to read a whole collection; any `reference` fields it finds anywhere in the data (however deeply nested) are automatically resolved into the full referenced object:

```js
import { readNiceContent } from 'nice';

// resume.work is already an array of full work-experience-item objects,
// not bare references - readNiceContent found and inlined them.
const resume = readNiceContent('nice/content/resume.json');

// Reading a whole collection: pass a directory instead of a file.
const workHistory = readNiceContent('nice/content/work-experience-item');
```

It reads the real JSON fresh on every call — there's no generated or cached copy of your content to go stale. `$niceSchema` is stripped from everything it returns (it's meaningless outside of `nice`), and `$id` is renamed to a plain `id`, since it's handy for React keys.

The second argument is where to look for referenced content, defaulting to `'nice/content'` to match `nice`'s own default `contentRoots`; pass an array if you've configured more than one:

```js
const resume = readNiceContent('nice/content/resume.json', ['nice/content', 'src/pages']);
```

If you're in TypeScript, it's generic — `readNiceContent<Resume>('nice/content/resume.json')` types the result as whatever interface you declare to match your schema.

## Requirements

Node.js 18 or later.

## Working on nice itself

```bash
git clone <repo>
npm install
npm run dev     # Vite dev server + the real API mounted into it, with HMR
npm run build   # compiles the TypeScript backend to build/ and the frontend to dist/
npm start       # runs the compiled production server, exactly as a consumer would
```
