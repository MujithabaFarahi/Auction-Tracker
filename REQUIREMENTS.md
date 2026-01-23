# Auction Tracker MVP Requirements

## Purpose
Build an MVP web app to run and view a **single** live auction for one tournament.

## Fixed Stack
- Frontend: React (web)
- Database: Firebase Firestore
- Auth: Firebase Auth (admin only)
- Real-time: Firestore listeners

## Core Rules
- One tournament only
- Auction tracking only
- No payments, analytics, chat, notifications
- Captains are view-only (no auth)

## Roles
### Admin
- Authenticated via Firebase Auth
- Full control (create/edit/manage)

### Captains (View-only)
- No auth required
- Read-only auction view

## Firestore Data Model
### Tournament (single document)
```
tournament {
  name: string
  season: string
  teamPurse: number
  teamSize: number
}
```

### Teams (collection)
```
teams {
  id: string
  name: string
  captainName: string
  totalPurse: number
  remainingPurse: number
  spentAmount: number
  playersCount: number
  maxBidAmount: number
}
```
Rules: remainingPurse must not go below zero.

### Players (collection)
```
players {
  id: string
  name: string
  contactNumber: string
  area: string
  role: string
  basePrice: number
  regularTeam: string
  createdAt: number
  status: "AVAILABLE" | "SOLD"
  soldToTeamId: string | null
  soldPrice: number | null
  soldAt: number | null
  bidHistory: Bid[]
}
```
Allowed roles:
- Batsman
- Wicket-keeper Batsman
- Fast Bowler
- Spin Bowler
- All-Rounder (Pace)
- All-Rounder (Spin)
Allowed areas:
- Nangalla
- Mangedara
- Majeedpura

### Auction State (single document)
```
auctionState {
  currentPlayerId: string | null
  currentBid: number
  leadingTeamId: string | null
  status: "IDLE" | "LIVE" | "SOLD"
  bidHistory: Bid[]
}
```

### Bid
```
Bid {
  teamId: string
  teamName: string
  amount: number
  timestamp: number
}
```

## Functional Requirements
### Admin Authentication
- Email/password login
- Any authenticated user is admin

### Team Setup
- Create teams with name + captain; total purse pulled from tournament
- Remaining purse auto-calculated; spent tracked in team doc
- Prefer disabling edits during live auction

### Player Setup
- Add/edit players before auction
- Editing allowed even when auction is live
- Cannot edit once sold
- Optional assign-to-team at creation (sold at 0 cost)
- Admin can delete players
- Deleting sold players refunds team purse by soldPrice
- Admin can edit players from player detail view
- Admin can assign team-less players to a team with price 0 (no purse impact)
- Player list defaults to createdAt ordering

### Auction Control
- Select player
- Start auction
- Stop/revert live auction to reselect player
- Enter/update bid amount
- Set bid difference (2k/5k/10k quick buttons + manual)
- Bid difference auto-escalates at 40,000 and 100,000
- Bid difference resets to 2,000 for each new player
- Bid amount auto-updates with bid difference changes
- Minimum bid = 20,000 for first bid, then current bid + difference
- Same team cannot bid twice in a row
- Set leading team
- Mark SOLD (confirm with player, team, price)
- On SOLD: update team purse, player status/price/team, reset auction
- After SOLD: auto-load next available player when present
- After a bid: clear selected team to prevent repeat bids
- Delete incorrect bid entries from history
- Bid submission supports local queue with background sync

### View-Only Auction
- Current player
- Role + base price
- Current bid + leading team
- Team labels include captain name for clarity
- Team remaining purse
- Team maximum bid amount
- Sold players list
- Completed, Players, and Teams use card/tile grid layouts
- Player bid history shown newest first

## Live Bid History (Mandatory)
- Persisted and visible for admin + captains
- Bids must be >= base price and > previous bid
- Winning bid is last entry

## Validation Rules
- Team purse cannot go below zero
- Same team cannot bid twice in a row
- Bid must be >= current bid + difference (admin UI)
- Player sold once only
- One active auction at a time
- Auction must have selected player
