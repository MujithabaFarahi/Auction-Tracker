# Auction Tracker MVP Requirements

## Purpose
Run and view live player auctions across multiple tournaments, with one tournament selected for live auction control at a time.

## Fixed Stack
- Frontend: React (web)
- Database: Firebase Firestore
- Auth: Firebase Auth (admin only)
- Real-time: Firestore listeners

## Core Rules
- Store each tournament's teams, players, and auction state independently
- Use one active tournament for the public live view and admin auction controls
- Auction tracking only
- No payments, analytics, or chat
- Captains are view-only (no auth)

## Roles
### Admin
- Authenticated via Firebase Auth
- Full control (create/edit/manage)

### Captains (View-only)
- No auth required
- Read-only auction view

## Firestore Data Model
### App configuration (`config/app`)
```
{
  activeTournamentId: string | null
}
```

### Tournament (`tournaments/{tournamentId}`)
```
tournament {
  name: string
  season: string
  teamPurse: number
  teamSize: number
  status: "PENDING" | "LIVE" | "COMPLETED"
  createdAt: number
}
```

### Teams (`tournaments/{tournamentId}/teams/{teamId}`)
```
teams {
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

### Players (`tournaments/{tournamentId}/players/{playerId}`)
```
players {
  name: string
  contactNumber: string
  area?: string
  role: string
  basePrice: number
  regularTeam?: string
  imageUrl: string | null
  createdAt?: number
  status: "AVAILABLE" | "UNSOLD" | "DRAFTED" | "SOLD"
  soldToTeamId: string | null
  soldPrice: number | null
  soldAt: number | null
  bidHistory?: Bid[]
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

### Auction State (`tournaments/{tournamentId}/auctionState/current`)
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
- The admin UI accepts signed-in Firebase users. Enforce write authorization with Firestore rules.

### Tournament Setup
- Create and select a tournament in Admin Setup
- Configure the tournament's name, season, team purse, and team size
- Set a tournament as live to use it in Admin Auction and the public Live view
- Mark a tournament completed after bidding stops. Clear its live selection if it is the active tournament.

### Team Setup
- Create teams with name + captain; total purse pulled from tournament
- Remaining purse auto-calculated; spent tracked in team doc
- Prefer disabling edits during live auction

### Player Setup
- Add/edit players before auction
- Editing allowed even when auction is live
- Exclude sold and drafted players from auction selection
- Optionally draft a player to a team at creation with zero purse impact
- Admin can delete players
- Deleting sold players refunds team purse by soldPrice
- Optional photo link accepts a direct image URL or Google Drive file share URL
- Show a placeholder for missing or unavailable photos
- Clicking a photo opens the original link in a new tab
- Admin can assign team-less players to a team with price 0 (no purse impact)
- Player list defaults to createdAt ordering

### Auction Control
- Select player
- Start auction
- Stop/revert live auction to reselect player
- Enter/update bid amount
- Set the bid difference with 5,000 and 10,000 quick buttons or a manual amount
- Enforce a bid difference of 10,000 once the current bid reaches 100,000
- Reset the bid difference to 5,000 for each new player
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
- Start on a tournament list with team and player counts. Mark the live event and let viewers open completed tournaments.
- Keep the selected tournament in the URL and scope each tab to it
- Current player and photo preview
- Role + base price
- Current bid + leading team
- Team labels include captain name for clarity
- Team remaining purse
- Team maximum bid amount
- Sold players list
- Completed, Players, and Teams use card/tile grid layouts
- Photos appear on completed and available player cards and player detail pages
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
