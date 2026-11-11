# Features

## Admin
- Firebase Auth email/password login
- Tournament setup (name + season + team purse + team size)
- Multi-tournament management with tournament-scoped teams, players, and auction state
- Create new tournaments from setup without leaving the page
- Select which tournament is being edited in setup
- Set or clear the live tournament
- Mark a tournament completed while bidding is stopped
- Team setup per tournament (name, captain; purse from tournament)
- Player setup per tournament with role, base price, contact, area, regular team, and optional image link
- Clickable photo thumbnails in Setup and a photo preview for the current player in Auction Control
- Player setup option to assign player directly to a team (0 cost)
- Edit players even when auction is live
- Edit team details (name, captain, spent, remaining)
- Delete players (sold player deletion refunds team purse)
- Bulk import players from TSV list
- Auction control scoped to the currently live tournament
- Auction control with live bid history
- Quick bid difference buttons for 5,000 and 10,000, with 10,000 enforced from a current bid of 100,000
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
- Tournament list with team and player counts and Live, Completed, and Pending badges
- Select any tournament to see its auction, results, players, and teams at a shareable URL
- Live tournament appears first. Completed tournaments open on the results tab.
- Live tab: current player + current bid + live bid history
- Completed tab: card grid of sold players sorted by time or price
- Players tab: tile grid with search + role filter + name/base/created sort
- Teams tab: card grid with spent/remaining + player count
- Team detail page with roster + prices, scoped by tournament
- Player detail page with bid history if sold, scoped by tournament
- Photo previews in Live, Completed, Players, and player details. A click opens the original link in a new tab.
- Placeholders for missing or unavailable photos
- Toasts for new sales and drafted players
- Team labels shown as "Team (Captain)" for clarity
- Player detail displays the contact number in the signed-in UI
- Footer credit link (Powered by Teqgrow)

## Real-Time
- Firestore listeners for tournament-scoped auction state, teams, and players
- Global config listener for the active public tournament

## Validation & Rules
- Starting bid is always 20,000 regardless of base price
- Bid must be >= current bid + difference when live
- Same team cannot bid twice in a row (admin enforced)
- Team purse cannot be exceeded (frontend + transaction)
- Sold or drafted players are excluded from player selection for bidding
- Player image URLs are optional. Existing player records without an image use the placeholder.
- A single live tournament is selected at a time
