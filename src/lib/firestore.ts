import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Transaction,
  WithFieldValue,
} from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type Entity<TDoc> = TDoc & { id: string };

export type GlobalConfig = {
  activeTournamentId: string | null;
};

export type TournamentStatus = "PENDING" | "LIVE" | "COMPLETED";

export type TournamentDoc = {
  name: string;
  season: string;
  teamPurse: number;
  teamSize: number;
  status: TournamentStatus;
  createdAt: number;
};

export type Tournament = Entity<TournamentDoc>;

export type TeamDoc = {
  name: string;
  captainName: string;
  totalPurse: number;
  remainingPurse: number;
  spentAmount: number;
  playersCount: number;
  maxBidAmount: number;
};

export type Team = Entity<TeamDoc>;

export const PLAYER_ROLES = [
  "Batsman",
  "Wicket-keeper Batsman",
  "Fast Bowler",
  "Spin Bowler",
  "All-Rounder (Pace)",
  "All-Rounder (Spin)",
] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export type PlayerStatus = "AVAILABLE" | "UNSOLD" | "DRAFTED" | "SOLD";

export type Bid = {
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: number;
};

export type PlayerDoc = {
  name: string;
  contactNumber?: string;
  area?: string;
  role: PlayerRole;
  basePrice: number;
  regularTeam?: string;
  imageUrl: string | null;
  createdAt?: number;
  status: PlayerStatus;
  soldToTeamId: string | null;
  soldPrice: number | null;
  soldAt: number | null;
  bidHistory?: Bid[];
};

export type Player = Entity<PlayerDoc>;

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

const defaultGlobalConfig: GlobalConfig = {
  activeTournamentId: null,
};

function createDocConverter<TDoc extends DocumentData>(
  normalize?: (data: TDoc) => TDoc,
): FirestoreDataConverter<TDoc> {
  return {
    toFirestore: (data: WithFieldValue<TDoc>) =>
      data as WithFieldValue<DocumentData>,
    fromFirestore: (
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions,
    ): TDoc => {
      const data = snapshot.data(options) as TDoc;
      return normalize ? normalize(data) : data;
    },
  };
}

function createEntityConverter<TDoc extends DocumentData>(
  normalize?: (data: TDoc) => TDoc,
): FirestoreDataConverter<Entity<TDoc>, TDoc> {
  return {
    toFirestore: (data: WithFieldValue<Entity<TDoc>>) => {
      const { id, ...rest } = data as Entity<TDoc>;
      void id;
      return rest as WithFieldValue<TDoc>;
    },
    fromFirestore: (
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions,
    ): Entity<TDoc> => {
      const raw = snapshot.data(options) as TDoc;
      const data = normalize ? normalize(raw) : raw;
      return {
        id: snapshot.id,
        ...data,
      };
    },
  };
}

function normalizePlayerDoc(data: PlayerDoc): PlayerDoc {
  return {
    ...data,
    imageUrl: data.imageUrl ?? null,
    bidHistory: Array.isArray(data.bidHistory) ? data.bidHistory : [],
  };
}

function normalizeAuctionState(data: AuctionState): AuctionState {
  return {
    ...defaultAuctionState,
    ...data,
    bidHistory: Array.isArray(data.bidHistory) ? data.bidHistory : [],
  };
}

export const configDocRef = doc(db, "config", "app").withConverter(
  createDocConverter<GlobalConfig>(),
);

export const tournamentsCollectionRef = collection(db, "tournaments").withConverter(
  createEntityConverter<TournamentDoc>(),
);

export const getTournamentDocRef = (tournamentId: string) =>
  doc(tournamentsCollectionRef, tournamentId);

export const getAuctionStateDocRef = (tournamentId: string) =>
  doc(db, "tournaments", tournamentId, "auctionState", "current").withConverter(
    createDocConverter<AuctionState>(normalizeAuctionState),
  );

export const getTeamsCollectionRef = (tournamentId: string) =>
  collection(db, "tournaments", tournamentId, "teams").withConverter(
    createEntityConverter<TeamDoc>(),
  );

export const getTeamDocRef = (tournamentId: string, teamId: string) =>
  doc(getTeamsCollectionRef(tournamentId), teamId);

export const getPlayersCollectionRef = (tournamentId: string) =>
  collection(db, "tournaments", tournamentId, "players").withConverter(
    createEntityConverter<PlayerDoc>(normalizePlayerDoc),
  );

export const getPlayerDocRef = (tournamentId: string, playerId: string) =>
  doc(getPlayersCollectionRef(tournamentId), playerId);

const getPlayerContactRef = (tournamentId: string, playerId: string) =>
  doc(db, "tournaments", tournamentId, "playerContacts", playerId);

export async function getPlayerContact(tournamentId: string, playerId: string, legacyNumber?: string) {
  const snapshot = await runTransaction(db, (transaction) =>
    transaction.get(getPlayerContactRef(tournamentId, playerId)),
  );
  const number = snapshot.data()?.contactNumber ?? legacyNumber;
  return typeof number === "string" ? number : "";
}

export async function ensureGlobalConfig() {
  const snapshot = await getDoc(configDocRef);
  if (!snapshot.exists()) {
    await setDoc(configDocRef, defaultGlobalConfig);
  }
}

export async function ensureAuctionState(tournamentId: string) {
  const snapshot = await getDoc(getAuctionStateDocRef(tournamentId));
  if (!snapshot.exists()) {
    await setDoc(getAuctionStateDocRef(tournamentId), defaultAuctionState);
  }
}

export type TournamentInput = Omit<TournamentDoc, "status" | "createdAt"> & {
  status?: TournamentStatus;
};

export async function createTournament(input: TournamentInput) {
  const docRef = await addDoc(tournamentsCollectionRef, {
    ...input,
    status: input.status ?? "PENDING",
    createdAt: Date.now(),
  } as unknown as WithFieldValue<Tournament>);
  await ensureAuctionState(docRef.id);
  return docRef.id;
}

export async function updateTournament(
  tournamentId: string,
  input: TournamentInput,
) {
  await setDoc(
    getTournamentDocRef(tournamentId),
    {
      ...input,
      status: input.status ?? "PENDING",
    },
    { merge: true },
  );
}

export async function setActiveTournament(tournamentId: string | null) {
  await runTransaction(db, async (transaction) => {
    const configSnap = await transaction.get(configDocRef);
    const currentActiveId =
      configSnap.exists() ? (configSnap.data().activeTournamentId ?? null) : null;

    transaction.set(
      configDocRef,
      { activeTournamentId: tournamentId },
      { merge: true },
    );

    if (currentActiveId && currentActiveId !== tournamentId) {
      transaction.set(
        getTournamentDocRef(currentActiveId),
        { status: "PENDING" },
        { merge: true },
      );
    }

    if (tournamentId) {
      transaction.set(
        getTournamentDocRef(tournamentId),
        { status: "LIVE" },
        { merge: true },
      );
    }
  });
}

export async function completeTournament(tournamentId: string) {
  await runTransaction(db, async (transaction) => {
    const [config, auction] = await Promise.all([
      transaction.get(configDocRef),
      transaction.get(getAuctionStateDocRef(tournamentId)),
    ]);

    if (auction.data()?.status === "LIVE") {
      throw new Error("Stop the current auction before marking the tournament completed.");
    }

    transaction.update(getTournamentDocRef(tournamentId), { status: "COMPLETED" });
    if (config.data()?.activeTournamentId === tournamentId) {
      transaction.update(configDocRef, { activeTournamentId: null });
    }
  });
}

export async function saveTeam(
  tournamentId: string,
  input: Omit<
    TeamDoc,
    "remainingPurse" | "spentAmount" | "playersCount" | "maxBidAmount"
  >,
) {
  const tournamentSnap = await getDoc(getTournamentDocRef(tournamentId));
  const tournamentData = tournamentSnap.exists() ? tournamentSnap.data() : null;
  const teamSize = tournamentData?.teamSize ?? 9;
  const playersCount = 0;
  const payload: TeamDoc = {
    ...input,
    remainingPurse: input.totalPurse,
    spentAmount: 0,
    playersCount,
    maxBidAmount: calculateMaxBid(input.totalPurse, playersCount, teamSize),
  };
  await addDoc(
    getTeamsCollectionRef(tournamentId),
    payload as unknown as WithFieldValue<Team>,
  );
}

export async function updateTeam(
  tournamentId: string,
  id: string,
  input: Omit<
    TeamDoc,
    "remainingPurse" | "spentAmount" | "playersCount" | "maxBidAmount"
  >,
) {
  const tournamentSnap = await getDoc(getTournamentDocRef(tournamentId));
  const tournamentData = tournamentSnap.exists() ? tournamentSnap.data() : null;
  const teamSize = tournamentData?.teamSize ?? 9;
  await updateDoc(getTeamDocRef(tournamentId, id), {
    ...input,
    remainingPurse: input.totalPurse,
    spentAmount: 0,
    playersCount: 0,
    maxBidAmount: calculateMaxBid(input.totalPurse, 0, teamSize),
  });
}

export function calculateMaxBid(
  remainingPurse: number,
  playersCount: number,
  teamSize: number,
) {
  const minReserve = 20000;
  const remainingSlots = Math.max(0, teamSize - playersCount);
  if (remainingSlots <= 0) {
    return 0;
  }
  return remainingPurse - (remainingSlots - 1) * minReserve;
}

type PlayerDetailsInput = Omit<
  PlayerDoc,
  "status" | "soldToTeamId" | "soldPrice" | "soldAt" | "imageUrl" | "createdAt" | "bidHistory"
> & {
  contactNumber: string;
  imageUrl?: string | null;
};

type PlayerAssignment = {
  teamId: string;
  price: number;
};

async function stagePlayerAssignment(
  transaction: Transaction,
  tournamentId: string,
  { teamId, price }: PlayerAssignment,
): Promise<Pick<PlayerDoc, "status" | "soldToTeamId" | "soldPrice" | "soldAt">> {
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new Error("Enter a whole assignment price of 0 or more.");
  }

  const teamRef = getTeamDocRef(tournamentId, teamId);
  const [team, tournament] = await Promise.all([
    transaction.get(teamRef),
    transaction.get(getTournamentDocRef(tournamentId)),
  ]);
  if (!team.exists() || !tournament.exists()) {
    throw new Error("Team or tournament not found.");
  }
  const teamData = team.data();
  const teamSize = tournament.data().teamSize ?? 9;
  const playersCount = (teamData.playersCount ?? 0) + 1;
  if (playersCount > teamSize) {
    throw new Error("This team has no roster slots left.");
  }
  const remainingPurse = teamData.remainingPurse - price;
  if (!Number.isFinite(remainingPurse) || remainingPurse < 0) {
    throw new Error("The assignment price exceeds the team's remaining purse.");
  }

  transaction.update(teamRef, {
    playersCount,
    remainingPurse,
    spentAmount: (teamData.spentAmount ?? teamData.totalPurse - teamData.remainingPurse) + price,
    maxBidAmount: calculateMaxBid(remainingPurse, playersCount, teamSize),
  });
  return {
    status: price > 0 ? "SOLD" : "DRAFTED",
    soldToTeamId: teamId,
    soldPrice: price,
    soldAt: Date.now(),
  };
}

async function requireUnassignedPlayer(
  transaction: Transaction,
  tournamentId: string,
  playerId: string,
) {
  const [player, auction] = await Promise.all([
    transaction.get(getPlayerDocRef(tournamentId, playerId)),
    transaction.get(getAuctionStateDocRef(tournamentId)),
  ]);
  if (!player.exists()) {
    throw new Error("Player not found.");
  }
  if (player.data().soldToTeamId || ["SOLD", "DRAFTED"].includes(player.data().status)) {
    throw new Error("Player is already assigned to a team.");
  }
  if (auction.data()?.currentPlayerId === playerId) {
    throw new Error("Select a different auction player before assigning this player.");
  }
}

export async function savePlayer(
  tournamentId: string,
  input: PlayerDetailsInput,
  assignment?: PlayerAssignment,
) {
  const { contactNumber, imageUrl = null, ...details } = input;
  const playerRef = doc(getPlayersCollectionRef(tournamentId));
  await runTransaction(db, async (transaction) => {
    const roster = assignment
      ? await stagePlayerAssignment(transaction, tournamentId, assignment)
      : { status: "AVAILABLE" as const, soldToTeamId: null, soldPrice: null, soldAt: null };
    transaction.set(playerRef, {
      id: playerRef.id,
      ...details,
      ...roster,
      imageUrl,
      createdAt: Date.now(),
      bidHistory: [],
    });
    if (contactNumber.trim()) {
      transaction.set(getPlayerContactRef(tournamentId, playerRef.id), {
        contactNumber: contactNumber.trim(),
      });
    }
  });
}

export async function updatePlayer(
  tournamentId: string,
  id: string,
  input: PlayerDetailsInput,
  assignment?: PlayerAssignment,
) {
  const { contactNumber, imageUrl = null, ...details } = input;
  await runTransaction(db, async (transaction) => {
    if (assignment) {
      await requireUnassignedPlayer(transaction, tournamentId, id);
    }
    const roster = assignment
      ? await stagePlayerAssignment(transaction, tournamentId, assignment)
      : {};
    transaction.update(getPlayerDocRef(tournamentId, id), {
      ...details,
      ...roster,
      imageUrl,
      contactNumber: deleteField(),
    });
    const contactRef = getPlayerContactRef(tournamentId, id);
    if (contactNumber.trim()) {
      transaction.set(contactRef, { contactNumber: contactNumber.trim() });
    } else {
      transaction.delete(contactRef);
    }
  });
}

export async function deletePlayer(tournamentId: string, playerId: string) {
  await runTransaction(db, async (transaction) => {
    const playerRef = getPlayerDocRef(tournamentId, playerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Player not found.");
    }
    const playerData = playerSnap.data();

    if (
      (playerData.status === "SOLD" || playerData.status === "DRAFTED") &&
      playerData.soldToTeamId
    ) {
      const teamRef = getTeamDocRef(tournamentId, playerData.soldToTeamId);
      const teamSnap = await transaction.get(teamRef);
      if (!teamSnap.exists()) {
        throw new Error("Team not found for sold player.");
      }
      const teamData = teamSnap.data();
      const refund = Number(playerData.soldPrice) || 0;
      const spentAmount = Number(teamData.spentAmount) || 0;
      const remainingPurse = Number(teamData.remainingPurse) || 0;
      const tournamentSnap = await transaction.get(getTournamentDocRef(tournamentId));
      const tournamentData = tournamentSnap.exists() ? tournamentSnap.data() : null;
      const teamSize = tournamentData?.teamSize ?? 9;
      const nextPlayersCount = Math.max(0, (teamData.playersCount ?? 0) - 1);
      const nextRemaining = remainingPurse + refund;

      transaction.update(teamRef, {
        remainingPurse: nextRemaining,
        spentAmount: Math.max(0, spentAmount - refund),
        playersCount: nextPlayersCount,
        maxBidAmount: calculateMaxBid(nextRemaining, nextPlayersCount, teamSize),
      });
    }

    transaction.delete(playerRef);
    transaction.delete(getPlayerContactRef(tournamentId, playerId));
  });
}

export async function assignPlayerToTeamNoPurse(
  tournamentId: string,
  playerId: string,
  teamId: string,
) {
  await runTransaction(db, async (transaction) => {
    await requireUnassignedPlayer(transaction, tournamentId, playerId);
    const roster = await stagePlayerAssignment(transaction, tournamentId, { teamId, price: 0 });
    transaction.update(getPlayerDocRef(tournamentId, playerId), roster);
  });
}

export async function setCurrentPlayer(tournamentId: string, playerId: string) {
  await runTransaction(db, async (transaction) => {
    const playerRef = getPlayerDocRef(tournamentId, playerId);
    const auctionRef = getAuctionStateDocRef(tournamentId);
    const [player, auction] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(auctionRef),
    ]);
    if (!player.exists() || player.data().soldToTeamId ||
      !["AVAILABLE", "UNSOLD"].includes(player.data().status)) {
      throw new Error("Select an available player.");
    }
    if (auction.data()?.status === "LIVE") {
      throw new Error("Stop the live auction before changing players.");
    }
    transaction.update(playerRef, { bidHistory: [] });
    transaction.set(auctionRef, {
      currentPlayerId: playerId,
      currentBid: 20000,
      leadingTeamId: null,
      status: "IDLE",
      bidHistory: [],
    }, { merge: true });
  });
}

export async function startAuction(tournamentId: string) {
  await setDoc(
    getAuctionStateDocRef(tournamentId),
    {
      status: "LIVE",
      currentBid: 20000,
      leadingTeamId: null,
      bidHistory: [],
    },
    { merge: true },
  );
}

export async function stopAuction(tournamentId: string) {
  await setDoc(
    getAuctionStateDocRef(tournamentId),
    {
      status: "IDLE",
      currentBid: 20000,
      leadingTeamId: null,
      bidHistory: [],
    },
    { merge: true },
  );
}

export async function placeBid(
  tournamentId: string,
  teamId: string,
  amount: number,
) {
  await runTransaction(db, async (transaction) => {
    const auctionRef = getAuctionStateDocRef(tournamentId);
    const auctionSnap = await transaction.get(auctionRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }

    const auctionData = auctionSnap.data();
    if (auctionData.status !== "LIVE" || !auctionData.currentPlayerId) {
      throw new Error("No live auction to place a bid.");
    }

    const playerRef = getPlayerDocRef(tournamentId, auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data();
    if (playerData.status === "SOLD" || playerData.status === "DRAFTED") {
      throw new Error("Player is already sold.");
    }

    const teamRef = getTeamDocRef(tournamentId, teamId);
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) {
      throw new Error("Team not found.");
    }
    const teamData = teamSnap.data();

    const currentBid = Number(auctionData.currentBid) || 0;
    const hasBids = Array.isArray(auctionData.bidHistory)
      ? auctionData.bidHistory.length > 0
      : false;
    if (amount < 20000) {
      throw new Error("Bid must be at least 20000.");
    }
    if (hasBids && amount <= currentBid) {
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

    transaction.update(auctionRef, {
      currentBid: amount,
      leadingTeamId: teamId,
      bidHistory: [...bidHistory, bid],
    });
    transaction.update(playerRef, {
      bidHistory: [...playerBidHistory, bid],
    });
  });
}

export async function updateLiveBid(
  tournamentId: string,
  teamId: string,
  amount: number,
) {
  await updateDoc(getAuctionStateDocRef(tournamentId), {
    currentBid: amount,
    leadingTeamId: teamId,
  });
}

export async function commitPendingBids(
  tournamentId: string,
  playerId: string,
  bids: Bid[],
) {
  if (bids.length === 0) {
    return;
  }
  await runTransaction(db, async (transaction) => {
    const auctionRef = getAuctionStateDocRef(tournamentId);
    const auctionSnap = await transaction.get(auctionRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }
    const auctionData = auctionSnap.data();
    if (auctionData.currentPlayerId !== playerId) {
      throw new Error("Active player changed before bids were committed.");
    }

    const playerRef = getPlayerDocRef(tournamentId, playerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data();

    const bidHistory = Array.isArray(auctionData.bidHistory)
      ? auctionData.bidHistory
      : [];
    const playerBidHistory = Array.isArray(playerData.bidHistory)
      ? playerData.bidHistory
      : [];

    const latestBid = bids[bids.length - 1];

    transaction.update(auctionRef, {
      bidHistory: [...bidHistory, ...bids],
      currentBid: latestBid.amount,
      leadingTeamId: latestBid.teamId,
    });
    transaction.update(playerRef, {
      bidHistory: [...playerBidHistory, ...bids],
    });
  });
}

export async function markPlayerSold(tournamentId: string) {
  await runTransaction(db, async (transaction) => {
    const auctionRef = getAuctionStateDocRef(tournamentId);
    const auctionSnap = await transaction.get(auctionRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }
    const auctionData = auctionSnap.data();
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
    const playerRef = getPlayerDocRef(tournamentId, auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data();
    if (playerData.status === "SOLD" || playerData.status === "DRAFTED") {
      throw new Error("Player already sold.");
    }

    const teamRef = getTeamDocRef(tournamentId, winningBid.teamId);
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) {
      throw new Error("Winning team not found.");
    }
    const teamData = teamSnap.data();
    const spentAmount = Number(teamData.spentAmount) || 0;
    if (teamData.remainingPurse < winningBid.amount) {
      throw new Error("Winning team purse is insufficient.");
    }

    const tournamentSnap = await transaction.get(getTournamentDocRef(tournamentId));
    const tournamentData = tournamentSnap.exists() ? tournamentSnap.data() : null;
    const teamSize = tournamentData?.teamSize ?? 9;
    const nextRemaining = teamData.remainingPurse - winningBid.amount;
    const nextPlayersCount = (teamData.playersCount ?? 0) + 1;

    transaction.update(teamRef, {
      remainingPurse: nextRemaining,
      spentAmount: spentAmount + winningBid.amount,
      playersCount: nextPlayersCount,
      maxBidAmount: calculateMaxBid(nextRemaining, nextPlayersCount, teamSize),
    });

    transaction.update(playerRef, {
      status: "SOLD",
      soldToTeamId: winningBid.teamId,
      soldPrice: winningBid.amount,
      soldAt: Date.now(),
    });

    transaction.update(auctionRef, {
      currentPlayerId: null,
      currentBid: 0,
      leadingTeamId: null,
      status: "IDLE",
      bidHistory: [],
    });
  });
}

export async function markPlayerUnsold(tournamentId: string) {
  await runTransaction(db, async (transaction) => {
    const auctionRef = getAuctionStateDocRef(tournamentId);
    const auctionSnap = await transaction.get(auctionRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }
    const auctionData = auctionSnap.data();
    if (auctionData.status !== "LIVE" || !auctionData.currentPlayerId) {
      throw new Error("No live auction to close.");
    }

    const playerRef = getPlayerDocRef(tournamentId, auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data();
    if (playerData.status === "SOLD" || playerData.status === "DRAFTED") {
      throw new Error("Player already sold.");
    }

    transaction.update(playerRef, {
      status: "UNSOLD",
      soldToTeamId: null,
      soldPrice: null,
      soldAt: Date.now(),
      bidHistory: [],
    });

    transaction.update(auctionRef, {
      currentPlayerId: null,
      currentBid: 0,
      leadingTeamId: null,
      status: "IDLE",
      bidHistory: [],
    });
  });
}

export async function deleteBidAtIndex(tournamentId: string, index: number) {
  await runTransaction(db, async (transaction) => {
    const auctionRef = getAuctionStateDocRef(tournamentId);
    const auctionSnap = await transaction.get(auctionRef);
    if (!auctionSnap.exists()) {
      throw new Error("Auction state not initialized.");
    }
    const auctionData = auctionSnap.data();
    if (!auctionData.currentPlayerId) {
      throw new Error("No active player to update.");
    }

    const playerRef = getPlayerDocRef(tournamentId, auctionData.currentPlayerId);
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) {
      throw new Error("Selected player not found.");
    }
    const playerData = playerSnap.data();

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
    transaction.update(auctionRef, {
      bidHistory: updatedBids,
      currentBid: latestBid ? latestBid.amount : 0,
      leadingTeamId: latestBid ? latestBid.teamId : null,
    });
  });
}
