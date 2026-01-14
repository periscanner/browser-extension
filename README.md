# Periscanner Browser Extension

Periscanner is a powerful wallet cluster analysis tool built for Solana traders.
It integrates directly into the **Axiom** trading platform to provide real-time
insights into token holder distribution and coordinated wallet activity.

## 🚀 Key Features

- **Automatic Token Detection**: Seamlessly extracts token addresses from
  `axiom.trade` URLs.
- **Cluster Identification**: Detects groups of related wallets ("clusters")
  among top holders, helping you spot developer-controlled cabals or coordinated
  market makers.
- **Concentration Metrics**:
  - **Top 20 Hold %**: Real-time calculation of top holder concentration
    (excluding known system wallets/LPs).
  - **Periscanner Cluster %**: Specifically identifies what percentage of the
    supply is controlled by linked wallet groups.
- **Deep Analysis**: One-click "Deep Analyze" to trigger a backend scan of
  previously unindexed top holders.
- **Draggable UI**: A non-intrusive, floating widget that stays out of the way
  of your charts but remains accessible.

## 🛠 Tech Stack

- **Framework**: [Vue 3](https://vuejs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) with [CRXJS](https://crxjs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: Supabase-powered API

## 📦 Installation Guide (Developer Mode)

Since this extension is distributed as a CRX-compatible build, you can install
it on any Chromium-based browser (Chrome, Brave, Edge, Opera) using Developer
Mode.

### 1. Download the Release

Download the latest `crx-periscanner-x.x.x.zip` from the project releases.

### 2. Prepare the Files

1. Unzip the downloaded file into a folder on your computer.
2. Keep this folder in a safe place, as deleting it will remove the extension
   from your browser.

### 3. Open Browser Extensions Page

Open your browser and navigate to the extensions management page:

- **Chrome**: `chrome://extensions/`
- **Brave**: `brave://extensions/`
- **Edge**: `edge://extensions/`

### 4. Enable Developer Mode

Locate the **Developer mode** toggle (usually in the top-right corner) and turn
it **ON**.

### 5. Load the Extension

1. Click the **Load unpacked** button.
2. Navigate to and select the folder where you unzipped the extension.
3. The **Periscanner** extension should now appear in your list.

### 6. Usage

1. Navigate to any token on [Axiom.trade](https://axiom.trade/meme/).
2. Look for the floating Periscanner icon on the side of your screen.
3. Click it to open the analysis panel.

## 👨‍💻 Development

If you want to build the extension from source:

```bash
# Install dependencies
pnpm install

# Run development mode with HMR
pnpm dev

# Build for production
pnpm build
```

The build output will be in the `dist` directory.

## 🚀 Release Process

To create a new release (automated version bump, changelog, build, and GitHub
release):

1. **Prerequisites**:
   - Ensure you have a `GITHUB_TOKEN` set in your environment OR are logged in
     via `gh auth login`.
   - Ensure you are on the main branch and have a clean working directory.

2. **Run the Release Command**:
   ```bash
   pnpm run release
   ```

   This command will:
   - Analyze your commits to determine the version bump (patch, minor, or
     major).
   - Update `package.json` and generate `CHANGELOG.md`.
   - Build the extension (creating the `.zip` file).
   - Commit and tag the release.
   - Push to GitHub and create a Release with the `.zip` asset attached.
