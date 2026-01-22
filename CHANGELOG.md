# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- Firebase Auth email/password admin login flow.
- Firestore schema + transactions for auction state, bids, teams, and players.
- Admin pages for setup and auction control.
- Public auction view with tabs (Live, Completed, Players, Teams).
- Team and player detail pages.
- Bid history persisted per player and displayed on player profile.
- shadcn-compatible UI primitives: card, table, badge, input, label, tabs, select.
- Tournament-level team purse applied to new teams.
- Team spentAmount tracking in team documents.
- Player creation option to assign directly to a team at 0 cost.
- Admin quick bid-difference buttons with editable minimum bids.
- Admin rule: same team cannot bid twice in a row.
- Bid history delete action in admin (icon button).
- Team labels now include captain name across admin and public views.
- Alert dialog confirmation for marking players SOLD.
- Bid difference controls support +/- increments and auto-update bid amount.
- Admin can delete players; sold player deletion refunds team purse.
- Loading state support on submit buttons.
- Player data now includes area, regular team, and createdAt.
- Admin bulk import button for playerpool TSV list.
- Admin edit panels on player and team detail pages.
- Admin team page can assign team-less players with zero purse impact.
- Command palette picker for selecting players in admin auction.
- Command palette picker for assigning players on team page.
- Auction auto-loads the next available player after a sale.

### Changed
- Public view reorganized into tabbed layout with sorting and filtering.
- Admin team setup uses tournament purse instead of per-team input.
- Team views display spent amount from stored field.
- Bid difference now resets per player, minimum 1000, and rounds to 1000s.
- Admin can edit players even when auction is live.
- Auction tables updated with improved headers, alignment, and hover styling.
- Public Completed tab switched to card grid layout.
- Public Players tab switched to tile grid layout.
- Public Teams tab switched to card grid layout.
- Bid history lists now show latest first.
- Player list sorting defaults to createdAt (oldest first in public view).
- Admin auction resets selected team after a bid.

### Fixed
- Enforced bid rules (base price, higher than current bid, purse checks) at transaction layer.
- Bid delete transaction now reads before writes to satisfy Firestore requirements.
