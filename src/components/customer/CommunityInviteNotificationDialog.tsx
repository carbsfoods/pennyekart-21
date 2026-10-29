import { Bell, Check, X } from "lucide-react";
import { NotificationDialogFrame } from "@/components/OrderNotificationDialog";
import { Button } from "@/components/ui/button";
import type { CommunityInvite } from "@/hooks/useCommunityInvites";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invites: CommunityInvite[];
  respondingId: string | null;
  onRespond: (inviteId: string, accept: boolean) => void;
  onRemindLater: () => void;
}

/** Popup in-app alert for pending community invitations, shown on the customer profile. */
export default function CommunityInviteNotificationDialog({ open, onOpenChange, invites, respondingId, onRespond, onRemindLater }: Props) {
  return (
    <NotificationDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Community invitation"
      description={<span className="block text-xl font-bold">{invites.length} invitation{invites.length === 1 ? "" : "s"} · awaiting your response</span>}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" className="h-11" onClick={onRemindLater}>Not today</Button>
        </div>
      }
    >
      {invites.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No pending invitations</p>}
      {invites.map((inv) => (
        <article key={inv.invite_id} className="space-y-3 rounded-lg border bg-card p-3">
          <div className="min-w-0">
            <p className="break-words font-semibold">{inv.community_name}</p>
            <p className="text-xs text-muted-foreground">
              Invited by {inv.creator_name} · {new Date(inv.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <Button className="delivery-gradient h-11" disabled={respondingId !== null} onClick={() => onRespond(inv.invite_id, true)}>
              <Check className="mr-2 h-4 w-4" /> Accept
            </Button>
            <Button variant="outline" className="h-11" disabled={respondingId !== null} onClick={() => onRespond(inv.invite_id, false)} aria-label={`Decline invitation to ${inv.community_name}`}>
              <X className="mr-2 h-4 w-4" /> Decline
            </Button>
          </div>
        </article>
      ))}
    </NotificationDialogFrame>
  );
}
