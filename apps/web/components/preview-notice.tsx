// The environment notice shown above every page, in the site and workspace layouts.
function PreviewNotice({ fixtureTest, readOnly }: { fixtureTest: boolean; readOnly: boolean }) {
  return (
    <div className="border-b bg-secondary px-5 py-2 text-center text-xs text-secondary-foreground">
      {fixtureTest ? "Staging test · Sample data only. Email is off." : readOnly
        ? "Staging preview · Browsing only. Accounts, bookings and email are unavailable."
        : "Local preview · Email delivery is not connected. Drafts stay private."}
    </div>
  );
}

export { PreviewNotice };
