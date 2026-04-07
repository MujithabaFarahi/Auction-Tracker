# 🏏 Auction TrackerMVP

Auction Tracker is a modern, real-time web application to manage and run a live sports auction for a tournament. It features an admin portal for full auction control (team setups, player pool management, and live bidding) and a public view-only portal for team captains to watch the auction unfold in real-time.

## 🌟 Key Features

### 🛠 Admin Features (Full Control)
- **Tournament Setup**: Configure tournament details (name, season, team purse, team sizes).
- **Player & Team Management**: Add, edit, or delete players and teams. Bulk import players using TSV format.
- **Live Auction Control**:
  - Start bidding with auto-calculation of minimum bids.
  - Quick bid increment buttons (2k, 5k, 10k) with auto-escalation limits.
  - Dedicated bid history (undo incorrect bids safely).
- **Real-Time Sync**: Firestore listeners automatically push changes so that all connected devices see the current bid instantaneously.
  
### 👀 Public View (For Captains)
- **Live Action Tab**: Watch the current player on the block, the current bid, and the latest bid history in real-time.
- **Completed Sales**: View a grid of sold players sorted by latest sales or highest prices.
- **Teams & Roster**: Track how much purse each team has left, who they've bought, and their remaining auction power.
- **Player Directory**: Browse available and sold players with powerful filtering and search.

## 💻 Tech Stack

- **Frontend Framework:** React 19 + TypeScript
- **Build Tool:** Vite (using Rolldown)
- **Styling:** TailwindCSS 4, Radix UI Primitives, Lucide Icons, Shadcn UI
- **Backend & Database:** Firebase Firestore (Real-time DB) & Firebase Auth
- **Routing:** React Router v7
- **State Management:** React Hooks + Firebase real-time listeners

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
- Node.js (v20+ recommended)
- A Firebase project with Firebase Auth (Email/Password) and Firestore enabled.

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

Your app should now be running at `http://localhost:5173`.

### 4. Building for Production

To create a production-ready bundle, run:

```bash
npm run build
```

This will run TypeScript type checking and then bundle the application into the `dist/` directory.

## 📝 Design & Rules
- **One Tournament Limit:** The platform is built to handle a single active tournament.
- **Offline Reliability:** The application uses background syncing for bid queues, helping resolve latency issues when many fast bids are submitted.
- **Admin Access:** Standard users are view-only. Firebase Auth restricts destructive/auction-controlled actions exclusively to admin accounts.

---
*Created as an MVP for managing seamless, fast-paced sports auctions.*
