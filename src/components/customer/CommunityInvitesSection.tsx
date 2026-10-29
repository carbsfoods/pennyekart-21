import { useEffect, useState } from "react";
import { Check, Loader2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCommunityInvites } from "@/hooks/useCommunityInvites";

interface Props {
  userId: string;
}

/**
 * Inline list of pending community invitations on the customer profile.
 * Only renders for roles without the community card (customer, super admin,
 * team leader, …); eligible roles see the same invites inside CommunityCard.
 */
export default function CommunityInvitesSection({ userId }: Props) {
  const { invites, loading, respondingId, respond } = useCommunityInvites(userId);
  const [eligible, setEligible] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("can_use_community").then(({ data }) => setEligible(data === true));
  }, []);

  if (eligible !== false || loading || invites.length === 0) return null;

  return (
    <section className="rounded-xl border border-neonblue/30 bg-neonblue/5 p-4 space-y-3">
      <h2 className="font-heading text-base font-bold flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" /> Community invitations
      </h2>
      {invites.map((inv) => (
        <div key={inv.invite_id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{inv.community_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              Invited by {inv.creator_name} · {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
          </div>
          <Button size="sm" disabled={respondingId !== null} onClick={() => respond(inv.invite_id, true)} className="gap-1">
            {respondingId === inv.invite_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Accept
          </Button>
          <Button size="sm" variant="outline" disabled={respondingId !== null} onClick={() => respond(inv.invite_id, false)} aria-label={`Decline invitation to ${inv.community_name}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </section>
  );
}
