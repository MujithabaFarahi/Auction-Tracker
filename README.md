# 🏏 Auction Tracker MVP

Auction Tracker lets admins manage multiple tournaments and run one live player auction at a time. Team captains can follow the auction, player pool, and team budgets from the public view.

## 🌟 Key Features

### 🛠 Admin Features (Full Control)
- **Tournament Setup** — Create and select tournaments, configure team budgets and sizes, and choose the tournament shown live.
- **Player & Team Management** — Manage teams and players per tournament, import players from TSV, and add optional photo links.
- **Live Auction Control**:
  - Start bidding with auto-calculation of minimum bids.
  - Quick bid difference buttons for 5,000 and 10,000, plus a manual amount.
  - Dedicated bid history (undo incorrect bids safely).
- **Real-Time Sync**: Firestore listeners automatically push changes so that all connected devices see the current bid instantaneously.
  
### 👀 Public View (For Captains)
- **Live Action Tab**: Watch the current player on the block, the current bid, and the latest bid history in real-time.
- **Completed Sales**: View a grid of sold players sorted by latest sales or highest prices.
- **Teams & Roster**: Track how much purse each team has left, who they've bought, and their remaining auction power.
- **Player Directory** — Browse, search, and filter players. Click a photo to open the original link in a new tab.

## 💻 Tech Stack

- **Frontend Framework:** React 19 + TypeScript
- **Build Tool:** Vite (using Rolldown)
- **Styling:** TailwindCSS 4, Radix UI Primitives, Lucide Icons, Shadcn UI
- **Backend & Database:** Firebase Firestore (Real-time DB) & Firebase Auth
- **Routing:** React Router v7
- **State Management:** React hooks, Zustand, and Firebase real-time listeners

## 📂 Project Structure

```text
src/
├── assets/        # Static assets
├── components/    # Reusable UI components (buttons, dialogs, cards)
├── lib/           # Utility functions and core Firebase logic
├── pages/         # Top-level React routes (Admin, Live, Teams, etc.)
├── theme/         # Theming constraints and dark mode wrappers
├── App.tsx        # Main application layout and routes
└── main.tsx       # Entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20.19+ on the Node 20 line, or Node.js 22.12+
- A Firebase project with Firestore and Firebase Auth Email/Password enabled, plus an account for the auction admin

### 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory and add your Firebase configuration. You can copy the structure from `.env.example`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Running Locally

Start the Vite development server:

```bash
npm run dev
```

Open [Admin Setup](http://localhost:5173/admin/setup) or the [public auction](http://localhost:5173/auction/view). The dev server uses the Firebase project configured in your environment. Use a separate Firebase project for test tournaments.

### 4. Building for Production

To create a production-ready bundle, run:

```bash
npm run build
```

This will run TypeScript type checking and then bundle the application into the `dist/` directory.

## Running an auction

1. Sign in to **Admin → Setup** and click **New tournament**, or select an existing tournament.
2. Enter the name, season, team purse, and team size. Save the tournament, then add teams and players to it.
3. Click **Set as live**. The public Live tab and the admin auction controls now use the selected tournament.
4. In **Admin → Auction**, select an available player and click **Start auction**.

When no tournament is set live, public viewers can use the tournament selector. The Live tab shows a player as soon as the admin selects one, and bidding begins when the admin clicks **Start auction**.

### Player photos

In **Admin → Setup → Players**, paste a direct image URL or a Google Drive file share link into **Image link (optional)**. For a Drive photo to load for public viewers, set its general access to **Anyone with the link**. The admin and public auction screens, player lists, and public player details show a preview. Clicking a photo opens the original URL in a new tab. Missing or unavailable photos use a placeholder.

## Firebase deployment

The app uses `config/app.activeTournamentId` to select the live tournament. Each tournament has its own teams, players, and auction state under `tournaments/{tournamentId}`. Configure your project's Firestore rules for these paths. Public viewers need read access to the auction data, and the app's signed-in admin actions need write access.

The previous single-tournament version used `tournament/current`, `teams`, `players`, and `auctionState/current` at the database root. To carry existing data into the new version, back it up and migrate it into a tournament before switching the deployment. Preserve team and player document IDs so bid, roster, and sale references still resolve, and set the new tournament as live in Setup. The new version reads the tournament-scoped collections, so unmigrated records will be absent from its views. See [the Firestore data model](REQUIREMENTS.md#firestore-data-model).

---
*Created as an MVP for managing seamless, fast-paced sports auctions.*
