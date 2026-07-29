/** Smart ticket routing by category, service type, skills, workload */

export interface RoutingTeam {
  id: string;
  team_code: string;
  name: string;
  service_types?: string[] | null;
  categories?: string[] | null;
}

export interface RoutingAgent {
  id: string;
  user_id: string;
  team_id: string | null;
  skills?: string[] | null;
  max_open_tickets?: number | null;
  is_available?: boolean | null;
  open_count?: number;
  display_name?: string | null;
}

export function routeTicket(params: {
  category?: string | null;
  service_type?: string | null;
  teams: RoutingTeam[];
  agents?: RoutingAgent[];
}): {
  teamId: string | null;
  agentUserId: string | null;
  reason: string;
} {
  const cat = (params.category || "").toLowerCase();
  const svc = (params.service_type || "it").toLowerCase();

  // Match team by service type + category
  let team =
    params.teams.find(
      (t) =>
        (t.service_types || []).map((s) => s.toLowerCase()).includes(svc) &&
        (t.categories || []).some((c) => c.toLowerCase() === cat || cat.includes(c.toLowerCase()))
    ) ||
    params.teams.find((t) =>
      (t.service_types || []).map((s) => s.toLowerCase()).includes(svc)
    ) ||
    params.teams[0] ||
    null;

  // Network special case
  if (cat.includes("network") || cat.includes("wifi") || cat.includes("server")) {
    const net = params.teams.find(
      (t) =>
        t.team_code.toUpperCase().includes("NET") ||
        (t.categories || []).some((c) => c.toLowerCase().includes("network"))
    );
    if (net) team = net;
  }

  if (!team) {
    return { teamId: null, agentUserId: null, reason: "No matching team" };
  }

  const agents = (params.agents || []).filter(
    (a) =>
      a.is_available !== false &&
      a.team_id === team!.id &&
      (a.open_count ?? 0) < (a.max_open_tickets ?? 20)
  );

  // Prefer skill match
  const skilled = agents.find((a) =>
    (a.skills || []).some((s) => s.toLowerCase() === cat || cat.includes(s.toLowerCase()))
  );

  // Lowest workload
  const sorted = [...agents].sort(
    (a, b) => (a.open_count ?? 0) - (b.open_count ?? 0)
  );
  const pick = skilled || sorted[0] || null;

  return {
    teamId: team.id,
    agentUserId: pick?.user_id || null,
    reason: pick
      ? `Routed to ${team.name} → ${pick.display_name || "agent"} (load ${pick.open_count ?? 0})`
      : `Routed to ${team.name} (no available agent)`,
  };
}

export function detectDuplicate(
  subject: string,
  openTickets: Array<{ id: string; subject: string; status: string }>
): Array<{ id: string; subject: string; score: number }> {
  const words = new Set(
    subject
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );
  return openTickets
    .map((t) => {
      const tw = t.subject.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const overlap = tw.filter((w) => words.has(w)).length;
      const score = words.size ? overlap / words.size : 0;
      return { id: t.id, subject: t.subject, score };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
