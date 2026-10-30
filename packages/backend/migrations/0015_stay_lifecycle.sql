-- Owner-attested arrival, using the immutable booked schedule and database time.
-- Invalid operation kinds remain rejected independently by 0004.
CREATE TRIGGER booking_arrival_window BEFORE UPDATE OF status ON booking
WHEN OLD.status='confirmed' AND NEW.status='checked_in'
 AND EXISTS(SELECT 1 FROM operation WHERE id=NEW.last_operation_id AND kind='check_in' AND actor_role='owner')
BEGIN
 SELECT RAISE(ABORT,'invalid_arrival_window') WHERE unixepoch()<NEW.checkin_at OR unixepoch()>=NEW.checkout_at;
END;
