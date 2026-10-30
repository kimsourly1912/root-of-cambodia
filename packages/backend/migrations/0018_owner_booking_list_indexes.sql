-- Support owner newest-first lists, with or without an exact saved-status filter.
-- Additive indexes only: no booking, stock, receipt or history changes.
CREATE INDEX booking_property_submitted ON booking(property_id,submitted_at DESC,id DESC) WHERE status!='building';
CREATE INDEX booking_property_status_submitted ON booking(property_id,status,submitted_at DESC,id DESC) WHERE status!='building';
