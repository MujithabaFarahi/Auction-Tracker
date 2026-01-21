import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const TOURNAMENT_DOC_ID = "current";
export const AUCTION_STATE_DOC_ID = "current";

export type Tournament = {
  name: string;
  season: string;
  teamPurse: number;
};

export type Team = {
  id: string;
  name: string;
  captainName: string;
  totalPurse: number;
  remainingPurse: number;
  spentAmount: number;
};

export const PLAYER_ROLES = [
  "Batsman",
  "Bowler",
  "All-rounder",
  "Wicket-keeper batsman",
  "Pace bowling all-rounder",
  "Spin bowling all-rounder",
] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export type PlayerStatus = "AVAILABLE" | "SOLD";

export type Player = {
  id: string;
  name: string;
  contactNumber: string;
  role: PlayerRole;
  basePrice: number;
  status: PlayerStatus;
  soldToTeamId: string | null;
  soldPrice: number | null;
  soldAt: number | null;
  bidHistory?: Bid[];
};

export type Bid = {
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: number;
};

export type AuctionStatus = "IDLE" | "LIVE" | "SOLD";

export type AuctionState = {
  currentPlayerId: string | null;
  currentBid: number;
  leadingTeamId: string | null;
  status: AuctionStatus;
  bidHistory: Bid[];
};

export const defaultAuctionState: AuctionState = {
  currentPlayerId: null,
  currentBid: 0,
  leadingTeamId: null,
  status: "IDLE",
  bidHistory: [],
};

export const tournamentDocRef = doc(db, "tournament", TOURNAMENT_DOC_ID);
export const auctionStateDocRef = doc(db, "auctionState", AUCTION_STATE_DOC_ID);
export const teamsCollectionRef = collection(db, "teams");
export const playersCollectionRef = collection(db, "players");

export async function ensureAuctionState() {
  const snapshot = await getDoc(auctionStateDocRef);
  if (!snapshot.exists()) {
    await setDoc(auctionStateDocRef, defaultAuctionState);
  }
}

export async function ensureTournament() {
  const snapshot = await getDoc(tournamentDocRef);
  if (!snapshot.exists()) {
    await setDoc(tournamentDocRef, {
      name: "Softball Auction",
      season: "2025",
      teamPurse: 0,
    });
  }
}

export async function saveTeam(
  input: Omit<Team, "id" | "remainingPurse" | "spentAmount">,
) {
  const payload = {
    ...input,
    remainingPurse: input.totalPurse,
    spentAmount: 0,
  };
  await addDoc(teamsCollectionRef, payload);
}

export async function updateTeam(
  id: string,
  input: Omit<Team, "id" | "remainingPurse" | "spentAmount">,
) {
  const ref = doc(db, "teams", id);
  await updateDoc(ref, {
    ...input,
    remainingPurse: input.totalPurse,
    spentAmount: 0,
  });
}

export type NewPlayerInput = Omit<
  Player,
  "id" | "status" | "soldToTeamId" | "soldPrice" | "soldAt"
> & {
  status?: PlayerStatus;
  soldToTeamId?: string | null;
  soldPrice?: number | null;
  soldAt?: number | null;
};

export async function savePlayer(input: NewPlayerInput) {
  const {
    status = "AVAILABLE",
    soldToTeamId = null,
    soldPrice = null,
    soldAt = null,
    ...rest
  } = input;
  await addDoc(playersCollectionRef, {
    ...rest,
    status,
    soldToTeamId,
    soldPrice,
    soldAt,
    bidHistory: [],
  });
}

export async function updatePlayer(
  id: string,
  input: Omit<
    Player,
    "id" | "status" | "soldToTeamId" | "soldPrice" | "soldAt"
  >,
) {
  const ref = doc(db, "players", id);
  await updateDoc(ref, input);
}

export async function setCurrentPlayer(playerId: string) {
  await updateDoc(doc(db, "players", playerId), { bidHistory: [] });
  await setDoc(
    auctionStateDocRef,
    {
      currentPlayerId: playerId,
      currentBid: 0,
      leadingTeamId: null,
      status: "IDLE",
      bidHistory: [],
    },
    { merge: true },
  );
}

export async function startAuction() {
  await setDoc(
    auctionStateDocRef,
    {
      status: "LIVE",
      currentBid: 0,
      leadingTeamId: null,
      bidHistory: [],
    },
    { merge: true },
  );
}

export async function placeBid(teamId: string, amount: number) {
  await runTransaction(db, async (transaction) => {
    const auctionSnap = await transaction.get(auctionStateDocRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }

    const auctionData = auctionSnap.data() as AuctionState;
    if (auctionData.status !== "LIVE" || !auctionData.currentPlayerId) {
      throw new Error("No live auction to place a bid.");
    }

    const playerRef = doc(db, "players", auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data() as Player;
    if (playerData.status !== "AVAILABLE") {
      throw new Error("Player is already sold.");
    }

    const teamRef = doc(db, "teams", teamId);
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) {
      throw new Error("Team not found.");
    }
    const teamData = teamSnap.data() as Team;

    const currentBid = Number(auctionData.currentBid) || 0;
    const basePrice = Number(playerData.basePrice) || 0;
    if (amount < basePrice) {
      throw new Error("Bid must be at least the base price.");
    }
    if (amount <= currentBid) {
      throw new Error("Bid must be higher than the current bid.");
    }
    if (teamData.remainingPurse < amount) {
      throw new Error("Team purse is insufficient for this bid.");
    }

    const bidHistory = Array.isArray(auctionData.bidHistory)
      ? auctionData.bidHistory
      : [];
    const playerBidHistory = Array.isArray(playerData.bidHistory)
      ? playerData.bidHistory
      : [];

    const bid: Bid = {
      teamId,
      teamName: teamData.name,
      amount,
      timestamp: Date.now(),
    };

    transaction.update(auctionStateDocRef, {
      currentBid: amount,
      leadingTeamId: teamId,
      bidHistory: [...bidHistory, bid],
    });
    transaction.update(playerRef, {
      bidHistory: [...playerBidHistory, bid],
    });
  });
}

export async function markPlayerSold() {
  await runTransaction(db, async (transaction) => {
    const auctionSnap = await transaction.get(auctionStateDocRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }
    const auctionData = auctionSnap.data() as AuctionState;
    if (auctionData.status !== "LIVE" || !auctionData.currentPlayerId) {
      throw new Error("No live auction to close.");
    }

    const bidHistory = Array.isArray(auctionData.bidHistory)
      ? auctionData.bidHistory
      : [];
    if (bidHistory.length === 0) {
      throw new Error("At least one bid is required to mark SOLD.");
    }

    const winningBid = bidHistory[bidHistory.length - 1];
    const playerRef = doc(db, "players", auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data() as Player;
    if (playerData.status !== "AVAILABLE") {
      throw new Error("Player already sold.");
    }

    const teamRef = doc(db, "teams", winningBid.teamId);
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) {
      throw new Error("Winning team not found.");
    }
    const teamData = teamSnap.data() as Team;
    const spentAmount = Number(teamData.spentAmount) || 0;
    if (teamData.remainingPurse < winningBid.amount) {
      throw new Error("Winning team purse is insufficient.");
    }

    transaction.update(teamRef, {
      remainingPurse: teamData.remainingPurse - winningBid.amount,
      spentAmount: spentAmount + winningBid.amount,
    });

    transaction.update(playerRef, {
      status: "SOLD",
      soldToTeamId: winningBid.teamId,
      soldPrice: winningBid.amount,
      soldAt: Date.now(),
    });

    transaction.update(auctionStateDocRef, {
      currentPlayerId: null,
      currentBid: 0,
      leadingTeamId: null,
      status: "IDLE",
      bidHistory: [],
    });
  });
}

export async function deleteBidAtIndex(index: number) {
  await runTransaction(db, async (transaction) => {
    const auctionSnap = await transaction.get(auctionStateDocRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }
    const auctionData = auctionSnap.data() as AuctionState;
    if (!auctionData.currentPlayerId) {
      throw new Error("No active player to update.");
    }

    const playerRef = doc(db, "players", auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data() as Player;

    const bids = Array.isArray(auctionData.bidHistory)
      ? auctionData.bidHistory
      : [];
    if (index < 0 || index >= bids.length) {
      throw new Error("Bid not found.");
    }

    const bidToRemove = bids[index];
    const updatedBids = bids.filter((_, bidIndex) => bidIndex !== index);
    const latestBid = updatedBids[updatedBids.length - 1] ?? null;

    const playerBids = Array.isArray(playerData.bidHistory)
      ? playerData.bidHistory
      : [];

    let updatedPlayerBids: Bid[] = [];
    if (playerBids.length === bids.length) {
      updatedPlayerBids = playerBids.filter((_, bidIndex) => bidIndex !== index);
    } else {
      let removed = false;
      updatedPlayerBids = playerBids.filter((bid) => {
        if (removed) {
          return true;
        }
        const isMatch =
          bid.teamId === bidToRemove.teamId &&
          bid.amount === bidToRemove.amount &&
          bid.timestamp === bidToRemove.timestamp;
        if (isMatch) {
          removed = true;
          return false;
        }
        return true;
      });
    }

    transaction.update(playerRef, {
      bidHistory: updatedPlayerBids,
    });
    transaction.update(auctionStateDocRef, {
      bidHistory: updatedBids,
      currentBid: latestBid ? latestBid.amount : 0,
      leadingTeamId: latestBid ? latestBid.teamId : null,
    });
  });
}
