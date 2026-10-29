import { useEffect, useState } from "react";
import CommunityInviteNotificationDialog from "@/components/customer/CommunityInviteNotificationDialog";
import { useCommunityInvites } from "@/hooks/useCommunityInvites";
import { areDailyRemindersDismissed, dismissDailyReminders } from "@/lib/dailyReminderDismissal";

/**
 * Mounts the community-invitation popup on the customer profile: it opens
 automatically while invitations are pending and "Not today" suppresses it
 for the rest of the day for this user only.
 */
export default function CommunityInviteAlert({ userId }: { userId: string }) {
  const { invites, loading, respondingId, respond } = useCommunityInvites(userId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (invites.length === 0) { setOpen(false); return; }
    if (!areDailyRemindersDismissed("community", userId)) setOpen(true);
  }, [loading, invites.length, userId]);

  const remindLater = () => {
    dismissDailyReminders("community", userId);
    setOpen(false);
  };

  return (
    <CommunityInviteNotificationDialog
      open={open}
      onOpenChange={setOpen}
      invites={invites}
      respondingId={respondingId}
      onRespond={(id, accept) => void respond(id, accept)}
      onRemindLater={remindLater}
    />
  );
}
