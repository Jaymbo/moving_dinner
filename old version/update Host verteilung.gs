function updateCurrentTreffen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("Masterblatt");
  const stammdatenSheet = ss.getSheetByName("Stammdaten");
  const overviewSheet = ss.getSheetByName("Treffen-Übersicht");

  // =======================
  // 1. Aktuelles Treffen ermitteln
  // =======================
  const overviewData = overviewSheet.getDataRange().getValues().slice(1); // ohne Header
  const now = new Date();

  // Nächstes Treffen, das noch nicht gefreezt ist
  const currentTreffenInfo = overviewData
    .filter(r => r[3] !== true) // Freeze = FALSE
    .sort((a,b)=> new Date(a[0]) - new Date(b[0]))[0]; // nach Datum sortieren

  if(!currentTreffenInfo) return; // Kein aktuelles Treffen

  const currentSheetName = currentTreffenInfo[4]; // Blattname
  const currentSheet = ss.getSheetByName(currentSheetName);
  const deadline = new Date(currentTreffenInfo[2]);
  const freezeFlag = currentTreffenInfo[3];

  // =======================
  // 2. Stammdaten und Master auslesen
  // =======================
  const stammdaten = stammdatenSheet.getDataRange().getValues().slice(1);
  let maxGästeMap = {};
  stammdaten.forEach(sd => { maxGästeMap[sd[1]] = sd[3]; }); // Name -> max Gäste

  // Masterblatt: Name -> Score
  const masterData = {};
  const masterValues = masterSheet.getDataRange().getValues().slice(1);
  masterValues.forEach(row => {
    masterData[row[0]] = {Teilnahmen:row[1], Hostings:row[2], Gehostete:row[3], Score:row[4]};
  });
  // =======================
  // 3. Teilnehmer aus aktuellem Treffen auslesen
  // =======================
  const lastRow = currentSheet.getLastRow();
  if(lastRow < 2) return; // keine Teilnehmer

  const participants = currentSheet.getRange(2, 2, lastRow-1, 3).getValues(); // B:C (Name, Host-Wunsch, D)
  let participantData = participants.map(function(p, idx) {
    const name = (p[0] || '').toString().trim();
    return {
      Name: name,
      HostWunsch: (p[1] || '').toString().trim(),
      Host: false,
      AssignedGuests: 0,
      MaxGuests: maxGästeMap[name] || 0,
      AssignedTo: "",
      sheetRow: idx + 2
    };
  }).filter(p => p.Name && p.Name.length > 0); // remove empty rows

  // =======================
  // 4. Hosts bestimmen
  // =======================
  let hosts = [];
  let candidates = participantData;
  const totalParticipants = participantData.length;
  const HIGH_SCORE = 1e9;
  const LOW_SCORE = -1e9;
  const TIE_SEED = 'moving-dinner-seed-2025';
  const DEFAULT_MAX_GUESTS = 2; // Standard-Kapazität wenn MaxGäste nicht gesetzt

  const candidateScores = candidates.map(p => {
    const scoreBase = (masterData[p.Name] && typeof masterData[p.Name].Score === 'number') ? masterData[p.Name].Score : 0;
    let adjusted;
    // "Will hosten" bekommt immer HIGH_SCORE (auch mit MaxGäste=0 -> Standard-Kapazität)
    if (p.HostWunsch === 'Will hosten') adjusted = HIGH_SCORE + scoreBase;
    else if (p.HostWunsch === 'Kann nicht hosten') adjusted = LOW_SCORE + scoreBase;
    else if (!p.MaxGuests || Number(p.MaxGuests) <= 0) adjusted = LOW_SCORE + scoreBase;
    else adjusted = scoreBase;
    // FIX: "Will hosten" mit MaxGäste=0 bekommt Standard-Kapazität
    if (p.HostWunsch === 'Will hosten' && (!p.MaxGuests || Number(p.MaxGuests) <= 0)) {
      p.MaxGuests = DEFAULT_MAX_GUESTS;
    }
    p.calculatedScore = adjusted;
    return { participant: p, score: adjusted };
  });

  const possible = candidateScores;
  possible.sort((a,b) => {
    if (a.score === b.score) {
      const ha = hashString((a.participant.Name || '') + '|' + TIE_SEED);
      const hb = hashString((b.participant.Name || '') + '|' + TIE_SEED);
      return ha - hb;
    }
    return (b.score > a.score) ? 1 : -1;
  });

  // Select hosts iteratively - skip candidates with 0 capacity (unless they want to host)
  let assignedCapacity = 0;
  const selectedHosts = [];
  for (let i = 0; i < possible.length; i++) {
    const cand = possible[i].participant;
    if (selectedHosts.indexOf(cand) >= 0) continue;
    // Skip candidates with 0 capacity who don't want to host
    if ((!cand.MaxGuests || Number(cand.MaxGuests) <= 0) && cand.HostWunsch !== 'Will hosten') continue;
    selectedHosts.push(cand);
    assignedCapacity += cand.MaxGuests || 0;
    const guestsCount = totalParticipants - selectedHosts.length;
    if (assignedCapacity >= guestsCount) break;
  }

  // Mark selected hosts in participantData and hosts array
  selectedHosts.forEach(h => {
    h.Host = true;
    hosts.push(h);
  });

  // FIX: Nach Host-Selektion, stelle sicher dass jeder Host mindestens die faire Quote hosten kann
  // Wenn ein Host (z.B. "Will hosten" mit DEFAULT_MAX_GUESTS=2) zu wenig Kapazitaet hat,
  // erhoehen wir seine MaxGuests auf mindestens ceil(Gaeste/Hosts)
  const totalGuestsToAssign_pre = participantData.filter(p => !p.Host).length;
  if (hosts.length > 0) {
    const fairShare = Math.ceil(totalGuestsToAssign_pre / hosts.length);
    hosts.forEach(h => {
      if (Number(h.MaxGuests) < fairShare) {
        Logger.log('Host ' + h.Name + ': MaxGuests erhoeht von ' + h.MaxGuests + ' auf ' + fairShare + ' (fairShare)');
        h.MaxGuests = fairShare;
      }
    });
  }

  // === Compute fair per-host quotas (minQuota + targetQuota) ===
  const totalGuestsToAssign = participantData.filter(p => !p.Host).length;
  const caps = hosts.map(h => Number(h.MaxGuests) || 0);
  const H = hosts.length;

  // MinQuota: jeder Host bekommt mindestens floor(Gäste/Hosts), begrenzt auf Kapazität
  let minBase = H > 0 ? Math.floor(totalGuestsToAssign / H) : 0;
  let minQuotas = hosts.map((h, i) => Math.min(caps[i], minBase));
  let minSum = minQuotas.reduce((a, b) => a + b, 0);
  let minRemaining = Math.max(0, totalGuestsToAssign - minSum);
  let minIdx = 0;
  while (minRemaining > 0) {
    if (hosts.length === 0) break;
    const i = minIdx % hosts.length;
    if (minQuotas[i] < caps[i]) { minQuotas[i]++; minRemaining--; }
    minIdx++;
    if (minIdx > hosts.length * 1000) break;
  }

  // TargetQuota (= MaxQuota): ceiling-Verteilung, begrenzt auf Kapazität
  let targetBase = H > 0 ? Math.ceil(totalGuestsToAssign / H) : 0;
  let quotas = hosts.map((h, i) => Math.min(caps[i], targetBase));
  let assignedQuotaSum = quotas.reduce((a,b)=>a+b,0);
  let remaining = Math.max(0, totalGuestsToAssign - assignedQuotaSum);
  let idx = 0;
  while (remaining > 0) {
    if (hosts.length === 0) break;
    const i = idx % hosts.length;
    if (quotas[i] < caps[i]) { quotas[i]++; remaining--; }
    idx++;
    if (idx > hosts.length * 1000) break;
  }

  // Attach minQuota and targetQuota to hosts
  hosts.forEach((h,i)=>{ h.minQuota = minQuotas[i] || 0; h.targetQuota = quotas[i] || 0; });

  // =======================
  // 5. Gäste verteilen (matrix-gestützt, zwei Phasen)
  let guests = participantData.filter(p => !p.Host);

  // Try to load Treffen-Matrix
  const matrixSheet = ss.getSheetByName('Treffen-Matrix');
  let matrix = null;
  let matrixNameIndex = {};
  if (matrixSheet) {
    try {
      const headerRange = matrixSheet.getRange(1,2,1, Math.max(0, matrixSheet.getLastColumn()-1));
      const header = headerRange.getValues()[0].map(h => (h||'').toString().trim());
      for (let i = 0; i < header.length; i++) matrixNameIndex[normalize(header[i])] = i;
      const N = header.length;
      if (N > 0) matrix = matrixSheet.getRange(2,2,N,N).getValues();
    } catch (e) {
      Logger.log('Fehler beim Lesen von Treffen-Matrix: ' + e.message);
      matrix = null;
    }
  }

  // Prepare hosts and guests
  hosts.forEach(h => { h.AssignedGuests = 0; h.assignedList = []; h.idx = (matrix ? matrixNameIndex[normalize(h.Name)] : undefined); });
  guests.forEach(g => { g.idx = (matrix ? matrixNameIndex[normalize(g.Name)] : undefined); });

  // Hilfsfunktion: Score für (gast, host) berechnen
  function computeGuestHostScore(g, h) {
    let score = 0;
    if (typeof g.idx !== 'undefined' && typeof h.idx !== 'undefined') {
      score += Number(matrix[g.idx][h.idx] || 0);
    }
    if (h.assignedList.length > 0 && typeof g.idx !== 'undefined') {
      let sum = 0;
      h.assignedList.forEach(ai => { sum += Number(matrix[g.idx][ai] || 0); });
      score += sum / h.assignedList.length;
    }
    return score;
  }

  if (matrix && hosts.length > 0) {
    const guestList = guests.slice();

    // Phase 1: MinQuota füllen - jeder Host muss mindestens minQuota Gäste bekommen
    for (let gi = 0; gi < guestList.length; gi++) {
      const g = guestList[gi];
      if (g.AssignedTo) continue;

      // Nur Hosts, die noch unter minQuota sind
      let minQuotaCandidates = hosts.filter(h => h.AssignedGuests < h.minQuota);
      if (minQuotaCandidates.length === 0) break; // alle Hosts haben minQuota erreicht

      let bestHost = null;
      let bestScore = Number.POSITIVE_INFINITY;
      minQuotaCandidates.forEach(h => {
        let score = computeGuestHostScore(g, h);
        const remainingCap = h.MaxGuests - h.AssignedGuests;
        const tieBreaker = -remainingCap * 0.001;
        const finalScore = score + tieBreaker;
        if (finalScore < bestScore) { bestScore = finalScore; bestHost = h; }
      });

      if (bestHost) {
        g.AssignedTo = bestHost.Name;
        bestHost.AssignedGuests++;
        if (typeof g.idx !== 'undefined') bestHost.assignedList.push(g.idx);
      }
    }

    // Phase 2: Rest verteilen bis targetQuota
    for (let gi = 0; gi < guestList.length; gi++) {
      const g = guestList[gi];
      if (g.AssignedTo) continue;

      let targetCandidates = hosts.filter(h => h.AssignedGuests < h.targetQuota);
      if (targetCandidates.length === 0) {
        g.AssignedTo = 'hosted'; // Fallback
        continue;
      }

      let bestHost = null;
      let bestScore = Number.POSITIVE_INFINITY;
      targetCandidates.forEach(h => {
        let score = computeGuestHostScore(g, h);
        const remainingCap = h.MaxGuests - h.AssignedGuests;
        const tieBreaker = -remainingCap * 0.001;
        const finalScore = score + tieBreaker;
        if (finalScore < bestScore) { bestScore = finalScore; bestHost = h; }
      });

      if (bestHost) {
        g.AssignedTo = bestHost.Name;
        bestHost.AssignedGuests++;
        if (typeof g.idx !== 'undefined') bestHost.assignedList.push(g.idx);
      } else {
        g.AssignedTo = 'hosted';
      }
    }
  } else {
    // Fallback: round-robin mit minQuota und targetQuota
    // Phase 1: MinQuota füllen
    guests.forEach(g => {
      let assigned = false;
      let loopCount = 0;
      while (!assigned && loopCount < hosts.length) {
        let h = hosts[loopCount % hosts.length];
        if (h.AssignedGuests < h.minQuota) {
          g.AssignedTo = h.Name;
          h.AssignedGuests++;
          assigned = true;
        }
        loopCount++;
      }
    });
    // Phase 2: Rest verteilen bis targetQuota
    let hostIndex = 0;
    guests.forEach(g => {
      if (g.AssignedTo) return;
      let assigned = false;
      let loopCount = 0;
      while (!assigned && loopCount < hosts.length) {
        let h = hosts[hostIndex];
        if (h.AssignedGuests < h.targetQuota) {
          g.AssignedTo = h.Name;
          h.AssignedGuests++;
          assigned = true;
        } else {
          hostIndex = (hostIndex + 1) % hosts.length;
          loopCount++;
        }
      }
      if (!assigned) g.AssignedTo = "hosted";
      hostIndex = (hostIndex + 1) % hosts.length;
    });
  }

  // Hosts selbst: AssignedTo = "hosted"
  hosts.forEach(h => h.AssignedTo = "hosted");

  // =======================
  // 6. Ergebnisse zurückschreiben in Spalte D
  // =======================
  participantData.forEach(p => {
    try {
      currentSheet.getRange(p.sheetRow, 4).setValue(p.AssignedTo || '');
    } catch (e) {
      Logger.log('Fehler beim Schreiben in Zeile ' + p.sheetRow + ': ' + e.message);
    }
  });

  SpreadsheetApp.flush();
}

/**
 * Deterministische Hash-Funktion für Strings (djb2), gibt 32-bit unsigned int zurück.
 */
function hashString(s) {
  s = (s || '').toString();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i); // h * 33 + c
    h = h & 0xFFFFFFFF; // keep 32-bit
  }
  return h >>> 0; // unsigned
}