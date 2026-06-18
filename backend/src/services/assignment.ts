import prisma from '../db';

/**
 * Host-Zuweisungsalgorithmus (portiert aus update Host verteilung.gs)
 *
 * Phasen:
 * 1. Host-Selektion anhand von Score + HostWunsch
 * 2. FairShare-Anpassung der MaxGäste
 * 3. minQuota / targetQuota Berechnung
 * 4. Gast-Verteilung in 2 Phasen (matrix-gestützt oder round-robin fallback)
 */

const HIGH_SCORE = 1e9;
const LOW_SCORE = -1e9;
const TIE_SEED = 'moving-dinner-seed-2025';
const DEFAULT_MAX_GUESTS = 2;

/**
 * Deterministic djb2 hash (same as GAS version)
 */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xFFFFFFFF;
  }
  return h >>> 0;
}

interface Participant {
  userId: number;
  name: string;
  hostWish: 'will_host' | 'indifferent' | 'cannot_host';
  maxGuests: number;
  score: number;
  isHost: boolean;
  assignedGuests: number;
  assignedTo: string;
  minQuota: number;
  targetQuota: number;
  assignedList: number[]; // matrix indices of assigned guests
  matrixIdx?: number;
}

/**
 * Main assignment function. Reads responses + scores + matrix for a meeting,
 * computes host assignments, and writes assigned_host to responses.
 */
export async function assignHosts(meetingId: number): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { responses: { include: { user: true } } },
  });

  if (!meeting || meeting.frozen) return;

  if (meeting.responses.length === 0) return;

  // Load scores for all participants in this group
  const groupId = meeting.groupId;
  const userIds = meeting.responses.map(r => r.userId);
  const scores = await prisma.score.findMany({ where: { userId: { in: userIds }, groupId } });
  const scoreMap = new Map(scores.map(s => [s.userId, Number(s.score)]));

  // Load meetup matrix for all participants in this group
  const matrixEntries = await prisma.meetupMatrix.findMany({
    where: {
      groupId,
      OR: [
        { userAId: { in: userIds } },
        { userBId: { in: userIds } },
      ],
    },
  });

  // Build a lookup: (smallerId, largerId) -> count
  const matrixMap = new Map<string, number>();
  for (const entry of matrixEntries) {
    const key = `${Math.min(entry.userAId, entry.userBId)}_${Math.max(entry.userAId, entry.userBId)}`;
    matrixMap.set(key, entry.count);
  }

  function getMatrixCount(userA: number, userB: number): number {
    const key = `${Math.min(userA, userB)}_${Math.max(userA, userB)}`;
    return matrixMap.get(key) || 0;
  }

  // Build participant data
  const participants: Participant[] = meeting.responses.map(r => ({
    userId: r.userId,
    name: r.user.name,
    hostWish: r.hostWish as 'will_host' | 'indifferent' | 'cannot_host',
    maxGuests: r.user.maxGuests || 0,
    score: scoreMap.get(r.userId) || 0,
    isHost: false,
    assignedGuests: 0,
    assignedTo: '',
    minQuota: 0,
    targetQuota: 0,
    assignedList: [],
  }));

  // === 1. Host-Selektion ===
  const candidateScores = participants.map(p => {
    let adjusted: number;
    if (p.hostWish === 'will_host') adjusted = HIGH_SCORE + p.score;
    else if (p.hostWish === 'cannot_host') adjusted = LOW_SCORE + p.score;
    else if (p.maxGuests <= 0) adjusted = LOW_SCORE + p.score;
    else adjusted = p.score;

    // "Will hosten" with maxGuests=0 gets default capacity
    if (p.hostWish === 'will_host' && p.maxGuests <= 0) {
      p.maxGuests = DEFAULT_MAX_GUESTS;
    }

    p.score = adjusted;
    return { participant: p, score: adjusted };
  });

  candidateScores.sort((a, b) => {
    if (a.score === b.score) {
      const ha = hashString(a.participant.name + '|' + TIE_SEED);
      const hb = hashString(b.participant.name + '|' + TIE_SEED);
      return ha - hb;
    }
    return b.score > a.score ? 1 : -1;
  });

  // Select hosts iteratively until capacity covers all guests
  let assignedCapacity = 0;
  const selectedHosts: Participant[] = [];
  for (const cand of candidateScores) {
    const p = cand.participant;
    if (selectedHosts.includes(p)) continue;
    if (p.maxGuests <= 0 && p.hostWish !== 'will_host') continue;
    selectedHosts.push(p);
    assignedCapacity += p.maxGuests;
    const guestsCount = participants.length - selectedHosts.length;
    if (assignedCapacity >= guestsCount) break;
  }

  // Mark hosts
  const hosts: Participant[] = [];
  for (const h of selectedHosts) {
    h.isHost = true;
    hosts.push(h);
  }

  if (hosts.length === 0) {
    // No hosts available – nothing to assign
    return;
  }

  // === 2. FairShare-Anpassung ===
  const guests = participants.filter(p => !p.isHost);
  const totalGuestsToAssignPre = guests.length;
  const fairShare = Math.ceil(totalGuestsToAssignPre / hosts.length);
  hosts.forEach(h => {
    if (h.maxGuests < fairShare) {
      h.maxGuests = fairShare;
    }
  });

  // === 3. minQuota / targetQuota ===
  const totalGuests = participants.filter(p => !p.isHost).length;
  const caps = hosts.map(h => h.maxGuests);
  const H = hosts.length;

  // minQuota
  let minBase = H > 0 ? Math.floor(totalGuests / H) : 0;
  let minQuotas = hosts.map((h, i) => Math.min(caps[i], minBase));
  let minSum = minQuotas.reduce((a, b) => a + b, 0);
  let minRemaining = Math.max(0, totalGuests - minSum);
  let minIdx = 0;
  while (minRemaining > 0 && minIdx < hosts.length * 1000) {
    const i = minIdx % hosts.length;
    if (minQuotas[i] < caps[i]) { minQuotas[i]++; minRemaining--; }
    minIdx++;
  }

  // targetQuota
  let targetBase = H > 0 ? Math.ceil(totalGuests / H) : 0;
  let quotas = hosts.map((h, i) => Math.min(caps[i], targetBase));
  let assignedQuotaSum = quotas.reduce((a, b) => a + b, 0);
  let remaining = Math.max(0, totalGuests - assignedQuotaSum);
  let idx = 0;
  while (remaining > 0 && idx < hosts.length * 1000) {
    const i = idx % hosts.length;
    if (quotas[i] < caps[i]) { quotas[i]++; remaining--; }
    idx++;
  }

  hosts.forEach((h, i) => {
    h.minQuota = minQuotas[i] || 0;
    h.targetQuota = quotas[i] || 0;
    h.assignedGuests = 0;
    h.assignedList = [];
  });

  // === 4. Gast-Verteilung (matrix-gestützt) ===
  function computeGuestHostScore(guest: Participant, host: Participant): number {
    let score = 0;
    score += getMatrixCount(guest.userId, host.userId);
    if (host.assignedList.length > 0) {
      let sum = 0;
      for (const otherIdx of host.assignedList) {
        sum += getMatrixCount(guest.userId, otherIdx);
      }
      score += sum / host.assignedList.length;
    }
    return score;
  }

  const hasMatrix = matrixEntries.length > 0;

  if (hasMatrix) {
    // Phase 1: minQuota
    for (const g of guests) {
      if (g.assignedTo) continue;
      const minQuotaCandidates = hosts.filter(h => h.assignedGuests < h.minQuota);
      if (minQuotaCandidates.length === 0) break;

      let bestHost: Participant | null = null;
      let bestScore = Infinity;
      for (const h of minQuotaCandidates) {
        const score = computeGuestHostScore(g, h);
        const remainingCap = h.maxGuests - h.assignedGuests;
        const tieBreaker = -remainingCap * 0.001;
        const finalScore = score + tieBreaker;
        if (finalScore < bestScore) { bestScore = finalScore; bestHost = h; }
      }

      if (bestHost) {
        g.assignedTo = bestHost.name;
        bestHost.assignedGuests++;
        bestHost.assignedList.push(g.userId);
      }
    }

    // Phase 2: targetQuota
    for (const g of guests) {
      if (g.assignedTo) continue;
      const targetCandidates = hosts.filter(h => h.assignedGuests < h.targetQuota);
      if (targetCandidates.length === 0) {
        g.assignedTo = 'unassigned';
        continue;
      }

      let bestHost: Participant | null = null;
      let bestScore = Infinity;
      for (const h of targetCandidates) {
        const score = computeGuestHostScore(g, h);
        const remainingCap = h.maxGuests - h.assignedGuests;
        const tieBreaker = -remainingCap * 0.001;
        const finalScore = score + tieBreaker;
        if (finalScore < bestScore) { bestScore = finalScore; bestHost = h; }
      }

      if (bestHost) {
        g.assignedTo = bestHost.name;
        bestHost.assignedGuests++;
        bestHost.assignedList.push(g.userId);
      } else {
        g.assignedTo = 'unassigned';
      }
    }
  } else {
    // Fallback: round-robin
    // Phase 1: minQuota
    for (const g of guests) {
      let assigned = false;
      let loopCount = 0;
      while (!assigned && loopCount < hosts.length) {
        const h = hosts[loopCount % hosts.length];
        if (h.assignedGuests < h.minQuota) {
          g.assignedTo = h.name;
          h.assignedGuests++;
          assigned = true;
        }
        loopCount++;
      }
    }
    // Phase 2: targetQuota
    let hostIndex = 0;
    for (const g of guests) {
      if (g.assignedTo) continue;
      let assigned = false;
      let loopCount = 0;
      while (!assigned && loopCount < hosts.length) {
        const h = hosts[hostIndex];
        if (h.assignedGuests < h.targetQuota) {
          g.assignedTo = h.name;
          h.assignedGuests++;
          assigned = true;
        } else {
          hostIndex = (hostIndex + 1) % hosts.length;
          loopCount++;
        }
      }
      if (!assigned) g.assignedTo = 'unassigned';
      hostIndex = (hostIndex + 1) % hosts.length;
    }
  }

  // Hosts themselves: assignedTo = their own name (they are hosting)
  hosts.forEach(h => { h.assignedTo = h.name; });

  // === Write assignments to DB ===
  for (const p of participants) {
    const response = meeting.responses.find(r => r.userId === p.userId);
    if (!response) continue;

    // Find the assigned host's userId
    let assignedHostId: number | null = null;
    if (p.isHost) {
      assignedHostId = p.userId; // host is assigned to themselves
    } else if (p.assignedTo && p.assignedTo !== 'unassigned') {
      const hostParticipant = participants.find(pp => pp.name === p.assignedTo);
      if (hostParticipant) assignedHostId = hostParticipant.userId;
    }

    await prisma.response.update({
      where: { id: response.id },
      data: { assignedHost: assignedHostId },
    });
  }
}