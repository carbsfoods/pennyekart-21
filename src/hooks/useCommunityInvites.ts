import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CommunityInvite {
  invite_id: string;
  community_id: string;
  community_name: string;
  creator_name: string;
  created_at: string;
}

const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);

/**
 * Pending community invitations addressed to the signed-in user's mobile.
 * Shared by the inline profile section and the invitation popup alert so
 * both always show the same list and accept/decline through the same path.
 */
export function useCommunityInvites(userId: string | undefined) {
  const [invites, setInvites] = useState<CommunityInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await rpc("get_my_community_invites");
    if (!error) setInvites(((data as CommunityInvite[] | null) ?? []));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const respond = useCallback(async (inviteId: string, accept: boolean) => {
    setRespondingId(inviteId);
    const { error } = await rpc("respond_to_community_invite", { _invite_id: inviteId, _accept: accept });
    setRespondingId(null);
    if (error) {
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return false;
    }
    toast.success(accept ? "You joined the community" : "Invite declined");
    await load();
    return true;
  }, [load]);

  return { invites, loading, respondingId, respond, reload: load };
}
