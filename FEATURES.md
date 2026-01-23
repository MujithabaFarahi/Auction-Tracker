# Features

## Admin
- Firebase Auth email/password login
- Tournament setup (name + season + team purse + team size)
- Team setup (name, captain; purse from tournament)
- Player setup (role, base price, contact, area, regular team)
- Player setup option to assign player directly to a team (0 cost)
- Edit players even when auction is live
- Edit team details (name, captain, spent, remaining)
- Delete players (sold player deletion refunds team purse)
- Bulk import players from TSV list
- Auction control with live bid history
- Quick bid difference buttons (2k/5k/10k) with auto escalation
- Command palette player selection
- Prevent same team from bidding twice in a row
- Delete incorrect bid entries from history
- Mark player SOLD with confirmation + update team purse
- Auto-load next available player after sale
- Loading states on submit actions
- Assign team-less players from team page (no purse impact)
- Team bid buttons with max bid indicator per team
- Revert live auction start to reselect a player
- Live bid queue with background sync for faster bidding

## Public Auction View
- Live tab: current player + current bid + live bid history
- Completed tab: card grid of sold players sorted by time or price
- Players tab: tile grid with search + role filter + name/base/created sort
- Teams tab: card grid with spent/remaining + player count
- Team detail page with roster + prices
- Player detail page with bid history if sold
- Team labels shown as "Team (Captain)" for clarity
- Contact number shown only to admin on player detail
- Footer credit link (Powered by Teqgrow)

## Real-Time
- Firestore listeners for auction state, teams, and players

## Validation & Rules
- Starting bid is always 20,000 regardless of base price
- Bid must be >= current bid + difference when live
- Same team cannot bid twice in a row (admin enforced)
- Team purse cannot be exceeded (frontend + transaction)
- Sold players are immutable
- Single tournament only
